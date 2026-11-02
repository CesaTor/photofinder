import type { Provider } from '../types.ts';
export interface OpenverseOptions {
    /** Risultati per pagina (max 20 senza autenticazione). Default: `20`. */
    pageSize?: number;
}
/**
 * [Openverse](https://api.openverse.org/v1/): aggregatore di immagini Creative
 * Commons e di pubblico dominio (Flickr, musei, Wikimedia e altri).
 * Non richiede chiave API.
 */
export declare function openverse({ pageSize }?: OpenverseOptions): Provider;
//# sourceMappingURL=openverse.d.ts.map