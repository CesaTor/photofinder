import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFetchJson } from '../src/http.ts';
import { artic, cleveland, isReusableWikimediaLicense, maps, met, openverse, PhotoFinder, pixabay, smithsonian, wikimedia } from '../src/index.ts';
import type { Locale, ProviderContext, SearchKind } from '../src/index.ts';
import {
  articFixture,
  clevelandFixture,
  metEmptyFixture,
  metObjects,
  metSearchFixture,
  mockFetch,
  mapsFixture,
  openverseFixture,
  pixabayFixture,
  smithsonianFixture,
  wikimediaFixture,
  type Route,
} from './helpers.ts';

function ctx(routes: Route[], { page = 1, locale = 'it' as Locale, kind = 'image' as SearchKind } = {}) {
  const mock = mockFetch(routes);
  const context: ProviderContext = {
    page,
    locale,
    kind,
    userAgent: 'test-agent (dev@example.com)',
    fetchJson: createFetchJson({ fetch: mock.fetch, userAgent: 'test', timeoutMs: 1000 }),
  };
  return { context, calls: mock.calls };
}

describe('openverse', () => {
  it('chiede solo licenze riutilizzabili e scarta le altre', async () => {
    const { context, calls } = ctx([{ match: 'api.openverse.org', body: openverseFixture }]);
    const results = await openverse().search('toscana', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('license'), 'cc0,pdm,by,by-sa');
    assert.equal(url.searchParams.get('mature'), 'false');
    assert.deepEqual(results.map((r) => r.id), ['openverse:ov-1', 'openverse:ov-2']);
  });

  it('genera l\'attribuzione solo per CC BY / CC BY-SA', async () => {
    const { context } = ctx([{ match: 'api.openverse.org', body: openverseFixture }]);
    const [by, cc0] = await openverse().search('toscana', context);

    assert.equal(by.license, 'CC BY 2.0');
    assert.equal(by.attributionRequired, true);
    assert.equal(
      by.attribution,
      '"Monte Amiata" di Anna Bianchi, CC BY 2.0 (https://creativecommons.org/licenses/by/2.0/), tramite flickr (Openverse) (https://www.flickr.com/photos/x/1)'
    );
    assert.equal(cc0.license, 'CC0');
    assert.equal(cc0.attribution, null);
    assert.equal(cc0.thumbnailUrl, cc0.imageUrl, 'senza anteprima usa l\'immagine originale');
  });
});

describe('wikimedia', () => {
  it('tiene solo immagini con licenza riutilizzabile, nell\'ordine di rilevanza', async () => {
    const { context } = ctx([{ match: 'commons.wikimedia.org', body: wikimediaFixture }]);
    const results = await wikimedia().search('cartina toscana', context);

    assert.deepEqual(
      results.map((r) => r.title),
      ['Cartina della Toscana', 'Cartina Toscana'],
      'scarta PDF, DjVu, NC e GFDL; include gli SVG'
    );
  });

  it('pulisce l\'HTML dell\'autore e costruisce l\'attribuzione', async () => {
    const { context } = ctx([{ match: 'commons.wikimedia.org', body: wikimediaFixture }], { locale: 'en' });
    const [byImage, pdImage] = await wikimedia().search('cartina toscana', context);

    assert.equal(byImage.creator, 'Mario & Rossi');
    assert.equal(
      byImage.attribution,
      '"Cartina della Toscana" by Mario & Rossi, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0), via Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Cartina%20della%20Toscana.jpg)'
    );
    assert.equal(pdImage.attributionRequired, false);
    assert.equal(pdImage.attribution, null);
  });

  it('pagina con offset basato su batchSize e non filtra per filetype', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: wikimediaFixture }], { page: 3 });
    await wikimedia({ batchSize: 10 }).search('cartina toscana', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('gsrlimit'), '10');
    assert.equal(url.searchParams.get('gsroffset'), '20');
    assert.equal(url.searchParams.get('gsrsearch'), 'cartina toscana');
  });

  it('gestisce una ricerca senza risultati', async () => {
    const { context } = ctx([{ match: 'commons.wikimedia.org', body: { batchcomplete: true } }]);
    assert.deepEqual(await wikimedia().search('xqzpt', context), []);
  });

  it('trasforma gli errori MediaWiki (HTTP 200 con campo error) in eccezioni', async () => {
    const body = { error: { code: 'cirrussearch-too-busy-error', info: 'Search is currently too busy.' } };
    const { context } = ctx([{ match: 'commons.wikimedia.org', body }]);
    await assert.rejects(wikimedia().search('map tuscany', context), /cirrussearch-too-busy-error/);
  });
});

