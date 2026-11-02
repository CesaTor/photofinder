import { buildAttribution } from '../attribution.ts';
import type { ImageResult, Provider } from '../types.ts';

/** Licenze Openverse ammesse: consentono uso commerciale e modifiche. */
const LICENSES: Record<string, { name: string; attribution: boolean }> = {
  cc0: { name: 'CC0', attribution: false },
  pdm: { name: 'Public Domain Mark', attribution: false },
  by: { name: 'CC BY', attribution: true },
  'by-sa': { name: 'CC BY-SA', attribution: true },
};

interface OpenverseImage {
  id: string;
  title: string | null;
  url: string;
  thumbnail: string | null;
  creator: string | null;
  license: string;
  license_version: string | null;
  license_url: string | null;
  foreign_landing_url: string | null;
  source: string | null;
}

interface OpenverseResponse {
  results?: OpenverseImage[];
}

export interface OpenverseOptions {
  /** Risultati per pagina (max 20 senza autenticazione). Default: `20`. */
  pageSize?: number;
}

/**
 * [Openverse](https://api.openverse.org/v1/): aggregatore di immagini Creative
 * Commons e di pubblico dominio (Flickr, musei, Wikimedia e altri).
 * Non richiede chiave API.
 */
export function openverse({ pageSize = 20 }: OpenverseOptions = {}): Provider {
  return {
    id: 'openverse',
    name: 'Openverse',
    async search(query, { page, locale, fetchJson }) {
      const url = new URL('https://api.openverse.org/v1/images/');
      url.search = new URLSearchParams({
        q: query,
        page: String(page),
        page_size: String(pageSize),
        license: Object.keys(LICENSES).join(','),
        mature: 'false',
      }).toString();
      const data = await fetchJson<OpenverseResponse>(url);

      return (data.results ?? []).flatMap((r): ImageResult[] => {
        const lic = LICENSES[r.license];
        if (!lic) return [];
        const license = lic.attribution && r.license_version ? `${lic.name} ${r.license_version}` : lic.name;
        const base = {
          id: `openverse:${r.id}`,
          provider: 'Openverse',
          title: r.title || '',
          creator: r.creator || null,
          imageUrl: r.url,
          thumbnailUrl: r.thumbnail || r.url,
          sourceUrl: r.foreign_landing_url || r.url,
          license,
          licenseUrl: r.license_url || null,
          attributionRequired: lic.attribution,
        };
        const sourceName = r.source ? `${r.source} (Openverse)` : 'Openverse';
        return [{ ...base, attribution: lic.attribution ? buildAttribution({ ...base, sourceName }, locale) : null }];
      });
    },
  };
}
