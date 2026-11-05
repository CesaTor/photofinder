/** Una rotta del fetch simulato: se `match` è contenuto nell'URL, risponde con `body` (o con `status`). */
export interface Route {
  match: string;
  body?: unknown;
  status?: number;
  /** Simula un servizio che non risponde mai (fino all'annullamento). */
  hang?: boolean;
}

export interface MockFetch {
  fetch: typeof globalThis.fetch;
  calls: Array<{ url: string; headers: Record<string, string> }>;
}

export function mockFetch(routes: Route[]): MockFetch {
  const calls: MockFetch['calls'] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    const route = routes.find((r) => url.includes(r.match));
    if (!route) return new Response('not found', { status: 404 });
    if (route.hang) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    }
    return new Response(JSON.stringify(route.body ?? {}), {
      status: route.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

export const openverseFixture = {
  results: [
    {
      id: 'ov-1',
      title: 'Monte Amiata',
      url: 'https://live.staticflickr.com/1/amiata.jpg',
      thumbnail: 'https://api.openverse.org/v1/images/ov-1/thumb/',
      creator: 'Anna Bianchi',
      license: 'by',
      license_version: '2.0',
      license_url: 'https://creativecommons.org/licenses/by/2.0/',
      foreign_landing_url: 'https://www.flickr.com/photos/x/1',
      source: 'flickr',
    },
    {
      id: 'ov-2',
      title: 'Colline',
      url: 'https://example.org/colline.jpg',
      thumbnail: null,
      creator: null,
      license: 'cc0',
      license_version: '1.0',
      license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      foreign_landing_url: 'https://example.org/colline',
      source: 'wikimedia',
    },
    // Non dovrebbe arrivare (filtriamo già nella query), ma va scartata comunque.
    {
      id: 'ov-3',
      title: 'Non commerciale',
      url: 'https://example.org/nc.jpg',
      thumbnail: null,
      creator: 'X',
      license: 'by-nc',
      license_version: '4.0',
      license_url: null,
      foreign_landing_url: null,
      source: 'flickr',
    },
  ],
};

function wmPage(index: number, title: string, mime: string, license: string, shortName: string, attribution: 'true' | 'false', artist = '') {
  return {
    pageid: 1000 + index,
    ns: 6,
    title: `File:${title}`,
    index,
    imageinfo: [
      {
        url: `https://upload.wikimedia.org/${encodeURIComponent(title)}`,
        thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(title)}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title)}`,
        mime,
        extmetadata: {
          ...(artist && { Artist: { value: artist } }),
          License: { value: license },
          LicenseShortName: { value: shortName },
          LicenseUrl: { value: license.startsWith('cc-by') ? 'https://creativecommons.org/licenses/by/4.0' : '' },
          AttributionRequired: { value: attribution },
        },
      },
    ],
  };
}

export const wikimediaFixture = {
  batchcomplete: true,
  query: {
    // Ordine volutamente sparso: va riordinato per `index`.
    pages: [
      wmPage(2, 'Cartina Toscana.svg', 'image/svg+xml', 'pd', 'Public domain', 'false'),
      wmPage(1, 'Cartina della Toscana.jpg', 'image/jpeg', 'cc-by-4.0', 'CC BY 4.0', 'true', '<a href="//commons.wikimedia.org/wiki/User:Rossi">Mario &amp; Rossi</a>'),
      wmPage(3, 'Rivista.pdf', 'application/pdf', 'pd', 'Public domain', 'false'),
      wmPage(4, 'Scansione.djvu', 'image/vnd.djvu', 'cc-by-sa-4.0', 'CC BY-SA 4.0', 'true'),
      wmPage(5, 'Foto NC.jpg', 'image/jpeg', 'cc-by-nc-4.0', 'CC BY-NC 4.0', 'true'),
      wmPage(6, 'Foto GFDL.jpg', 'image/jpeg', '', 'GFDL 1.2', 'true'),
    ],
  },
};

export const metSearchFixture = { total: 3, objectIDs: [1, 2, 3] };
export const metEmptyFixture = { total: 0, objectIDs: null };
export const metObjects = {
  1: { objectID: 1, isPublicDomain: true, primaryImage: 'https://images.metmuseum.org/1.jpg', primaryImageSmall: 'https://images.metmuseum.org/1s.jpg', title: 'Veduta', artistDisplayName: '', objectURL: 'https://www.metmuseum.org/art/collection/search/1' },
  2: { objectID: 2, isPublicDomain: false, primaryImage: '', primaryImageSmall: '', title: 'Protetta', artistDisplayName: 'Y', objectURL: 'https://www.metmuseum.org/art/collection/search/2' },
};

export const articFixture = {
  data: [
    { id: 28, title: 'Souvenir of Tuscany', artist_title: 'Jean Baptiste Camille Corot', image_id: 'img-28', is_public_domain: true },
    { id: 29, title: 'Senza immagine', artist_title: null, image_id: null, is_public_domain: true },
    { id: 30, title: 'Protetta', artist_title: 'Z', image_id: 'img-30', is_public_domain: false },
  ],
};

export const clevelandFixture = {
  data: [
    {
      id: 132367,
      title: 'Virgin and Child Enthroned',
      url: 'https://clevelandart.org/art/1954.834',
      share_license_status: 'CC0',
      creators: [{ description: 'Battista di Biagio Sanguigni (Italian, active 1393–1451)' }],
      images: {
        web: { url: 'https://openaccess-cdn.clevelandart.org/1954.834/1954.834_web.jpg' },
        print: { url: 'https://openaccess-cdn.clevelandart.org/1954.834/1954.834_print.jpg' },
      },
    },
    { id: 2, title: 'Protetta', url: 'https://clevelandart.org/art/2', share_license_status: 'Copyrighted', creators: [], images: null },
  ],
};

export const pixabayFixture = {
  total: 1000,
  totalHits: 500,
  hits: [
    {
      id: 8345688,
      pageURL: 'https://pixabay.com/photos/florence-8345688/',
      type: 'photo',
      tags: 'florence, tuscany, italy',
      previewURL: 'https://cdn.pixabay.com/photo/2023/10/27/15/51/italy-8345688_150.jpg',
      webformatURL: 'https://pixabay.com/get/abc_640.jpg',
      largeImageURL: 'https://pixabay.com/get/abc_1280.jpg',
      user: 'Elisabetta_Miele',
    },
    {
      id: 42,
      pageURL: 'https://pixabay.com/photos/map-42/',
      type: 'photo',
      tags: 'cartina, mappa',
      previewURL: 'https://cdn.pixabay.com/photo/42_150.jpg',
      webformatURL: 'https://pixabay.com/get/def_640.jpg',
      largeImageURL: 'https://pixabay.com/get/def_1280.jpg',
      // Presente solo con l'accesso completo all'API.
      imageURL: 'https://pixabay.com/get/def_4000.jpg',
      user: 'MarioRossi',
    },
    {
      id: 7,
      pageURL: 'https://pixabay.com/photos/no-user-7/',
      type: 'photo',
      webformatURL: 'https://pixabay.com/get/ghi_640.jpg',
      user: '',
    },
    // Senza URL utilizzabili: va scartata.
    { id: 8, pageURL: 'https://pixabay.com/photos/broken-8/', type: 'photo' },
  ],
};

export const mapsFixture = {
  query: {
    pages: [
      mapPage(1, 'Relief map of Italien Toskana.png', 'image/png', 'cc-by-sa-3.0', 'CC BY-SA 3.0', 3333, 3703),
      mapPage(2, 'Reliefkarte Toskana 2019.png', 'image/png', 'cc-by-sa-3.0', 'CC BY-SA 3.0', 3547, 3859),
      mapPage(3, 'Regions of Italy with official names.png', 'image/png', 'cc-by-sa-4.0', 'CC BY-SA 4.0', 1108, 1097),
      mapPage(4, 'Tuscany Blank.png', 'image/png', 'cc0', 'CC0', 1000, 1000, 'false'),
      mapPage(5, 'Old map of Tuscany.jpg', 'image/jpeg', 'pd', 'Public domain', 2000, 2000, 'false'),
      mapPage(6, 'Protected map.png', 'image/png', 'cc-by-nc-4.0', 'CC BY-NC 4.0', 1200, 1200),
      mapPage(7, 'Map document.pdf', 'application/pdf', 'pd', 'Public domain', 1000, 1000, 'false'),
      mapPage(8, 'Physical World Map.svg', 'image/svg+xml', 'pd', 'Public domain', 1000, 500, 'false'),
    ],
  },
};

function mapPage(
  pageid: number,
  title: string,
  mime: string,
  license: string,
  shortName: string,
  width: number,
  height: number,
  attribution: 'true' | 'false' = 'true'
) {
  const name = title.replace(/^File:/, '');
  return {
    pageid,
    title: `File:${title}`,
    imageinfo: [
      {
        url: `https://upload.wikimedia.org/${encodeURIComponent(name)}`,
        thumburl: `https://upload.wikimedia.org/thumb/${encodeURIComponent(name)}`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
        mime,
        width,
        height,
        extmetadata: {
          ObjectName: { value: name.replace(/\.[^.]+$/, '') },
          Artist: { value: '<a href="https://commons.wikimedia.org/wiki/User:Autore">Autore</a>' },
          License: { value: license },
          LicenseShortName: { value: shortName },
          LicenseUrl: { value: license.startsWith('cc-') ? `https://creativecommons.org/licenses/${license.replace('cc-', '')}/` : '' },
          AttributionRequired: { value: attribution },
        },
      },
    ],
  };
}