describe('isReusableWikimediaLicense', () => {
  const cases: Array<[string, string, boolean]> = [
    ['cc0', 'CC0', true],
    ['pd', 'Public domain', true],
    ['cc-by-4.0', 'CC BY 4.0', true],
    ['cc-by-sa-2.5', 'CC BY-SA 2.5', true],
    ['cc-by-2.0-fr', 'CC BY 2.0 fr', true],
    ['cc-by-nc-4.0', 'CC BY-NC 4.0', false],
    ['cc-by-nd-4.0', 'CC BY-ND 4.0', false],
    ['cc-by-nc-sa-3.0', 'CC BY-NC-SA 3.0', false],
    ['', 'GFDL 1.2', false],
    ['', 'Fair use', false],
    ['', '', false],
  ];
  for (const [code, name, expected] of cases) {
    it(`${name || '(vuota)'} → ${expected}`, () => assert.equal(isReusableWikimediaLicense(code, name), expected));
  }
});

describe('met', () => {
  it('restituisce solo opere di pubblico dominio come CC0 senza attribuzione', async () => {
    const { context } = ctx([
      { match: 'v1.1/search', body: metSearchFixture },
      { match: '/v1/objects/1', body: metObjects[1] },
      { match: '/v1/objects/2', body: metObjects[2] },
      // L'oggetto 3 risponde 404: va ignorato senza far fallire la ricerca.
    ]);
    const results = await met().search('veduta', context);

    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'met:1');
    assert.equal(results[0].license, 'CC0');
    assert.equal(results[0].attribution, null);
    assert.equal(results[0].creator, null);
  });

  it('gestisce objectIDs: null quando non ci sono risultati', async () => {
    const { context, calls } = ctx([{ match: 'v1.1/search', body: metEmptyFixture }]);
    assert.deepEqual(await met().search('cartina toscana', context), []);
    assert.equal(calls.length, 1);
  });
});

describe('artic', () => {
  it('filtra il pubblico dominio nella query e invia AIC-User-Agent', async () => {
    const { context, calls } = ctx([{ match: 'api.artic.edu', body: articFixture }], { page: 2 });
    const results = await artic({ pageSize: 10 }).search('tuscany', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('query[term][is_public_domain]'), 'true');
    assert.equal(url.searchParams.get('page'), '2');
    assert.ok(!url.searchParams.get('fields')!.includes('description'), 'description è CC BY: non va richiesta');
    assert.equal(calls[0].headers['AIC-User-Agent'], 'test-agent (dev@example.com)');

    assert.deepEqual(results.map((r) => r.id), ['artic:28'], 'scarta opere senza immagine o non PD');
    assert.equal(results[0].imageUrl, 'https://www.artic.edu/iiif/2/img-28/full/843,/0/default.jpg');
    assert.equal(results[0].sourceUrl, 'https://www.artic.edu/artworks/28');
    assert.equal(results[0].attribution, null);
  });
});

describe('cleveland', () => {
  it('chiede solo opere CC0 con immagine e usa print come immagine piena', async () => {
    const { context, calls } = ctx([{ match: 'openaccess-api.clevelandart.org', body: clevelandFixture }], { page: 3 });
    const results = await cleveland({ pageSize: 5 }).search('tuscany', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('cc0'), '1');
    assert.equal(url.searchParams.get('has_image'), '1');
    assert.equal(url.searchParams.get('skip'), '10');

    assert.equal(results.length, 1);
    assert.equal(results[0].creator, 'Battista di Biagio Sanguigni (Italian, active 1393–1451)');
    assert.match(results[0].imageUrl, /_print\.jpg$/);
    assert.match(results[0].thumbnailUrl, /_web\.jpg$/);
    assert.equal(results[0].license, 'CC0');
  });
});

