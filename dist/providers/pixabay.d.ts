import type { Provider } from '../types.ts';
export interface PixabayOptions {
    /** Chiave API gratuita, disponibile su [pixabay.com/api/docs](https://pixabay.com/api/docs/). Obbligatoria. */
    apiKey: string;
    /** Risultati per pagina, da 3 a 200. Default: `20`. */
    pageSize?: number;
    /** Tipo di immagine: foto, illustrazioni, vettoriali o tutti. Default: `'photo'`. */
    imageType?: 'all' | 'photo' | 'illustration' | 'vector';
    /** Esclude i contenuti non adatti a tutti. Default: `true`. */
    safeSearch?: boolean;
}
/**
 * [Pixabay](https://pixabay.com/api/docs/): oltre 6 milioni di foto,
 * illustrazioni e vettoriali con la Pixabay Content License.
 *
 * La licenza consente uso commerciale e modifiche senza obbligo di attribuzione,
 * ma i termini dell'API chiedono di indicare Pixabay come fonte accanto ai
 * risultati: `attribution` è quindi sempre valorizzata, anche se
 * `attributionRequired` resta `false`.
 *
 * Richiede una chiave API gratuita (100 richieste/minuto per chiave). Il piano
 * standard non espone l'immagine originale: `imageUrl` è la versione da 1280px.
 * I termini dell'API chiedono inoltre di conservare le risposte in cache per
 * 24 ore e di non collegare permanentemente (`hotlink`) le immagini.
 */
export declare function pixabay({ apiKey, pageSize, imageType, safeSearch, }: PixabayOptions): Provider;
//# sourceMappingURL=pixabay.d.ts.map