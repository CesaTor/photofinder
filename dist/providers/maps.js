import { buildAttribution, stripHtml } from '../attribution.js';
import { isReusableWikimediaLicense } from './wikimedia.js';
/** Esclude PDF, DjVu, video e audio: qui servono solo immagini. */
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff']);
/** Le 20 regioni italiane, con i nomi usati da Commons (categoria e carte in rilievo). */
const REGIONS = [
    { id: 'abruzzo', aliases: ['abruzzo'], category: 'Abruzzo', relief: 'Abruzzen' },
    { id: 'basilicata', aliases: ['basilicata'], category: 'Basilicata', relief: 'Basilikata' },
    { id: 'calabria', aliases: ['calabria'], category: 'Calabria', relief: 'Kalabrien' },
    { id: 'campania', aliases: ['campania'], category: 'Campania', relief: 'Kampanien' },
    { id: 'emilia-romagna', aliases: ['emilia romagna', 'emilia-romagna'], category: 'Emilia-Romagna', relief: 'Emilia-Romagna' },
    { id: 'friuli-venezia-giulia', aliases: ['friuli venezia giulia', 'friuli-venezia giulia'], category: 'Friuli-Venezia Giulia', relief: 'Friaul-Julisch Venetien' },
    { id: 'lazio', aliases: ['lazio'], category: 'Lazio', relief: 'Latium' },
    { id: 'liguria', aliases: ['liguria'], category: 'Liguria', relief: 'Ligurien' },
    { id: 'lombardia', aliases: ['lombardia', 'lombardy'], category: 'Lombardy', relief: 'Lombardei' },
    { id: 'marche', aliases: ['marche'], category: 'Marche', relief: 'Marken' },
    { id: 'molise', aliases: ['molise'], category: 'Molise', relief: 'Molise' },
    { id: 'piemonte', aliases: ['piemonte', 'piedmont'], category: 'Piedmont', relief: 'Piemont' },
    { id: 'puglia', aliases: ['puglia', 'apulia'], category: 'Apulia', relief: 'Apulien' },
    { id: 'sardegna', aliases: ['sardegna', 'sardinia'], category: 'Sardinia', relief: 'Sardinien' },
    { id: 'sicilia', aliases: ['sicilia', 'sicily'], category: 'Sicily', relief: 'Sizilien' },
    { id: 'toscana', aliases: ['toscana', 'tuscany'], category: 'Tuscany', relief: 'Toskana' },
    { id: 'trentino-alto-adige', aliases: ['trentino alto adige', 'trentino-alto adige', 'trentino south tyrol'], category: 'Trentino-South Tyrol', relief: 'Trentino-Südtirol' },
    { id: 'umbria', aliases: ['umbria'], category: 'Umbria', relief: 'Umbrien' },
    { id: 'valle-aosta', aliases: ["valle d'aosta", 'valle aosta', 'aosta valley'], category: 'Aosta Valley', relief: 'Aostatal' },
    { id: 'veneto', aliases: ['veneto'], category: 'Veneto', relief: 'Venetien' },
];
const KIND_PATTERNS = {
    physical: /\b(fisic[ao]|fisiche|physical|riliev[oi]|relief|orograf\w*|altimetr\w*|montagn\w*|terren[oi])\b/,
    political: /\b(politic[ao]|politiche|political|confini|regions?|region[ei]|provinc\w*|comun[ei]|capital\w*)\b/,
    blank: /\b(mut[ao]|mute|vuot[ao]|bianc[ao]|blank|outline|da colorare)\b/,
    topographic: /\b(topograf\w*|topographic|ctr|igm)\b/,
    satellite: /\b(satellit\w*|satellite)\b/,
    historical: /\b(storic[ao]|storiche|historic\w*|antic[ao]|old|historical)\b/,
};
/** Normalizza accenti, apostrofi e spazi: così "Valle d’Aosta" e "valle d'aosta" coincidono. */
function normalize(value) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}
function containsPhrase(haystack, phrase) {
    const h = normalize(haystack);
    const p = normalize(phrase);
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, 'i').test(h);
}
function detectKind(query) {
    const found = Object.entries(KIND_PATTERNS)
        .filter(([, pattern]) => pattern.test(query))
        .map(([kind]) => kind);
    // "cartina fisica e politica" → tutti i tipi, non solo il primo.
    return found.length === 1 ? found[0] : 'all';
}
function parseIntent(raw) {
    let query = normalize(raw).replace(/^#?cartine\b/, '').trim();
    // "mappa" da sola non deve diventare parte del soggetto; "planisfero" e
    // "mappamondo" restano perché indicano il mondo.
    query = query.replace(/\b(cartina|cartine|mappa|mappe|carta geografica|map|maps)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const kind = detectKind(query);
    const region = REGIONS.find((r) => r.aliases.some((alias) => containsPhrase(query, alias)));
    if (region)
        return { subject: { kind: 'region', region }, kind };
    if (/\b(mondo|world|terra|globo|planisfero|mappamondo|earth)\b/.test(query))
        return { subject: { kind: 'world' }, kind };
    if (/\b(italia|italy|italiano|italiana|italiane)\b/.test(query))
        return { subject: { kind: 'italy' }, kind };
    // "fisica", "politica", "muta" senza soggetto: l'app è italiana, quindi Italia.
    // Una query senza né soggetto né tipo ("gatto") non è una richiesta di cartina.
    return kind === 'all' ? null : { subject: { kind: 'italy' }, kind };
}
function incategory(category, terms) {
    return `incategory:"${category}"${terms ? ` ${terms}` : ''}`;
}
/** Query Commons per soggetto e tipo. Più fonti vengono unite e deduplicate. */
function sourcesFor({ subject, kind }) {
    const sources = [];
    if (subject.kind === 'region') {
        const { category, relief } = subject.region;
        if (kind === 'physical') {
            sources.push({ search: incategory('Relief location maps of Italy', relief), weight: 100 });
            sources.push({ search: incategory(`Topographic maps of ${category}`), weight: 90 });
            sources.push({ search: incategory(`Maps of ${category}`, 'physical'), weight: 60 });
        }
        else if (kind === 'political') {
            sources.push({ search: incategory(`Maps of ${category}`), weight: 100 });
        }
        else if (kind === 'blank') {
            sources.push({ search: incategory('Blank maps of Italy', relief), weight: 100 });
            sources.push({ search: incategory(`Maps of ${category}`, 'blank'), weight: 80 });
        }
        else if (kind === 'topographic') {
            sources.push({ search: incategory(`Topographic maps of ${category}`), weight: 100 });
            sources.push({ search: incategory('Topographic maps of Italy', category), weight: 70 });
            sources.push({ search: incategory('Relief location maps of Italy', relief), weight: 50 });
        }
        else if (kind === 'satellite') {
            sources.push({ search: incategory('Satellite maps of Italy', relief), weight: 100 });
            sources.push({ search: incategory(`Maps of ${category}`, 'satellite'), weight: 70 });
        }
        else if (kind === 'historical') {
            sources.push({ search: incategory(`Old maps of ${category}`), weight: 100 });
        }
        else {
            sources.push({ search: incategory('Relief location maps of Italy', relief), weight: 100 });
            sources.push({ search: incategory(`Topographic maps of ${category}`), weight: 90 });
            sources.push({ search: incategory(`Maps of ${category}`), weight: 80 });
            sources.push({ search: incategory(`Maps of ${category}`, 'blank'), weight: 60 });
        }
        return sources;
    }
    if (subject.kind === 'world') {
        if (kind === 'physical') {
            sources.push({ search: 'intitle:"physical map" world', weight: 100 });
            sources.push({ search: incategory('Topographic maps of the world'), weight: 80 });
            sources.push({ search: incategory('Satellite maps of the world'), weight: 60 });
        }
        else if (kind === 'political') {
            sources.push({ search: incategory('Political maps of the world'), weight: 100 });
            sources.push({ search: 'intitle:"political map" world', weight: 80 });
        }
        else if (kind === 'blank') {
            sources.push({ search: incategory('Blank maps of the world'), weight: 100 });
        }
        else if (kind === 'topographic') {
            sources.push({ search: incategory('Topographic maps of the world'), weight: 100 });
            sources.push({ search: 'intitle:"topographic map" world', weight: 80 });
        }
        else if (kind === 'satellite') {
            sources.push({ search: incategory('Satellite maps of the world'), weight: 100 });
        }
        else if (kind === 'historical') {
            sources.push({ search: incategory('Old maps of the world'), weight: 100 });
        }
        else {
            sources.push({ search: 'intitle:"physical map" world', weight: 100 });
            sources.push({ search: incategory('Political maps of the world'), weight: 90 });
            sources.push({ search: incategory('Topographic maps of the world'), weight: 80 });
            sources.push({ search: incategory('Blank maps of the world'), weight: 70 });
        }
        return sources;
    }
    // Italia
    if (kind === 'physical') {
        sources.push({ search: incategory('Relief location maps of Italy'), weight: 100 });
        sources.push({ search: incategory('Topographic maps of Italy'), weight: 80 });
        sources.push({ search: incategory('Maps of Italy', 'physical'), weight: 50 });
    }
    else if (kind === 'political') {
        sources.push({ search: incategory('Maps of Italy', 'political'), weight: 100 });
        sources.push({ search: incategory('Maps of Italy'), weight: 70 });
    }
    else if (kind === 'blank') {
        sources.push({ search: incategory('Blank maps of Italy'), weight: 100 });
        sources.push({ search: incategory('Maps of Italy', 'blank'), weight: 60 });
    }
    else if (kind === 'topographic') {
        sources.push({ search: incategory('Topographic maps of Italy'), weight: 100 });
        sources.push({ search: incategory('Relief location maps of Italy'), weight: 70 });
    }
    else if (kind === 'satellite') {
        sources.push({ search: incategory('Satellite maps of Italy'), weight: 100 });
        sources.push({ search: incategory('Satellite maps of the world', 'Italy'), weight: 60 });
    }
    else if (kind === 'historical') {
        sources.push({ search: incategory('Old maps of Italy'), weight: 100 });
    }
    else {
        sources.push({ search: incategory('Relief location maps of Italy'), weight: 100 });
        sources.push({ search: incategory('Topographic maps of Italy'), weight: 85 });
        sources.push({ search: incategory('Maps of Italy'), weight: 70 });
        sources.push({ search: incategory('Blank maps of Italy'), weight: 60 });
    }
    return sources;
}
function sourceUrl(source, page, pageSize, thumbWidth) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: source.search,
        gsrlimit: String(pageSize),
        gsroffset: String((page - 1) * pageSize),
        prop: 'imageinfo',
        iiprop: 'url|mime|size|extmetadata',
        iiurlwidth: String(thumbWidth),
        iiextmetadatafilter: 'ObjectName|Artist|License|LicenseShortName|LicenseUrl|AttributionRequired',
    }).toString();
    return url;
}
function score(page, source, intent) {
    const info = page.imageinfo?.[0];
    const title = normalize(`${page.title} ${info?.extmetadata?.ObjectName?.value ?? ''}`);
    let value = source.weight * 1000;
    if (intent.subject.kind === 'region') {
        const { category, relief } = intent.subject.region;
        if (containsPhrase(title, category) || containsPhrase(title, relief))
            value += 800;
    }
    else if (intent.subject.kind === 'italy') {
        if (/\b(italy|italia|italien)\b/.test(title))
            value += 400;
    }
    else if (/\b(world|mondo)\b/.test(title)) {
        value += 400;
    }
    if (intent.kind === 'physical' && /\b(physical|relief|rilievo|fisica)\b/.test(title))
        value += 250;
    if (intent.kind === 'blank' && /\b(blank|muta|mute|outline)\b/.test(title))
        value += 250;
    if (intent.kind === 'political' && /\b(political|politica|regions?|region[ei]|provinces?|province|gemeinden)\b/.test(title))
        value += 250;
    if (intent.kind === 'topographic' && /\b(topographic|topografica|relief)\b/.test(title))
        value += 250;
    if (intent.kind === 'historical' && /\b(old|antique|historic|storica)\b/.test(title))
        value += 250;
    // Fuori tema rispetto al tipo richiesto.
    if (intent.kind !== 'historical' && /\b(old|antique|historic|storica|storico)\b/.test(title))
        value -= 400;
    if (intent.kind !== 'blank' && /\b(blank|muta|mute|outline|vuota)\b/.test(title))
        value -= 200;
    if (intent.kind !== 'physical' && /\b(physical|relief|rilievo|fisica)\b/.test(title))
        value -= 100;
    if (/\b(photo|photograph|fotografia)\b/.test(title))
        value -= 300;
    // Un anno anteriore al 1900, se non si cercano mappe storiche, è quasi sempre una carta d'epoca.
    const year = title.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    if (intent.kind !== 'historical' && year && Number(year[1]) < 1900)
        value -= 300;
    const minSide = Math.min(info?.width ?? 0, info?.height ?? 0);
    // Le mappe troppo piccole sono spesso locator map o anteprime: meglio non metterle in cima.
    if (minSide > 0 && minSide < 400)
        value -= 200;
    value += Math.min(200, minSide / 20);
    return value;
}
function toResult(page, locale) {
    const info = page.imageinfo?.[0];
    if (!info || !info.mime || !IMAGE_MIMES.has(info.mime))
        return null;
    const meta = info.extmetadata ?? {};
    const code = meta.License?.value;
    const shortName = meta.LicenseShortName?.value;
    if (!isReusableWikimediaLicense(code, shortName))
        return null;
    const attributionRequired = meta.AttributionRequired?.value !== 'false';
    const base = {
        id: `maps:${page.pageid}`,
        provider: 'Cartine',
        title: stripHtml(meta.ObjectName?.value) || page.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
        creator: stripHtml(meta.Artist?.value) || null,
        imageUrl: info.url,
        thumbnailUrl: info.thumburl || info.url,
        sourceUrl: info.descriptionurl,
        license: shortName || code || '',
        licenseUrl: meta.LicenseUrl?.value || null,
        attributionRequired,
        width: info.width,
        height: info.height,
    };
    const attribution = attributionRequired
        ? buildAttribution({ ...base, sourceName: 'Wikimedia Commons' }, locale)
        : null;
    return { ...base, attribution };
}
/**
 * Cartine geografiche da Wikimedia Commons: fisiche, politiche, mute,
 * topografiche, satellitari e storiche.
 *
 * Si usa con `kind: 'map'`; non si attiva da solo in una ricerca normale.
 * Riconosce Italia, mondo e le 20 regioni italiane. Le carte in rilievo delle
 * regioni sono nella categoria `Relief location maps of Italy`; le politiche in
 * `Maps of <regione>`; le mute in `Blank maps of Italy` / `Blank maps of the world`.
 *
 * @example
 * const finder = new PhotoFinder();
 * await finder.search('fisica Toscana', { kind: 'map' });
 * await finder.search('politica Italia', { kind: 'map' });
 * await finder.search('muta mondo', { kind: 'map' });
 */