export const smithsonianFixture = {
  status: 200,
  response: {
    rows: [
      {
        id: 'ld1-1',
        title: 'Study of Cattle in Tuscany',
        content: {
          descriptiveNonRepeating: {
            record_link: 'https://collection.cooperhewitt.org/view/objects/asitem/id/19179',
            online_media: {
              media: [
                { type: 'Images', content: 'https://ids.si.edu/ids/deliveryService?id=CHSDM-1', idsId: 'CHSDM-1', usage: { access: 'CC0' } },
              ],
            },
          },
          freetext: {
            name: [
              { label: 'Collector', content: 'Qualcun altro' },
              { label: 'Artist', content: 'Walter Shirlaw, American, b. Scotland, 1838–1909' },
            ],
          },
        },
      },
      {
        id: 'ld1-2',
        title: 'Cerastium sp.',
        content: {
          descriptiveNonRepeating: {
            record_link: 'http://n2t.net/ark:/65665/3694c379c',
            online_media: {
              media: [{ type: 'Images', content: 'https://ids.si.edu/ids/deliveryService/id/ark:/65665/m3cc', idsId: 'ark:/65665/m3cc', usage: { access: 'CC0' } }],
            },
          },
          freetext: { name: [{ label: 'Collector', content: 'John Ball' }] },
        },
      },
      {
        id: 'ld1-3',
        title: 'Non CC0',
        content: {
          descriptiveNonRepeating: {
            online_media: { media: [{ type: 'Images', content: 'https://ids.si.edu/x', idsId: 'x', usage: { access: 'Usage conditions apply' } }] },
          },
        },
      },
    ],
  },
};
