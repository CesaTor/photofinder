import { buildAttribution } from '../attribution.js';
/** Converte la dimensione di `webformatURL`: `_640` → 340px sul lato lungo. */
function thumbUrl(hit) {
    const web = hit.webformatURL;
    if (web)
        return web.replace(/_640(\.[a-z]+)$/i, '_340$1');
    return hit.previewURL || hit.largeImageURL || '';
}
/**
 * [Pixabay](https://pixabay.com/api/docs/): oltre 6 milioni di foto,
 * illustrazioni e vettoriali con la Pixabay Content License.
 *
 * La licenza consente uso commerciale e modifiche senza obbligo di attribuzione,
 * ma i termini dell'API chiedono di indicare Pixabay come fonte accanto ai
 * risultati: `attribution` è quindi sempre valorizzata, anche se
 * `attributionRequired` resta `false`.
 *
 * Richiede una chiave API gratuita (100 richieste/minuto per chiave). Il piano
 * standard non espone l'immagine originale: `imageUrl` è la versione da 1280px.
 * I termini dell'API chiedono inoltre di conservare le risposte in cache per
 * 24 ore e di non collegare permanentemente (`hotlink`) le immagini.
 */
export function pixabay({ apiKey, pageSize = 20, imageType = 'photo', safeSearch = true, }) {
    if (!apiKey)
        throw new TypeError('pixabay(): `apiKey` è obbligatoria (la trovi su https://pixabay.com/api/docs/)');
    // L'API accetta `per_page` solo tra 3 e 200.
    const perPage = Number.isFinite(pageSize) ? Math.min(200, Math.max(3, Math.trunc(pageSize))) : 20;
    return {
        id: 'pixabay',
        name: 'Pixabay',
        async search(query, { page, locale, fetchJson }) {
            const url = new URL('https://pixabay.com/api/');
            url.search = new URLSearchParams({
                key: apiKey,
                // L'API tronca comunque a 100 caratteri: evitiamo di inviare una query rifiutata.
                q: query.slice(0, 100),
                lang: locale,
                image_type: imageType,
                safesearch: String(safeSearch),
                page: String(page),
                per_page: String(perPage),
            }).toString();
            const data = await fetchJson(url);
            return (data.hits ?? []).flatMap((h) => {
                const imageUrl = h.imageURL || h.largeImageURL || h.webformatURL;
                if (!imageUrl || !h.pageURL)
                    return [];
                const base = {
                    id: `pixabay:${h.id}`,
                    provider: 'Pixabay',
                    // Pixabay non ha un titolo: il primo tag è la descrizione più breve disponibile.
                    title: h.tags?.split(',')[0]?.trim() || '',
                    creator: h.user || null,
                    imageUrl,
                    thumbnailUrl: thumbUrl(h) || imageUrl,
                    sourceUrl: h.pageURL,
                    license: 'Pixabay Content License',
                    licenseUrl: 'https://pixabay.com/service/license-summary/',
                    attributionRequired: false,
                };
                // La licenza non obbliga ad attribuire, ma l'API chiede di mostrare la fonte.
                return [{ ...base, attribution: buildAttribution({ ...base, sourceName: 'Pixabay' }, locale) }];
            });
        },
    };
}
//# sourceMappingURL=pixabay.js.map