/** Lingua della stringa di attribuzione generata. */
export type Locale = 'it' | 'en';
/**
 * Un'immagine riutilizzabile, nello stesso formato per tutti i provider.
 *
 * Ogni risultato ha già superato il filtro licenze: si può usare anche
 * commercialmente e modificare. Se `attributionRequired` è `true`, va mostrata
 * la stringa `attribution` vicino all'immagine.
 */
export interface ImageResult {
    /** Identificativo univoco nella forma `<provider>:<id originale>`. */
    id: string;
    /** Nome leggibile del provider, es. `"Wikimedia Commons"`. */
    provider: string;
    /** Titolo dell'opera; stringa vuota se il provider non lo fornisce. */
    title: string;
    /** Autore, se noto. */
    creator: string | null;
    /** URL dell'immagine a piena risoluzione. */
    imageUrl: string;
    /** URL di un'anteprima (circa 400px di larghezza dove il provider lo consente). */
    thumbnailUrl: string;
    /** Pagina originale dell'immagine, dove si trovano tutti i dettagli sulla licenza. */
    sourceUrl: string;
    /** Nome breve della licenza, es. `"CC BY-SA 4.0"`, `"CC0"`, `"Public domain"`. */
    license: string;
    licenseUrl: string | null;
    /** `true` se la licenza obbliga a citare l'autore (CC BY, CC BY-SA). */
    attributionRequired: boolean;
    /** Testo da mostrare accanto all'immagine, oppure `null` se non serve attribuzione. */
    attribution: string | null;
}
/**
 * Funzione con cui i provider fanno le richieste HTTP (timeout, User-Agent e annullamento inclusi).
 * `headers` si aggiungono a quelli predefiniti.
 */
export type FetchJson = <T = unknown>(url: string | URL, init?: {
    headers?: Record<string, string>;
}) => Promise<T>;
/** Contesto passato a ogni provider per una singola ricerca. */
export interface ProviderContext {
    /** Pagina richiesta, a partire da 1. */
    page: number;
    locale: Locale;
    /** User-Agent configurato in `PhotoFinder`, per i provider che lo vogliono anche in un header dedicato. */
    userAgent: string;
    fetchJson: FetchJson;
}
/**
 * Una fonte di immagini. Si possono scrivere provider propri implementando
 * questa interfaccia: devono restituire **solo** immagini riutilizzabili.
 */
export interface Provider {
    /** Chiave usata in {@link SearchResponse.providers}, es. `"wikimedia"`. */
    id: string;
    /** Nome leggibile, es. `"Wikimedia Commons"`. */
    name: string;
    search(query: string, ctx: ProviderContext): Promise<ImageResult[]>;
}
/** Esito di un singolo provider all'interno di una ricerca. */
export type ProviderStatus = {
    ok: true;
    count: number;
} | {
    ok: false;
    /** Messaggio d'errore leggibile. */
    error: string;
    /** Se valorizzato, il provider viene saltato fino a questo istante. */
    pausedUntil?: Date;
};
export interface SearchResponse {
    query: string;
    page: number;
    /** Risultati di tutti i provider, alternati (uno per provider a turno). */
    results: ImageResult[];
    /** Esito di ogni provider, indicizzato per {@link Provider.id}. */
    providers: Record<string, ProviderStatus>;
    /** `true` se la risposta arriva dalla cache. */
    cached: boolean;
}
export interface SearchOptions {
    /** Pagina da richiedere, a partire da 1. Default: `1`. */
    page?: number;
    /** Per annullare la ricerca. */
    signal?: AbortSignal;
}
/**
 * Evento emesso da `PhotoFinder.searchStream()`.
 *
 * - `start`: la ricerca è partita; `pending` sono i provider interrogati in rete
 *   (vuoto se la risposta arriva dalla cache).
 * - `provider`: un provider ha risposto (o è stato saltato perché in pausa).
 *   `results` sono solo i suoi risultati; `pending` i provider ancora in attesa.
 * - `done`: tutti hanno risposto; `response` è uguale a quella di `search()`.
 */
export type SearchEvent = {
    type: 'start';
    query: string;
    page: number;
    /** Tutti i provider configurati, nell'ordine di configurazione. */
    providers: Array<{
        id: string;
        name: string;
    }>;
    pending: string[];
    cached: boolean;
} | {
    type: 'provider';
    /** {@link Provider.id} */
    provider: string;
    /** {@link Provider.name} */
    name: string;
    status: ProviderStatus;
    results: ImageResult[];
    pending: string[];
} | {
    type: 'done';
    response: SearchResponse;
};
//# sourceMappingURL=types.d.ts.map