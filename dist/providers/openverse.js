import { buildAttribution } from '../attribution.js';
/** Licenze Openverse ammesse: consentono uso commerciale e modifiche. */
const LICENSES = {
    cc0: { name: 'CC0', attribution: false },
    pdm: { name: 'Public Domain Mark', attribution: false },
    by: { name: 'CC BY', attribution: true },
    'by-sa': { name: 'CC BY-SA', attribution: true },
};
/**
 * [Openverse](https://api.openverse.org/v1/): aggregatore di immagini Creative
 * Commons e di pubblico dominio (Flickr, musei, Wikimedia e altri).
 * Non richiede chiave API.
 */
export function openverse({ pageSize = 20 } = {}) {
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
            const data = await fetchJson(url);
            return (data.results ?? []).flatMap((r) => {
                const lic = LICENSES[r.license];
                if (!lic)
                    return [];
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
//# sourceMappingURL=openverse.js.map