describe('pixabay', () => {
  it('richiede la chiave API', () => {
    assert.throws(() => pixabay({ apiKey: '' }), /apiKey/);
  });

  it('invia chiave, lingua, filtri e paginazione', async () => {
    const { context, calls } = ctx([{ match: 'pixabay.com/api', body: pixabayFixture }], { page: 2 });
    await pixabay({ apiKey: 'SEGRETA', pageSize: 30 }).search('tuscany', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('key'), 'SEGRETA');
    assert.equal(url.searchParams.get('q'), 'tuscany');
    assert.equal(url.searchParams.get('lang'), 'it');
    assert.equal(url.searchParams.get('image_type'), 'photo');
    assert.equal(url.searchParams.get('safesearch'), 'true');
    assert.equal(url.searchParams.get('page'), '2');
    assert.equal(url.searchParams.get('per_page'), '30');
  });

  it('mappa i risultati e usa il piano gratuito (1280px) come immagine piena', async () => {
    const { context } = ctx([{ match: 'pixabay.com/api', body: pixabayFixture }]);
    const results = await pixabay({ apiKey: 'k' }).search('tuscany', context);

    assert.deepEqual(results.map((r) => r.id), ['pixabay:8345688', 'pixabay:42', 'pixabay:7']);
    const [first, fullAccess] = results;

    assert.equal(first.title, 'florence', 'usa il primo tag come titolo');
    assert.equal(first.creator, 'Elisabetta_Miele');
    assert.equal(first.imageUrl, 'https://pixabay.com/get/abc_1280.jpg');
    assert.equal(first.thumbnailUrl, 'https://pixabay.com/get/abc_340.jpg');
    assert.equal(first.sourceUrl, 'https://pixabay.com/photos/florence-8345688/');
    assert.equal(first.license, 'Pixabay Content License');

    assert.equal(fullAccess.imageUrl, 'https://pixabay.com/get/def_4000.jpg', 'con accesso completo usa l\'originale');
    assert.equal(fullAccess.attributionRequired, false);
    assert.equal(
      fullAccess.attribution,
      '"cartina" di MarioRossi, Pixabay Content License (https://pixabay.com/service/license-summary/), tramite Pixabay (https://pixabay.com/photos/map-42/)',
      'la licenza non obbliga, ma l\'API chiede di indicare la fonte'
    );

    assert.equal(results[2].title, '');
    assert.equal(results[2].creator, null);
    assert.equal(results[2].thumbnailUrl, 'https://pixabay.com/get/ghi_340.jpg');
  });

  it('limita per_page tra 3 e 200 e la query a 100 caratteri', async () => {
    const { context, calls } = ctx([{ match: 'pixabay.com/api', body: pixabayFixture }]);
    await pixabay({ apiKey: 'k', pageSize: 1 }).search('x'.repeat(150), context);
    await pixabay({ apiKey: 'k', pageSize: 1000 }).search('x', context);

    assert.equal(new URL(calls[0].url).searchParams.get('per_page'), '3');
    assert.equal(new URL(calls[0].url).searchParams.get('q'), 'x'.repeat(100));
    assert.equal(new URL(calls[1].url).searchParams.get('per_page'), '200');
  });

  it('permette di disattivare il filtro per contenuti per tutti', async () => {
    const { context, calls } = ctx([{ match: 'pixabay.com/api', body: pixabayFixture }]);
    await pixabay({ apiKey: 'k', safeSearch: false, imageType: 'illustration' }).search('gatto', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('safesearch'), 'false');
    assert.equal(url.searchParams.get('image_type'), 'illustration');
  });

  it('non espone la chiave API negli errori', async () => {
    const { context } = ctx([{ match: 'pixabay.com/api', status: 400 }]);
    await assert.rejects(pixabay({ apiKey: 'SEGRETA' }).search('x', context), (err: Error & { url: string }) => {
      assert.ok(!err.url.includes('SEGRETA'));
      assert.match(err.url, /key=\*\*\*/);
      return true;
    });
  });
});

