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

const WORDS: Record<Locale, { untitled: string; by: string; via: string }> = {
  it: { untitled: 'Senza titolo', by: 'di', via: 'tramite' },
  en: { untitled: 'Untitled', by: 'by', via: 'via' },
};

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
export function buildAttribution(parts: AttributionParts, locale: Locale = 'it'): string {
  const w = WORDS[locale];
  let s = `"${parts.title || w.untitled}"`;
  if (parts.creator) s += ` ${w.by} ${parts.creator}`;
  s += `, ${parts.license}`;
  if (parts.licenseUrl) s += ` (${parts.licenseUrl})`;
  s += `, ${w.via} ${parts.sourceName}`;
  if (parts.sourceUrl) s += ` (${parts.sourceUrl})`;
  return s;
}

/** Rimuove i tag HTML e normalizza gli spazi (i metadati di Wikimedia contengono HTML). */
export function stripHtml(html: string | undefined | null): string {
  return (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
