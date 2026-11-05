import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HttpError, PhotoFinder, buildAttribution, interleave } from '../src/index.ts';
import type { ImageResult, Provider, SearchKind } from '../src/index.ts';
import { articFixture, clevelandFixture, metEmptyFixture, mockFetch, openverseFixture, wikimediaFixture } from './helpers.ts';

function fakeImage(id: string): ImageResult {
  return {
    id,
    provider: 'Fake',
    title: id,
    creator: null,
    imageUrl: `https://example.org/${id}.jpg`,
    thumbnailUrl: `https://example.org/${id}.jpg`,
    sourceUrl: `https://example.org/${id}`,
    license: 'CC0',
    licenseUrl: null,
    attributionRequired: false,
    attribution: null,
  };
}

/** Provider finto che conta le chiamate e può fallire a comando. */
function fakeProvider(id: string, items: string[], opts: { fail?: boolean; kinds?: SearchKind[] } = {}) {
  const state = { calls: 0, fail: opts.fail ?? false };
  const provider: Provider = {
    id,
    name: id,
    kinds: opts.kinds,
    async search() {
      state.calls++;
      if (state.fail) throw new Error(`${id} giù`);
      return items.map(fakeImage);
    },
  };
  return { provider, state };
}

describe('PhotoFinder', () => {
  it('interroga i provider di default e alterna i risultati', async () => {
    const { fetch, calls } = mockFetch([
      { match: 'api.openverse.org', body: openverseFixture },
      { match: 'commons.wikimedia.org', body: wikimediaFixture },
      { match: 'v1.1/search', body: metEmptyFixture },
      { match: 'api.artic.edu', body: articFixture },
      { match: 'openaccess-api.clevelandart.org', body: clevelandFixture },
    ]);
    const finder = new PhotoFinder({ fetch, contact: 'dev@example.com' });
    const res = await finder.search('  cartina toscana  ');

    assert.equal(res.query, 'cartina toscana');
    assert.deepEqual(res.providers, {
      openverse: { ok: true, count: 2 },
      wikimedia: { ok: true, count: 2 },
      met: { ok: true, count: 0 },
      cleveland: { ok: true, count: 1 },
    });
    assert.deepEqual(
      res.results.map((r) => r.provider),
      ['Openverse', 'Wikimedia Commons', 'Cleveland Museum of Art', 'Openverse', 'Wikimedia Commons']
    );
    assert.match(calls[0].headers['User-Agent'], /^photofinder\/\S+ \(dev@example\.com\)$/);
  });

  it('un provider che fallisce non blocca gli altri e viene messo in pausa', async () => {
    const good = fakeProvider('good', ['a', 'b']);
    const bad = fakeProvider('bad', [], { fail: true });
    const finder = new PhotoFinder({ providers: [good.provider, bad.provider], cacheTtlMs: 0 });

    const first = await finder.search('x');
    assert.deepEqual(first.results.map((r) => r.id), ['a', 'b']);
    assert.equal(first.providers.bad.ok, false);
    assert.ok(!first.providers.bad.ok && first.providers.bad.error === 'bad giù');
    assert.ok(!first.providers.bad.ok && first.providers.bad.pausedUntil instanceof Date);

    await finder.search('y');
    assert.equal(bad.state.calls, 1, 'in pausa: non viene richiamato');
    assert.equal(good.state.calls, 2);

    finder.reset();
    bad.state.fail = false;
    const after = await finder.search('z');
    assert.deepEqual(after.providers.bad, { ok: true, count: 0 });
  });

  it('pauseOnErrorMs: 0 riprova sempre', async () => {
    const bad = fakeProvider('bad', [], { fail: true });
    const finder = new PhotoFinder({ providers: [bad.provider], pauseOnErrorMs: 0 });
    await finder.search('x');
    const res = await finder.search('x');
    assert.equal(bad.state.calls, 2);
    assert.deepEqual(res.providers.bad, { ok: false, error: 'bad giù' });
  });

  it('mette in cache solo le risposte complete', async () => {
    const good = fakeProvider('good', ['a']);
    const finder = new PhotoFinder({ providers: [good.provider] });
    assert.equal((await finder.search('Mare')).cached, false);
    assert.equal((await finder.search('mare')).cached, true, 'la chiave ignora maiuscole');
    assert.equal(good.state.calls, 1);

    const bad = fakeProvider('bad', [], { fail: true });
    const partial = new PhotoFinder({ providers: [good.provider, bad.provider], pauseOnErrorMs: 0 });
    await partial.search('mare');
    assert.equal((await partial.search('mare')).cached, false);
  });

  it('cacheMaxEntries elimina le ricerche più vecchie', async () => {
    const good = fakeProvider('good', ['a']);
    const finder = new PhotoFinder({ providers: [good.provider], cacheMaxEntries: 2 });
    await finder.search('a');
    await finder.search('b');
    await finder.search('c');
    assert.equal((await finder.search('c')).cached, true);
    assert.equal((await finder.search('a')).cached, false);
  });

  it('un timeout diventa un errore del provider', async () => {
    const { fetch } = mockFetch([{ match: 'commons.wikimedia.org', hang: true }]);
    const finder = new PhotoFinder({ providers: ['wikimedia'], fetch, timeoutMs: 20 });
    const res = await finder.search('x');
    assert.equal(res.providers.wikimedia.ok, false);
  });

  it('gli errori HTTP riportano lo status', async () => {
    const { fetch } = mockFetch([{ match: 'api.openverse.org', status: 504 }]);
    const finder = new PhotoFinder({ providers: ['openverse'], fetch });
    const res = await finder.search('x');
    assert.deepEqual(
      { ok: res.providers.openverse.ok, error: !res.providers.openverse.ok && res.providers.openverse.error },
      { ok: false, error: 'HTTP 504' }
    );
    assert.equal(new HttpError(504, 'u').status, 504);
  });

  it('annullare con signal fa rifiutare search()', async () => {
    const { fetch } = mockFetch([{ match: 'commons.wikimedia.org', hang: true }]);
    const finder = new PhotoFinder({ providers: ['wikimedia'], fetch });
    const ctrl = new AbortController();
    const p = finder.search('x', { signal: ctrl.signal });
    ctrl.abort();
    await assert.rejects(p, { name: 'AbortError' });
  });

  it('con kind "map" interroga solo i provider di cartine', async () => {
    const image = fakeProvider('image', ['img']);
    const map = fakeProvider('map', ['map'], { kinds: ['map'] });
    const finder = new PhotoFinder({ providers: [image.provider, map.provider], cacheTtlMs: 0 });

    const res = await finder.search('fisica Toscana', { kind: 'map' });
    assert.equal(res.kind, 'map');
    assert.deepEqual(res.providers, { map: { ok: true, count: 1 } });
    assert.equal(res.results.length, 1);
    assert.equal(image.state.calls, 0);
    assert.equal(map.state.calls, 1);
  });

  it('senza kind interroga solo i provider di immagini', async () => {
    const image = fakeProvider('image', ['img']);
    const map = fakeProvider('map', ['map'], { kinds: ['map'] });
    const finder = new PhotoFinder({ providers: [image.provider, map.provider], cacheTtlMs: 0 });

    const res = await finder.search('montagna');
    assert.equal(res.kind, 'image');
    assert.deepEqual(res.providers, { image: { ok: true, count: 1 } });
    assert.equal(image.state.calls, 1);
    assert.equal(map.state.calls, 0);
  });

  it('lo streaming elenca solo i provider del tipo richiesto', async () => {
    const image = fakeProvider('image', ['img']);
    const map = fakeProvider('map', ['map'], { kinds: ['map'] });
    const finder = new PhotoFinder({ providers: [image.provider, map.provider], cacheTtlMs: 0 });

    const events = [];
    for await (const ev of finder.searchStream('fisica Toscana', { kind: 'map' })) events.push(ev);
    const start = events[0];
    assert.ok(start.type === 'start');
    assert.equal(start.kind, 'map');
    assert.deepEqual(start.providers, [{ id: 'map', name: 'map' }]);
    assert.deepEqual(start.pending, ['map']);
  });

  it('se non ci sono provider per il tipo richiesto lancia un errore', async () => {
    const finder = new PhotoFinder({ providers: [fakeProvider('image', ['img']).provider] });
    await assert.rejects(finder.search('x', { kind: 'map' }), /Nessun provider/);
  });

  it('la cache distingue image e map', async () => {
    const image = fakeProvider('image', ['img']);
    const map = fakeProvider('map', ['map'], { kinds: ['map'] });
    const finder = new PhotoFinder({ providers: [image.provider, map.provider], cacheTtlMs: 60_000 });

    await finder.search('toscana');
    await finder.search('toscana', { kind: 'map' });
    assert.equal(image.state.calls, 1);
    assert.equal(map.state.calls, 1);

    await finder.search('toscana', { kind: 'map' });
    assert.equal(map.state.calls, 1, 'la seconda ricerca map arriva dalla cache');
  });

  it('valida gli argomenti', async () => {
    const finder = new PhotoFinder({ providers: [] });
    await assert.rejects(finder.search('   '), TypeError);
    await assert.rejects(finder.search('x', { page: 0 }), TypeError);
    assert.throws(() => new PhotoFinder({ providers: ['flickr' as 'met'] }), /sconosciuto/);
    assert.throws(() => new PhotoFinder({ providers: ['met', 'met'] }), /duplicato/);
  });
});

