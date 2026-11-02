import { buildAttribution, stripHtml } from '../attribution.ts';
import type { ImageResult, Provider } from '../types.ts';

/** Esclude PDF, DjVu (documenti scansionati), video e audio. */
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff']);

/**
 * `true` se la licenza di un file di Commons consente uso commerciale e modifiche
 * senza obblighi impraticabili: CC0, pubblico dominio, CC BY, CC BY-SA.
 * Esclude NC, ND, fair use e GFDL (che richiede di riportare il testo intero della licenza).
 *
 * @param code valore di `extmetadata.License`, es. `"cc-by-sa-4.0"`
 * @param shortName valore di `extmetadata.LicenseShortName`, es. `"CC BY-SA 4.0"`
 */
export function isReusableWikimediaLicense(code?: string | null, shortName?: string | null): boolean {
  const s = `${code ?? ''} ${shortName ?? ''}`.toLowerCase();
  if (/-nc|-nd|\bnc\b|\bnd\b|fair use|non-free|copyrighted/.test(s)) return false;
  return /\bcc0\b|\bpd\b|^pd-|public domain|cc-by-(sa-)?\d|cc by(-sa)? \d/.test(s);
}

interface MetaValue {
  value?: string;
}

interface WikimediaPage {
  pageid: number;
  title: string;
  index: number;
  imageinfo?: Array<{
    url: string;
    thumburl?: string;
    descriptionurl: string;
    mime?: string;
    extmetadata?: Partial<
      Record<'ObjectName' | 'Artist' | 'License' | 'LicenseShortName' | 'LicenseUrl' | 'AttributionRequired', MetaValue>
    >;
  }>;
}

interface WikimediaResponse {
  query?: { pages?: WikimediaPage[] };
  /** MediaWiki segnala gli errori con HTTP 200 e questo campo. */
  error?: { code: string; info: string };
}

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
export function wikimedia({ batchSize = 50, thumbWidth = 400 }: WikimediaOptions = {}): Provider {
  return {
    id: 'wikimedia',
    name: 'Wikimedia Commons',
    async search(query, { page, locale, fetchJson }) {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        generator: 'search',
        gsrnamespace: '6',
        // Niente `filetype:bitmap`: escluderebbe gli SVG (cartine, schemi). Il formato si filtra per MIME.
        gsrsearch: query,
        gsrlimit: String(batchSize),
        gsroffset: String((page - 1) * batchSize),
        prop: 'imageinfo',
        iiprop: 'url|mime|extmetadata',
        iiurlwidth: String(thumbWidth),
        iiextmetadatafilter: 'ObjectName|Artist|License|LicenseShortName|LicenseUrl|AttributionRequired',
      }).toString();
      const data = await fetchJson<WikimediaResponse>(url);
      // Es. `cirrussearch-too-busy-error`: senza questo controllo sembrerebbe una ricerca senza risultati.
      if (data.error) throw new Error(`Wikimedia: ${data.error.code} (${data.error.info})`);
      const pages = [...(data.query?.pages ?? [])].sort((a, b) => a.index - b.index);

      return pages.flatMap((p): ImageResult[] => {
        const info = p.imageinfo?.[0];
        if (!info || !info.mime || !IMAGE_MIMES.has(info.mime)) return [];
        const m = info.extmetadata ?? {};
        const code = m.License?.value;
        const shortName = m.LicenseShortName?.value;
        if (!isReusableWikimediaLicense(code, shortName)) return [];

        const attributionRequired = m.AttributionRequired?.value !== 'false';
        const base = {
          id: `wikimedia:${p.pageid}`,
          provider: 'Wikimedia Commons',
          title: stripHtml(m.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
          creator: stripHtml(m.Artist?.value) || null,
          imageUrl: info.url,
          thumbnailUrl: info.thumburl || info.url,
          sourceUrl: info.descriptionurl,
          license: shortName || code || '',
          licenseUrl: m.LicenseUrl?.value || null,
          attributionRequired,
        };
        const attribution = attributionRequired
          ? buildAttribution({ ...base, sourceName: 'Wikimedia Commons' }, locale)
          : null;
        return [{ ...base, attribution }];
      });
    },
  };
}
