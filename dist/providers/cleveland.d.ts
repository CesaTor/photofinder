import type { Provider } from '../types.ts';
export interface ClevelandOptions {
    /** Opere per pagina. Default: `20`. */
    pageSize?: number;
}
/**
 * [Cleveland Museum of Art Open Access](https://openaccess-api.clevelandart.org/):
 * opere d'arte. Restituisce solo le opere con immagine CC0 ("unrestricted
 * commercial and noncommercial use"). Non richiede chiave API.
 */
export declare function cleveland({ pageSize }?: ClevelandOptions): Provider;
//# sourceMappingURL=cleveland.d.ts.map