describe('interleave', () => {
  it('alterna liste di lunghezza diversa', () => {
    assert.deepEqual(interleave([[1, 2, 3], [], [4]]), [1, 4, 2, 3]);
    assert.deepEqual(interleave([]), []);
  });
});

describe('buildAttribution', () => {
  it('omette autore e URL se mancanti', () => {
    assert.equal(
      buildAttribution({ title: '', creator: null, license: 'CC BY-SA 3.0', licenseUrl: null, sourceName: 'Wikimedia Commons' }),
      '"Senza titolo", CC BY-SA 3.0, tramite Wikimedia Commons'
    );
  });

  it('aggiunge il link alla fonte quando presente', () => {
    assert.equal(
      buildAttribution({
        title: 'Everest',
        creator: 'Mario Rossi',
        license: 'CC BY 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by/4.0',
        sourceName: 'Wikimedia Commons',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Everest.jpg',
      }),
      '"Everest" di Mario Rossi, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0), tramite Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Everest.jpg)'
    );
  });
});

/** Provider finto che risponde dopo `ms` millisecondi e registra se è stato annullato. */
function delayedProvider(id: string, ms: number, items: string[]) {
  const state = { aborted: false };
  const provider: Provider = {
    id,
    name: `Nome ${id}`,
    async search(_q, { fetchJson }) {
      // Passa da fetchJson così riceve il segnale di annullamento.
      await fetchJson(`https://example.org/${id}?delay=${ms}`).catch((err) => {
        state.aborted = true;
        throw err;
      });
      return items.map(fakeImage);
    },
  };
  return { provider, state };
}

