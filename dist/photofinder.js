import { createFetchJson } from './http.js';
import { artic } from './providers/artic.js';
import { cleveland } from './providers/cleveland.js';
import { met } from './providers/met.js';
import { openverse } from './providers/openverse.js';
import { wikimedia } from './providers/wikimedia.js';
/**
 * Provider senza chiave API, utilizzabili per nome nell'opzione `providers`.
 * Quelli che richiedono una chiave (es. `smithsonian`, `pixabay`) vanno passati come oggetto.
 */
export const builtinProviders = { openverse, wikimedia, met, artic, cleveland };
/**
 * Provider usati se l'opzione `providers` non è indicata.
 * `artic` è escluso: il server immagini dell'AIC blocca l'incorporamento da altri siti
 * (vedi https://github.com/art-institute-of-chicago/api-data/issues/9).
 */
export const defaultProviders = ['openverse', 'wikimedia', 'met', 'cleveland'];
const VERSION = '0.1.0';
let warnedMissingContact = false;
/**
 * Cerca immagini riutilizzabili su più provider in parallelo.
 *
 * @example
 * const finder = new PhotoFinder({ contact: 'dev@example.com' });
 * const { results } = await finder.search('cartina toscana');
 * for (const img of results) console.log(img.imageUrl, img.attribution ?? '');
 */
