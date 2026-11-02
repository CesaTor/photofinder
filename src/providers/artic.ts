import type { ImageResult, Provider } from '../types.ts';

const IIIF = 'https://www.artic.edu/iiif/2';

interface ArticArtwork {
  id: number;
  title: string | null;
  artist_title: string | null;
  image_id: string | null;
  is_public_domain: boolean;
}

interface ArticSearchResponse {
  data?: ArticArtwork[];
}

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
export function artic({ pageSize = 20 }: ArticOptions = {}): Provider {
  return {
    id: 'artic',
    name: 'Art Institute of Chicago',
    async search(query, { page, userAgent, fetchJson }) {
      const url = new URL('https://api.artic.edu/api/v1/artworks/search');
      url.search = new URLSearchParams({
        q: query,
        page: String(page),
        limit: String(pageSize),
        // Il campo `description` è CC BY 4.0 (il resto dei dati è CC0): non lo richiediamo.
        fields: 'id,title,artist_title,image_id,is_public_domain',
        'query[term][is_public_domain]': 'true',
      }).toString();
      const data = await fetchJson<ArticSearchResponse>(url, { headers: { 'AIC-User-Agent': userAgent } });

      return (data.data ?? []).flatMap((a): ImageResult[] => {
        if (!a.is_public_domain || !a.image_id) return [];
        return [
          {
            id: `artic:${a.id}`,
            provider: 'Art Institute of Chicago',
            title: a.title || '',
            creator: a.artist_title || null,
            // 843px è la dimensione raccomandata dalla documentazione IIIF del museo.
            imageUrl: `${IIIF}/${a.image_id}/full/843,/0/default.jpg`,
            thumbnailUrl: `${IIIF}/${a.image_id}/full/200,/0/default.jpg`,
            sourceUrl: `https://www.artic.edu/artworks/${a.id}`,
            license: 'CC0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
            attributionRequired: false,
            attribution: null,
          },
        ];
      });
    },
  };
}
