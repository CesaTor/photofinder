/** Etichette di `freetext.name` che indicano l'autore (le altre sono collezionisti, regioni, ecc.). */
const CREATOR_LABELS = new Set(['Artist', 'Creator', 'Maker', 'Photographer', 'Author', 'Designer', 'Illustrator', 'Engraver', 'Painter']);
/** Caratteri speciali della sintassi Lucene: li togliamo per evitare query malformate. */
const LUCENE_SPECIAL = /[+\-&|!(){}[\]^"~*?:\\/]/g;
/**
 * [Smithsonian Open Access](https://edan.si.edu/openaccess/apidocs/): milioni di
 * immagini dai musei e archivi Smithsonian, tramite le EDAN Open Access API.
 * Restituisce solo i media marcati CC0.
 *
 * Richiede una chiave gratuita (limite predefinito: 1000 richieste all'ora per
 * chiave, condiviso tra tutte le API di api.data.gov).
 */
export function smithsonian({ apiKey, pageSize = 20, thumbSize = 400 }) {
    if (!apiKey)
        throw new TypeError('smithsonian(): `apiKey` è obbligatoria (registrati su https://api.data.gov/signup/)');
    return {
        id: 'smithsonian',
        name: 'Smithsonian',
        async search(query, { page, fetchJson }) {
            const terms = query.replace(LUCENE_SPECIAL, ' ').trim();
            if (!terms)
                return [];
            const url = new URL('https://api.si.edu/openaccess/api/v1.0/search');
            url.search = new URLSearchParams({
                q: `(${terms}) AND media_usage:CC0 AND online_media_type:Images`,
                rows: String(pageSize),
                start: String((page - 1) * pageSize),
                api_key: apiKey,
            }).toString();
            const data = await fetchJson(url);
            return (data.response?.rows ?? []).flatMap((r) => {
                const dn = r.content.descriptiveNonRepeating;
                const media = dn?.online_media?.media?.find((m) => m.type === 'Images' && m.usage?.access === 'CC0' && m.content && m.idsId);
                if (!media || !media.content || !media.idsId)
                    return [];
                const creator = r.content.freetext?.name?.find((n) => n.label && CREATOR_LABELS.has(n.label))?.content;
                return [
                    {
                        id: `smithsonian:${r.id}`,
                        provider: 'Smithsonian',
                        title: r.title || '',
                        creator: creator || null,
                        imageUrl: media.content,
                        thumbnailUrl: `https://ids.si.edu/ids/deliveryService?id=${encodeURIComponent(media.idsId)}&max=${thumbSize}`,
                        sourceUrl: dn?.record_link || media.content,
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
//# sourceMappingURL=smithsonian.js.map