export class PhotoFinder {
    providers;
    #fetch;
    #userAgent;
    #locale;
    #timeoutMs;
    #cacheTtlMs;
    #cacheMaxEntries;
    #pauseOnErrorMs;
    #cache = new Map();
    #pausedUntil = new Map();
    constructor(options = {}) {
        const list = options.providers ?? defaultProviders;
        this.providers = list.map((p) => {
            if (typeof p !== 'string')
                return p;
            const factory = builtinProviders[p];
            if (!factory)
                throw new TypeError(`Provider sconosciuto: "${p}"`);
            return factory();
        });
        const ids = this.providers.map((p) => p.id);
        const dup = ids.find((id, i) => ids.indexOf(id) !== i);
        if (dup)
            throw new TypeError(`Provider duplicato: "${dup}"`);
        if (!options.userAgent && !options.contact && !warnedMissingContact) {
            warnedMissingContact = true;
            // Senza contatto Wikimedia classifica il client come "Unidentified": 10 richieste/minuto
            // invece di 200 (https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits).
            console.warn('[photofinder] Nessun `contact` configurato: Wikimedia limiterà le richieste a 10/minuto. ' +
                'Passa `contact` (email o URL) a new PhotoFinder().');
        }
        this.#fetch = options.fetch ?? globalThis.fetch;
        this.#userAgent =
            options.userAgent ?? `photofinder/${VERSION}${options.contact ? ` (${options.contact})` : ''}`;
        this.#locale = options.locale ?? 'it';
        this.#timeoutMs = options.timeoutMs ?? 10_000;
        this.#cacheTtlMs = options.cacheTtlMs ?? 10 * 60_000;
        this.#cacheMaxEntries = options.cacheMaxEntries ?? 500;
        this.#pauseOnErrorMs = options.pauseOnErrorMs ?? 5 * 60_000;
    }
    /**
     * Cerca `query` su tutti i provider e restituisce la risposta completa, quando
     * hanno risposto tutti. Non lancia eccezioni se un provider fallisce: l'errore
     * è riportato in `response.providers[id]` e gli altri risultati vengono
     * restituiti comunque.
     *
     * Per mostrare i risultati man mano che arrivano usa {@link searchStream}.
     *
     * @throws {TypeError} se `query` è vuota o `page` non è un intero ≥ 1.
     * @throws l'errore di `signal` se la ricerca viene annullata.
     */
    async search(query, options = {}) {
        for await (const event of this.searchStream(query, options)) {
            if (event.type === 'done')
                return event.response;
        }
        throw new Error('searchStream terminato senza evento "done"');
    }
    /**
     * Come {@link search}, ma restituisce gli eventi appena disponibili:
     *
     * 1. `start`: elenco dei provider interrogati (`pending`);
     * 2. un `provider` per ciascun provider, nell'ordine in cui rispondono, con i
     *    suoi risultati e i provider ancora in attesa;
     * 3. `done`: la risposta completa, identica a quella di `search()`.
     *
     * Se il consumatore interrompe l'iterazione (`break`, `return`), le richieste
     * ancora in corso vengono annullate.
     *
     * @example
     * for await (const ev of finder.searchStream('gatto')) {
     *   if (ev.type === 'provider') mostra(ev.results, { inAttesa: ev.pending });
     * }
     *
     * @throws {TypeError} se `query` è vuota o `page` non è un intero ≥ 1.
     * @throws l'errore di `signal` se la ricerca viene annullata.
     */
    async *searchStream(query, { page = 1, signal } = {}) {
        const q = query.trim();
        if (!q)
            throw new TypeError('La query non può essere vuota');
        if (!Number.isInteger(page) || page < 1)
            throw new TypeError('`page` deve essere un intero ≥ 1');
        signal?.throwIfAborted();
        const key = `${this.#locale}|${q.toLowerCase()}|${page}`;
        const hit = this.#cache.get(key);
        if (hit && Date.now() - hit.at < this.#cacheTtlMs) {
            yield { type: 'start', query: q, page, providers: this.#describe(), pending: [], cached: true };
            for (const p of this.providers) {
                yield { type: 'provider', provider: p.id, name: p.name, status: hit.status[p.id], results: hit.lists[p.id], pending: [] };
            }
            yield { type: 'done', response: this.#response(q, page, hit.status, hit.lists, true) };
            return;
        }
        const status = {};
        const lists = {};
        const paused = [];
        const active = [];
        for (const p of this.providers) {
            const until = this.#pausedUntil.get(p.id);
            if (until !== undefined && Date.now() < until)
                paused.push(p);
            else
                active.push(p);
        }
        // Annulla le richieste rimaste in sospeso se il consumatore smette di leggere.
        const ctrl = new AbortController();
        const fetchJson = createFetchJson({
            fetch: this.#fetch,
            userAgent: this.#userAgent,
            timeoutMs: this.#timeoutMs,
            signal: signal ? AbortSignal.any([signal, ctrl.signal]) : ctrl.signal,
        });
        const ctx = { page, locale: this.#locale, userAgent: this.#userAgent, fetchJson };
        const inFlight = new Map();
        for (const p of active) {
            inFlight.set(p.id, p.search(q, ctx).then((value) => ({ provider: p, ok: true, value }), (reason) => ({ provider: p, ok: false, reason })));
        }
        try {
            yield { type: 'start', query: q, page, providers: this.#describe(), pending: [...inFlight.keys()], cached: false };
            for (const p of paused) {
                status[p.id] = { ok: false, error: 'In pausa dopo un errore recente', pausedUntil: new Date(this.#pausedUntil.get(p.id)) };
                lists[p.id] = [];
                yield { type: 'provider', provider: p.id, name: p.name, status: status[p.id], results: [], pending: [...inFlight.keys()] };
            }
            while (inFlight.size > 0) {
                const outcome = await Promise.race(inFlight.values());
                signal?.throwIfAborted();
                const { id, name } = outcome.provider;
                inFlight.delete(id);
                if (outcome.ok) {
                    this.#pausedUntil.delete(id);
                    status[id] = { ok: true, count: outcome.value.length };
                    lists[id] = outcome.value;
                }
                else {
                    status[id] = this.#failure(id, outcome.reason);
                    lists[id] = [];
                }
                yield { type: 'provider', provider: id, name, status: status[id], results: lists[id], pending: [...inFlight.keys()] };
            }
        }
        finally {
            ctrl.abort();
        }
        // Le risposte incomplete non vanno in cache, così si riprova alla ricerca successiva.
        if (this.#cacheTtlMs > 0 && Object.values(status).every((s) => s.ok))
            this.#store(key, { status, lists });
        yield { type: 'done', response: this.#response(q, page, status, lists, false) };
    }
    /** Svuota la cache delle ricerche e azzera le pause dei provider. */
    reset() {
        this.#cache.clear();
        this.#pausedUntil.clear();
    }
    #describe() {
        return this.providers.map((p) => ({ id: p.id, name: p.name }));
    }
    #failure(id, reason) {
        const error = reason instanceof Error ? reason.message : String(reason);
        if (this.#pauseOnErrorMs <= 0)
            return { ok: false, error };
        const until = Date.now() + this.#pauseOnErrorMs;
        this.#pausedUntil.set(id, until);
        return { ok: false, error, pausedUntil: new Date(until) };
    }
    #response(query, page, status, lists, cached) {
        // Ordine stabile (quello dei provider configurati), indipendente da chi ha risposto prima.
        const ordered = this.providers.map((p) => lists[p.id] ?? []);
        const providers = Object.fromEntries(this.providers.map((p) => [p.id, status[p.id]]));
        return { query, page, results: interleave(ordered), providers, cached };
    }
    #store(key, entry) {
        this.#cache.delete(key);
        this.#cache.set(key, { at: Date.now(), ...entry });
        // Le Map mantengono l'ordine di inserimento: la prima chiave è la più vecchia.
        while (this.#cache.size > this.#cacheMaxEntries)
            this.#cache.delete(this.#cache.keys().next().value);
    }
}
/** Alterna gli elementi delle liste (uno da ciascuna a turno), così i provider non formano blocchi. */
export function interleave(lists) {
    const out = [];
    const max = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < max; i++)
        for (const l of lists)
            if (i < l.length)
                out.push(l[i]);
    return out;
}
//# sourceMappingURL=photofinder.js.map