export function maps({ pageSize = 50, thumbWidth = 400 } = {}) {
    const perPage = Math.min(50, Math.max(1, Math.trunc(pageSize)));
    const thumb = Math.min(2048, Math.max(80, Math.trunc(thumbWidth)));
    return {
        id: 'maps',
        name: 'Cartine',
        kinds: ['map'],
        async search(query, { page, locale, fetchJson, kind }) {
            if (kind !== 'map')
                return [];
            const intent = parseIntent(query);
            if (!intent)
                return [];
            const sources = sourcesFor(intent).sort((a, b) => b.weight - a.weight);
            const settled = await Promise.allSettled(sources.map(async (source) => {
                const data = await fetchJson(sourceUrl(source, page, perPage, thumb));
                if (data.error)
                    throw new Error(`Wikimedia: ${data.error.code} (${data.error.info})`);
                return { source, pages: data.query?.pages ?? [] };
            }));
            const fulfilled = settled
                .filter((s) => s.status === 'fulfilled')
                .map((s) => s.value);
            if (fulfilled.length === 0) {
                const first = settled.find((s) => s.status === 'rejected');
                throw first?.reason ?? new Error('Cartine: nessuna risposta da Wikimedia Commons');
            }
            const seen = new Set();
            const candidates = [];
            for (const { source, pages } of fulfilled) {
                for (const page of pages) {
                    if (seen.has(page.pageid))
                        continue;
                    seen.add(page.pageid);
                    candidates.push({ page, score: score(page, source, intent) });
                }
            }
            candidates.sort((a, b) => b.score - a.score);
            return candidates
                .slice(0, perPage)
                .map(({ page }) => toResult(page, locale))
                .filter((r) => r !== null);
        },
    };
}
//# sourceMappingURL=maps.js.map