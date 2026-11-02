import type { ImageResult, Provider } from '../types.ts';

const API = 'https://collectionapi.metmuseum.org/public/collection';

interface MetSearchResponse {
  total: number;
  /** Attenzione: è `null` (non `[]`) quando non ci sono risultati. */
  objectIDs: number[] | null;
}

interface MetObject {
  objectID: number;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall: string;
  title: string;
  artistDisplayName: string;
  objectURL: string;
}

export interface MetOptions {
  /**
   * Opere da richiedere per pagina. La ricerca restituisce solo ID, quindi per
   * ognuna serve una richiesta in più: valori alti rallentano. Default: `12`.
   */
  batchSize?: number;
}

/**
 * [The Metropolitan Museum of Art](https://metmuseum.github.io/): opere d'arte
 * e oggetti storici. Restituisce solo le opere `isPublicDomain`, rilasciate in CC0.
 * Non richiede chiave API.
 */
export function met({ batchSize = 12 }: MetOptions = {}): Provider {
  return {
    id: 'met',
    name: 'The Met',
    async search(query, { page, fetchJson }) {
      // La vecchia /v1/search è stata dismessa il 2026-10-01.
      const url = new URL(`${API}/v1.1/search`);
      url.search = new URLSearchParams({
        q: query,
        hasImages: 'true',
        limit: String(batchSize),
        offset: String((page - 1) * batchSize),
      }).toString();
      const ids = (await fetchJson<MetSearchResponse>(url)).objectIDs ?? [];

      const objects = await Promise.allSettled(ids.map((id) => fetchJson<MetObject>(`${API}/v1/objects/${id}`)));

      return objects.flatMap((o): ImageResult[] => {
        if (o.status !== 'fulfilled') return [];
        const obj = o.value;
        if (!obj.isPublicDomain || !obj.primaryImageSmall) return [];
        return [
          {
            id: `met:${obj.objectID}`,
            provider: 'The Met',
            title: obj.title || '',
            creator: obj.artistDisplayName || null,
            imageUrl: obj.primaryImage || obj.primaryImageSmall,
            thumbnailUrl: obj.primaryImageSmall,
            sourceUrl: obj.objectURL,
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
