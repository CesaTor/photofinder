import type { Locale } from './types.ts';
export interface AttributionParts {
    title: string;
    creator: string | null;
    license: string;
    licenseUrl: string | null;
    /** Dove è stata trovata l'immagine, es. `"Wikimedia Commons"`. */
    sourceName: string;
    /** Pagina originale dell'immagine; se presente viene aggiunta alla fonte. */
    sourceUrl?: string | null;
}
/**
 * Compone la stringa di attribuzione secondo lo schema TASL raccomandato da
 * Creative Commons (Titolo, Autore, Fonte, Licenza).
 *
 * @example
 * buildAttribution({ title: 'Everest', creator: 'Mario Rossi', license: 'CC BY 4.0',
 *   licenseUrl: 'https://creativecommons.org/licenses/by/4.0', sourceName: 'Wikimedia Commons',
 *   sourceUrl: 'https://commons.wikimedia.org/wiki/File:Everest.jpg' })
 * // '"Everest" di Mario Rossi, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0), tramite Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Everest.jpg)'
 */
export declare function buildAttribution(parts: AttributionParts, locale?: Locale): string;
/** Rimuove i tag HTML e normalizza gli spazi (i metadati di Wikimedia contengono HTML). */
export declare function stripHtml(html: string | undefined | null): string;
//# sourceMappingURL=attribution.d.ts.map