describe('maps', () => {
  it('non interroga Commons se kind non è "map"', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'image' });
    assert.deepEqual(maps().kinds, ['map']);
    assert.deepEqual(await maps().search('fisica Toscana', context), []);
    assert.equal(calls.length, 0);
  });

  it('con kind "map" ma query non pertinente non fa richieste', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    assert.deepEqual(await maps().search('gatto', context), []);
    assert.equal(calls.length, 0);
  });

  it('traduce "fisica Toscana" nelle categorie giuste', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    const results = await maps().search('fisica Toscana', context);
    const searches = calls.map((c) => new URL(c.url).searchParams.get('gsrsearch'));

    assert.ok(searches.includes('incategory:"Relief location maps of Italy" Toskana'));
    assert.ok(searches.includes('incategory:"Topographic maps of Tuscany"'));
    assert.ok(searches.includes('incategory:"Maps of Tuscany" physical'));

    assert.equal(results[0].id, 'maps:1');
    assert.equal(results[0].title, 'Relief map of Italien Toskana');
    assert.equal(results[0].width, 3333);
    assert.equal(results[0].height, 3703);
    assert.equal(results[0].creator, 'Autore', 'pulisce l\'HTML dell\'autore');
    assert.match(results[0].attribution!, /CC BY-SA 3.0/);
  });

  it('riconosce le maiuscole', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    await maps().search('Fisica Toscana', context);
    const searches = calls.map((c) => new URL(c.url).searchParams.get('gsrsearch'));
    assert.ok(searches.includes('incategory:"Relief location maps of Italy" Toskana'));
  });

  it('gestisce i nomi con accenti', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    await maps().search('fisica Trentino-Alto Adige', context);
    const searches = calls.map((c) => new URL(c.url).searchParams.get('gsrsearch'));
    assert.ok(searches.includes('incategory:"Relief location maps of Italy" Trentino-Südtirol'));
  });

  it('esclude le licenze non riutilizzabili e i file non immagine', async () => {
    const { context } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    const results = await maps().search('fisica Toscana', context);
    const ids = results.map((r) => r.id);

    assert.ok(!ids.includes('maps:6'), 'CC BY-NC va scartata');
    assert.ok(!ids.includes('maps:7'), 'il PDF va scartato');
    assert.equal(results.find((r) => r.id === 'maps:8')?.attribution, null, 'pubblico dominio senza attribuzione');
  });

  it('copre politica, muta, mondo e storico', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    await maps().search('politica Italia', context);
    await maps().search('muta mondo', context);
    await maps().search('storica Toscana', context);

    const searches = calls.map((c) => new URL(c.url).searchParams.get('gsrsearch'));
    assert.ok(searches.includes('incategory:"Maps of Italy" political'));
    assert.ok(searches.includes('incategory:"Blank maps of the world"'));
    assert.ok(searches.includes('incategory:"Old maps of Tuscany"'));
  });

  it('riconosce planisfero e mappamondo come mondo', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    await maps().search('fisica planisfero', context);
    await maps().search('politica mappamondo', context);

    const searches = calls.map((c) => new URL(c.url).searchParams.get('gsrsearch'));
    assert.ok(searches.includes('intitle:"physical map" world'));
    assert.ok(searches.includes('incategory:"Political maps of the world"'));
  });

  it('pagina con offset e limite', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { page: 3, kind: 'map' });
    await maps({ pageSize: 10 }).search('fisica Toscana', context);

    for (const call of calls) {
      const url = new URL(call.url);
      assert.equal(url.searchParams.get('gsrlimit'), '10');
      assert.equal(url.searchParams.get('gsroffset'), '20');
      assert.equal(url.searchParams.get('gsrnamespace'), '6');
    }
  });

  it('con un tipo ma senza soggetto usa l\'Italia', async () => {
    const { context, calls } = ctx([{ match: 'commons.wikimedia.org', body: mapsFixture }], { kind: 'map' });
    await maps().search('fisica', context);

    const searches = calls.map((c) => new URL(c.url).searchParams.get('gsrsearch')).filter((s): s is string => s !== null);
    assert.ok(searches.some((s) => s.includes('Relief location maps of Italy')));
    assert.ok(searches.some((s) => s.includes('Maps of Italy')));
  });

  it('è utilizzabile per nome come provider incluso', async () => {
    const mock = mockFetch([{ match: 'commons.wikimedia.org', body: mapsFixture }]);
    const finder = new PhotoFinder({ providers: ['maps'], fetch: mock.fetch, contact: 'dev@example.com' });
    const res = await finder.search('fisica Toscana', { kind: 'map' });

    assert.deepEqual(res.providers.maps, { ok: true, count: 6 });
    assert.equal(res.results[0].provider, 'Cartine');
  });
});

describe('smithsonian', () => {
  it('richiede la chiave API', () => {
    assert.throws(() => smithsonian({ apiKey: '' }), /apiKey/);
  });

  it('filtra CC0 nella query, ripulisce la sintassi Lucene e sceglie l\'autore giusto', async () => {
    const { context, calls } = ctx([{ match: 'api.si.edu', body: smithsonianFixture }]);
    const results = await smithsonian({ apiKey: 'SEGRETA' }).search('tuscany: "cattle" (study)', context);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('q'), '(tuscany   cattle   study) AND media_usage:CC0 AND online_media_type:Images');
    assert.equal(url.searchParams.get('api_key'), 'SEGRETA');

    assert.deepEqual(results.map((r) => r.id), ['smithsonian:ld1-1', 'smithsonian:ld1-2']);
    assert.equal(results[0].creator, 'Walter Shirlaw, American, b. Scotland, 1838–1909');
    assert.equal(results[1].creator, null, 'il collezionista non è l\'autore');
    assert.equal(results[1].thumbnailUrl, 'https://ids.si.edu/ids/deliveryService?id=ark%3A%2F65665%2Fm3cc&max=400');
  });

  it('non espone la chiave API negli errori', async () => {
    const { context } = ctx([{ match: 'api.si.edu', status: 403 }]);
    await assert.rejects(smithsonian({ apiKey: 'SEGRETA' }).search('x', context), (err: Error & { url: string }) => {
      assert.ok(!err.url.includes('SEGRETA'));
      assert.match(err.url, /api_key=\*\*\*/);
      return true;
    });
  });

  it('una query fatta solo di simboli non fa richieste', async () => {
    const { context, calls } = ctx([{ match: 'api.si.edu', body: smithsonianFixture }]);
    assert.deepEqual(await smithsonian({ apiKey: 'k' }).search('"()"', context), []);
    assert.equal(calls.length, 0);
  });
});