/** fetch finto che risponde dopo il ritardo indicato in `?delay=` e rispetta l'annullamento. */
const delayFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const ms = Number(new URL(String(input)).searchParams.get('delay'));
  return new Promise<Response>((resolve, reject) => {
    const t = setTimeout(() => resolve(new Response('{}')), ms);
    init?.signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(init.signal!.reason);
    });
  });
}) as typeof globalThis.fetch;

describe('PhotoFinder.searchStream', () => {
  it('emette start, poi un evento per provider nell\'ordine di risposta, poi done', async () => {
    const slow = delayedProvider('slow', 60, ['s1']);
    const fast = delayedProvider('fast', 5, ['f1', 'f2']);
    const finder = new PhotoFinder({ providers: [slow.provider, fast.provider], fetch: delayFetch });

    const events = [];
    for await (const ev of finder.searchStream('x')) events.push(ev);

    assert.deepEqual(
      events.map((e) => (e.type === 'provider' ? `provider:${e.provider}` : e.type)),
      ['start', 'provider:fast', 'provider:slow', 'done']
    );
    const [start, first, second, done] = events;
    assert.ok(start.type === 'start' && start.cached === false);
    assert.deepEqual(start.type === 'start' && start.pending, ['slow', 'fast']);
    assert.deepEqual(start.type === 'start' && start.providers, [
      { id: 'slow', name: 'Nome slow' },
      { id: 'fast', name: 'Nome fast' },
    ]);
    assert.ok(first.type === 'provider');
    assert.deepEqual(first.pending, ['slow'], 'mentre arriva fast, slow è ancora in attesa');
    assert.equal(first.name, 'Nome fast');
    assert.deepEqual(first.results.map((r) => r.id), ['f1', 'f2']);
    assert.ok(second.type === 'provider');
    assert.deepEqual(second.pending, []);
    assert.ok(done.type === 'done');
    assert.deepEqual(
      done.response.results.map((r) => r.id),
      ['s1', 'f1', 'f2'],
      'la risposta finale segue l\'ordine dei provider configurati, non quello di arrivo'
    );
  });

  it('interrompere l\'iterazione annulla le richieste ancora in corso', async () => {
    const slow = delayedProvider('slow', 5_000, ['s1']);
    const fast = delayedProvider('fast', 5, ['f1']);
    const finder = new PhotoFinder({ providers: [slow.provider, fast.provider], fetch: delayFetch });

    for await (const ev of finder.searchStream('x')) {
      if (ev.type === 'provider') break;
    }
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(slow.state.aborted, true);
  });

  it('i provider in pausa vengono segnalati subito, senza essere in pending', async () => {
    const bad = fakeProvider('bad', [], { fail: true });
    const good = fakeProvider('good', ['a']);
    const finder = new PhotoFinder({ providers: [bad.provider, good.provider], cacheTtlMs: 0 });
    await finder.search('x');

    const events = [];
    for await (const ev of finder.searchStream('x')) events.push(ev);
    const [start, pausedEv] = events;
    assert.deepEqual(start.type === 'start' && start.pending, ['good']);
    assert.ok(pausedEv.type === 'provider' && pausedEv.provider === 'bad' && !pausedEv.status.ok && pausedEv.status.pausedUntil);
  });

  it('dalla cache emette tutto subito con cached: true', async () => {
    const good = fakeProvider('good', ['a', 'b']);
    const finder = new PhotoFinder({ providers: [good.provider] });
    await finder.search('x');

    const events = [];
    for await (const ev of finder.searchStream('x')) events.push(ev);
    assert.deepEqual(events.map((e) => e.type), ['start', 'provider', 'done']);
    assert.ok(events[0].type === 'start' && events[0].cached && events[0].pending.length === 0);
    assert.ok(events[1].type === 'provider' && events[1].results.length === 2);
    assert.ok(events[2].type === 'done' && events[2].response.cached);
    assert.equal(good.state.calls, 1);
  });

  it('valida gli argomenti prima di emettere eventi', async () => {
    const finder = new PhotoFinder({ providers: [] });
    await assert.rejects(finder.searchStream('  ').next(), TypeError);
  });
});
