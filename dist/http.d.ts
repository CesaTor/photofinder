import type { FetchJson } from './types.ts';
/** Restituisce l'URL con le chiavi API sostituite da `***`. */
export declare function redactUrl(url: string | URL): string;
/** Errore HTTP restituito da un provider. `url` ha le chiavi API oscurate. */
export declare class HttpError extends Error {
    readonly status: number;
    readonly url: string;
    constructor(status: number, url: string);
}
export interface FetchJsonOptions {
    fetch: typeof globalThis.fetch;
    userAgent: string;
    timeoutMs: number;
    signal?: AbortSignal;
}
export declare function createFetchJson({ fetch, userAgent, timeoutMs, signal }: FetchJsonOptions): FetchJson;
//# sourceMappingURL=http.d.ts.map