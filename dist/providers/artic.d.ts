import type { Provider } from '../types.ts';
export interface ArticOptions {
    /** Opere per pagina. Default: `20`. */
    pageSize?: number;
}
/**
 * [Art Institute of Chicago](https://api.artic.edu/docs/): opere d'arte e
 * fotografie. Restituisce solo le opere `is_public_domain`, che il museo
 * rilascia in CC0. Non richiede chiave API.
 *
 * ⚠️ Non incluso nei provider di default: a novembre 2026 il server immagini
 * (www.artic.edu/iiif) risponde 403 ("Sorry, you have been blocked") e
 * `Cross-Origin-Resource-Policy: same-origin`, quindi le immagini non si possono
 * mostrare su altri siti. Problema noto:
 * https://github.com/art-institute-of-chicago/api-data/issues/9
 *
 * Limiti indicati nella documentazione: 60 richieste al minuto per gli utenti
 * anonimi e un header `AIC-User-Agent` con nome del progetto e contatto (inviato
 * in automatico, con lo stesso valore dello User-Agent).
 */
export declare function artic({ pageSize }?: ArticOptions): Provider;
//# sourceMappingURL=artic.d.ts.map