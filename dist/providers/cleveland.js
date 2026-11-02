/**
 * [Cleveland Museum of Art Open Access](https://openaccess-api.clevelandart.org/):
 * opere d'arte. Restituisce solo le opere con immagine CC0 ("unrestricted
 * commercial and noncommercial use"). Non richiede chiave API.
 */
export function cleveland({ pageSize = 20 } = {}) {
    return {
        id: 'cleveland',
        name: 'Cleveland Museum of Art',
        async search(query, { page, fetchJson }) {
            const url = new URL('https://openaccess-api.clevelandart.org/api/artworks/');
            url.search = new URLSearchParams({
                q: query,
                cc0: '1',
                has_image: '1',
                limit: String(pageSize),
                skip: String((page - 1) * pageSize),
            }).toString();
            const data = await fetchJson(url);
            return (data.data ?? []).flatMap((a) => {
                const web = a.images?.web?.url;
                if (a.share_license_status !== 'CC0' || !web)
                    return [];
                return [
                    {
                        id: `cleveland:${a.id}`,
                        provider: 'Cleveland Museum of Art',
                        title: a.title || '',
                        creator: a.creators?.[0]?.description || null,
                        // "print" è 3400px sul lato lungo, "web" 900px.
                        imageUrl: a.images?.print?.url || web,
                        thumbnailUrl: web,
                        sourceUrl: a.url,
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
//# sourceMappingURL=cleveland.js.map