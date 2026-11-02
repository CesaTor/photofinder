import type { Provider } from '../types.ts';
export interface SmithsonianOptions {
    /** Chiave gratuita di [api.data.gov](https://api.data.gov/signup/). Obbligatoria. */
    apiKey: string;
    /** Risultati per pagina. Default: `20`. */
    pageSize?: number;
    /** Lato lungo massimo dell'anteprima in pixel. Default: `400`. */
    thumbSize?: number;
}
/**
 * [Smithsonian Open Access](https://www.si.edu/openaccess): milioni di immagini
 * dai musei e archivi Smithsonian. Restituisce solo i media marcati CC0.
 *
 * Richiede una chiave gratuita di api.data.gov (limite predefinito: 1000
 * richieste all'ora per chiave, condiviso tra tutte le API di api.data.gov).
 */
export declare function smithsonian({ apiKey, pageSize, thumbSize }: SmithsonianOptions): Provider;
//# sourceMappingURL=smithsonian.d.ts.map