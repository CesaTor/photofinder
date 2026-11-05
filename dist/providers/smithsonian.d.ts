import type { Provider } from '../types.ts';
export interface SmithsonianOptions {
    /** Chiave gratuita delle [EDAN Open Access API](https://edan.si.edu/openaccess/apidocs/) (la stessa di api.data.gov). Obbligatoria. */
    apiKey: string;
    /** Risultati per pagina. Default: `20`. */
    pageSize?: number;
    /** Lato lungo massimo dell'anteprima in pixel. Default: `400`. */
    thumbSize?: number;
}
/**
 * [Smithsonian Open Access](https://edan.si.edu/openaccess/apidocs/): milioni di
 * immagini dai musei e archivi Smithsonian, tramite le EDAN Open Access API.
 * Restituisce solo i media marcati CC0.
 *
 * Richiede una chiave gratuita (limite predefinito: 1000 richieste all'ora per
 * chiave, condiviso tra tutte le API di api.data.gov).
 */
export declare function smithsonian({ apiKey, pageSize, thumbSize }: SmithsonianOptions): Provider;
//# sourceMappingURL=smithsonian.d.ts.map