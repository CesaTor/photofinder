import type { Provider } from '../types.ts';
/**
 * `true` se la licenza di un file di Commons consente uso commerciale e modifiche
 * senza obblighi impraticabili: CC0, pubblico dominio, CC BY, CC BY-SA.
 * Esclude NC, ND, fair use e GFDL (che richiede di riportare il testo intero della licenza).
 *
 * @param code valore di `extmetadata.License`, es. `"cc-by-sa-4.0"`
 * @param shortName valore di `extmetadata.LicenseShortName`, es. `"CC BY-SA 4.0"`
 */
export declare function isReusableWikimediaLicense(code?: string | null, shortName?: string | null): boolean;
export interface WikimediaOptions {
    /**
     * File da richiedere per pagina. Il filtro su licenza e formato ne scarta
     * parecchi, quindi i risultati restituiti sono di solito meno. Default: `50`.
     */
    batchSize?: number;
    /** Larghezza dell'anteprima in pixel. Default: `400`. */
    thumbWidth?: number;
}
/**
 * [Wikimedia Commons](https://commons.wikimedia.org): oltre 100 milioni di file,
 * con licenza indicata per ciascuno. Non richiede chiave API, ma Wikimedia chiede
 * uno User-Agent con un contatto (vedi l'opzione `contact` di `PhotoFinder`).
 */
export declare function wikimedia({ batchSize, thumbWidth }?: WikimediaOptions): Provider;
//# sourceMappingURL=wikimedia.d.ts.map