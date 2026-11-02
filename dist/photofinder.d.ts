import { artic } from './providers/artic.ts';
import { cleveland } from './providers/cleveland.ts';
import { met } from './providers/met.ts';
import { openverse } from './providers/openverse.ts';
import { wikimedia } from './providers/wikimedia.ts';
import type { Locale, Provider, SearchEvent, SearchOptions, SearchResponse } from './types.ts';
/**
 * Provider senza chiave API, utilizzabili per nome nell'opzione `providers`.
 * Quelli che richiedono una chiave (es. `smithsonian`) vanno passati come oggetto.
 */
export declare const builtinProviders: {
    readonly openverse: typeof openverse;
    readonly wikimedia: typeof wikimedia;
    readonly met: typeof met;
    readonly artic: typeof artic;
    readonly cleveland: typeof cleveland;
};
export type BuiltinProviderId = keyof typeof builtinProviders;
/**
 * Provider usati se l'opzione `providers` non è indicata.
 * `artic` è escluso: il server immagini dell'AIC blocca l'incorporamento da altri siti
 * (vedi https://github.com/art-institute-of-chicago/api-data/issues/9).
 */
export declare const defaultProviders: readonly BuiltinProviderId[];
export interface PhotoFinderOptions {
    /**
     * Provider da interrogare: nomi dei provider inclusi o oggetti {@link Provider}
     * (inclusi o personalizzati). Default: {@link defaultProviders}
     * (`openverse`, `wikimedia`, `met`, `cleveland`).
     */
    providers?: Array<BuiltinProviderId | Provider>;
    /**
     * Contatto (email o URL) aggiunto allo User-Agent. **Fortemente consigliato**:
     * senza contatto Wikimedia classifica il client come "Unidentified" e lo limita
     * a 10 richieste al minuto (200 con contatto). Se manca, viene stampato un avviso.
     */
    contact?: string;
    /** User-Agent completo; se impostato, `contact` viene ignorato. */
    userAgent?: string;
    /** Lingua delle stringhe di attribuzione. Default: `'it'`. */
    locale?: Locale;
    /** Timeout per ogni richiesta HTTP, in millisecondi. Default: `10000`. */
    timeoutMs?: number;
    /** Durata della cache delle ricerche, in millisecondi. `0` la disattiva. Default: `600000` (10 minuti). */
    cacheTtlMs?: number;
    /** Numero massimo di ricerche in cache. Default: `500`. */
    cacheMaxEntries?: number;
    /**
     * Per quanto saltare un provider dopo un errore, in millisecondi, così che un
     * servizio irraggiungibile non rallenti ogni ricerca col suo timeout.
     * `0` disattiva la pausa. Default: `300000` (5 minuti).
     */
    pauseOnErrorMs?: number;
    /** Implementazione di `fetch` da usare (utile per test o proxy). Default: `globalThis.fetch`. */
    fetch?: typeof globalThis.fetch;
}
/**
 * Cerca immagini riutilizzabili su più provider in parallelo.
 *
 * @example
 * const finder = new PhotoFinder({ contact: 'dev@example.com' });
 * const { results } = await finder.search('cartina toscana');
 * for (const img of results) console.log(img.imageUrl, img.attribution ?? '');
 */
export declare class PhotoFinder {
    #private;
    readonly providers: readonly Provider[];
    constructor(options?: PhotoFinderOptions);
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
    search(query: string, options?: SearchOptions): Promise<SearchResponse>;
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
    searchStream(query: string, { page, signal }?: SearchOptions): AsyncGenerator<SearchEvent, void, undefined>;
    /** Svuota la cache delle ricerche e azzera le pause dei provider. */
    reset(): void;
}
/** Alterna gli elementi delle liste (uno da ciascuna a turno), così i provider non formano blocchi. */
export declare function interleave<T>(lists: T[][]): T[];
//# sourceMappingURL=photofinder.d.ts.map