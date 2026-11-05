# photofinder

Libreria TypeScript per cercare **immagini riutilizzabili**, utilizzabili anche commercialmente e modificabili, su più fonti in parallelo. Ogni risultato è accompagnato dalla **stringa di attribuzione** pronta da mostrare, quando la licenza la richiede.

- Una sola chiamata interroga Openverse, Wikimedia Commons, The Met, Cleveland Museum of Art e, se hai una chiave gratuita, Smithsonian e Pixabay. Le cartine geografiche hanno un provider dedicato (`maps`). Art Institute of Chicago è disponibile ma disattivato (vedi [Limiti noti](#limiti-noti)).
- I filtri sulle licenze sono applicati internamente: arrivano solo CC0, pubblico dominio, CC BY, CC BY-SA e Pixabay Content License.
- Il formato dei risultati è lo stesso per tutte le fonti.
- Se una fonte non risponde, le altre restituiscono comunque i loro risultati e la fonte guasta viene saltata per un po'.
- Risultati in streaming: con `searchStream()` ogni fonte invia i suoi risultati appena risponde, senza aspettare le più lente.
- Cache in memoria, timeout, annullamento con `AbortSignal`.
- Nessuna dipendenza a runtime. Solo Smithsonian e Pixabay richiedono una chiave API, gratuita.

> **Requisiti:** Node.js ≥ 20.3, o qualsiasi runtime server con `fetch` e `AbortSignal.any`.
> La libreria è pensata per il **lato server**: i browser non permettono di impostare lo User-Agent richiesto da Wikimedia, e alcune API non abilitano CORS.

## Indice

- [Installazione](#installazione)
- [Uso rapido](#uso-rapido)
- [Mostrare l'attribuzione](#mostrare-lattribuzione)
- [Politica delle licenze](#politica-delle-licenze)
- [API](#api)
  - [`new PhotoFinder(options)`](#new-photofinderoptions)
  - [`finder.search(query, options)`](#findersearchquery-options)
  - [`finder.searchStream(query, options)`](#findersearchstreamquery-options)
  - [`ImageResult`](#imageresult)
  - [`SearchResponse` e `ProviderStatus`](#searchresponse-e-providerstatus)
  - [Provider inclusi](#provider-inclusi)
    - [Cartine geografiche](#cartine-geografiche)
  - [Utility](#utility)
- [Gestione degli errori](#gestione-degli-errori)
- [Scrivere un provider personalizzato](#scrivere-un-provider-personalizzato)
- [Limiti noti](#limiti-noti)
- [Sviluppo](#sviluppo)

## Installazione

```bash
npm install photofinder
```

Per lavorare alla libreria e usarla da un altro progetto senza pubblicarla:

```bash
# dalla cartella di questa libreria
npm install && npm run build

# dal tuo progetto
npm install /percorso/a/photofinder
```

La libreria è distribuita con licenza [MIT](LICENSE). Le licenze delle immagini sono invece quelle indicate da ogni fonte (vedi [Politica delle licenze](#politica-delle-licenze)).

## Uso rapido

```ts
import { PhotoFinder } from 'photofinder';

const finder = new PhotoFinder({ contact: 'dev@tuodominio.it' });

const { results, providers } = await finder.search('cartina toscana');

for (const img of results) {
  console.log(img.thumbnailUrl, img.license);
  if (img.attribution) console.log('  →', img.attribution);
}

console.log(providers);
// { openverse: { ok: true, count: 12 }, wikimedia: { ok: true, count: 3 }, met: { ok: true, count: 0 }, cleveland: { ok: true, count: 0 } }
```

Pagina successiva:

```ts
const page2 = await finder.search('cartina toscana', { page: 2 });
```

## Mostrare l'attribuzione

Ogni `ImageResult` ha due campi:

| Campo | Significato |
|---|---|
| `attributionRequired` | `true` per CC BY e CC BY-SA, `false` per CC0, pubblico dominio e Pixabay |
| `attribution` | testo da mostrare vicino all'immagine, oppure `null` se non serve |

Per **Pixabay** la licenza non obbliga ad attribuire (`attributionRequired: false`), ma i termini dell'API chiedono di indicare la fonte: `attribution` è quindi sempre valorizzata, con autore, licenza e pagina originale.

Il testo segue lo schema **TASL** consigliato da Creative Commons (Titolo, Autore, Fonte, Licenza):

```
"Cartina della Toscana alla fine del tredicesimo secolo" di Anna.Massini, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0), tramite Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Cartina_della_Toscana.jpg)
```

Con `locale: 'en'`:

```
"Cartina della Toscana alla fine del tredicesimo secolo" by Anna.Massini, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0), via Wikimedia Commons (https://commons.wikimedia.org/wiki/File:Cartina_della_Toscana.jpg)
```

La stringa include sia il link alla licenza sia quello alla pagina originale (`sourceUrl`), come raccomanda lo schema TASL. Se ti serve un formato diverso, ad esempio HTML con link, i campi `title`, `creator`, `license`, `licenseUrl` e `sourceUrl` contengono tutti gli elementi, e puoi usare [`buildAttribution`](#utility) o comporre la stringa da te.

> Per le immagini **CC BY-SA**, se le modifichi, l'opera derivata va rilasciata con la stessa licenza.

## Politica delle licenze

La libreria restituisce solo immagini con licenze che permettono **uso commerciale e modifiche**:

| Licenza | Inclusa | Attribuzione |
|---|---|---|
| CC0 | ✅ | no |
| Pubblico dominio / Public Domain Mark | ✅ | no |
| CC BY (tutte le versioni) | ✅ | **sì** |
| CC BY-SA (tutte le versioni) | ✅ | **sì** |
| Pixabay Content License | ✅ | no (ma l'API chiede di indicare Pixabay come fonte) |
| CC BY-NC, CC BY-ND e combinazioni | ❌ | — |
| GFDL | ❌ | obbliga a riportare il testo intero della licenza |
| Fair use / non libere | ❌ | — |

Come viene applicato il filtro per ogni fonte:

- **Openverse**: tramite il parametro `license=cc0,pdm,by,by-sa` della query, più un controllo sui risultati.
- **Wikimedia Commons**: sui metadati di ogni file (`License`, `LicenseShortName`), con [`isReusableWikimediaLicense`](#utility). Vengono scartati anche i file che non sono immagini (PDF, DjVu, video, audio). Gli SVG sono inclusi.
- **The Met**: solo le opere con `isPublicDomain: true`, che il museo rilascia in CC0.
- **Art Institute of Chicago**: filtro `is_public_domain` nella query (CC0). Il campo `description`, che è CC BY 4.0, non viene richiesto.
- **Cleveland Museum of Art**: filtro `cc0` nella query, più il controllo `share_license_status === 'CC0'`.
- **Smithsonian**: filtro `media_usage:CC0` nella query, più il controllo `usage.access === 'CC0'` su ogni media.
- **Pixabay**: tutti i risultati sono sotto Pixabay Content License, che consente uso commerciale e modifiche. La licenza vieta però di rivendere o distribuire l'immagine *da sola* (senza un'opera che la incorpori), di usarla come marchio e di usarla per prodotti fisici in presenza di marchi riconoscibili.

### Termini d'uso delle API (verificati il 2026-11-02; Pixabay il 2026-11-04)

La licenza delle immagini è una cosa, i termini d'uso dell'API sono un'altra. Questo è quanto risulta dalle fonti ufficiali. **Non è una consulenza legale**: prima di andare in produzione fai verificare questi punti a un legale.

| Fonte | Chiave | Immagini: uso commerciale | API: condizioni | Limiti |
|---|---|---|---|---|
| **Openverse** | no (registrazione OAuth gratuita per limiti più alti) | sì, secondo la licenza CC di ogni immagine. Openverse **non verifica** le licenze | Nel prodotto va indicato in modo visibile che è "made using Openverse" e non approvato da Openverse. Vietati lo scraping e l'uso di più macchine per aggirare i limiti. Openverse **si riserva di far pagare l'uso commerciale** o intensivo e può revocare l'accesso in qualsiasi momento | anonimo: circa 1 richiesta/s e massimo 20 risultati per pagina (fonte 2022: i valori attuali non sono pubblicati). Superato il limite risponde 429 |
| **Wikimedia Commons** | no | sì, secondo la licenza di ogni file (CC BY-SA richiede la stessa licenza per le opere derivate) | User-Agent con contatto **obbligatorio** (User-Agent Policy). Vanno rispettate Robot policy e API:Etiquette. Per volumi commerciali elevati Wikimedia indica [Wikimedia Enterprise](https://enterprise.wikimedia.com/) (gratuito fino a certi limiti, poi a pagamento) | dal 2026: **10 richieste/min** senza contatto nello User-Agent, **200/min** con contatto. Superato il limite risponde 429 con `Retry-After` |
| **The Met** | no | sì: "unrestricted commercial and noncommercial use" (CC0) | soggetta ai Terms and Conditions del museo, che non ho potuto leggere (il sito risponde 429) | **80 richieste/s**. Ogni ricerca ne fa circa 13 (1 ricerca + 12 dettagli) |
| **Cleveland Museum of Art** | no | sì: "unrestricted commercial and noncommercial use" (CC0) | nessuna condizione oltre al CC0 | nessun limite dichiarato |
| Smithsonian (opzionale) | **sì**, gratuita (api.data.gov) | sì per i contenuti CC0, che sono gli unici restituiti | — | 1000 richieste/ora per chiave |
| Pixabay (opzionale) | **sì**, gratuita (registrazione) | sì, con Pixabay Content License: vietato rivendere l'immagine da sola, usarla come marchio o su prodotti fisici con marchi riconoscibili | L'API chiede di mostrare la fonte accanto ai risultati, di **conservare le risposte in cache per 24 ore** e di non collegare permanentemente le immagini (`hotlink`): per un uso diverso dalla visualizzazione temporanea dei risultati vanno scaricate sul proprio server. Vietati download massivi e richieste automatizzate in volume | 100 richieste/60 s per chiave. Massimo 500 risultati per query. La chiave standard non espone l'originale: l'immagine più grande è 1280px. Superato il limite risponde 429 |
| Art Institute of Chicago (disattivato) | no | sì (CC0) | header `AIC-User-Agent` per cortesia, niente scraping massivo | 60/min. Le immagini però non sono incorporabili (vedi Limiti noti) |

**Limiti comuni a tutte le fonti.** Le richieste partono dal tuo server, quindi i limiti valgono per **tutti i tuoi utenti insieme**, non per ciascuno. Ad esempio, con Wikimedia a 200 richieste/min puoi servire al massimo circa 200 ricerche nuove al minuto (le risposte in cache non contano).

**Rischi legali che restano a carico di chi usa le immagini**
- **Licenze dichiarate, non verificate.** Openverse e Wikimedia riportano la licenza indicata da chi ha caricato il file. Errori e caricamenti abusivi esistono.
- **Pixabay Content License non è una licenza Creative Commons.** Consente uso commerciale e modifiche, ma vieta di distribuire l'immagine da sola, di usarla come marchio e di usarla su prodotti fisici con marchi riconoscibili. Il piano API standard non espone l'originale: `imageUrl` è al massimo 1280px.
- **CC0 e pubblico dominio coprono solo il diritto d'autore.** Restano possibili diritti di terzi: ritratti di persone riconoscibili (diritto all'immagine), marchi e loghi, opere d'arte visibili nella foto.
- **"Public domain" non vale ovunque allo stesso modo.** Su Commons un file può essere di pubblico dominio negli Stati Uniti ma non in Italia o nell'UE.
- **Beni culturali italiani (artt. 107–108 del Codice dei beni culturali, D.Lgs. 42/2004).** La riproduzione a scopo commerciale di beni culturali pubblici italiani (ad esempio opere degli Uffizi o il David) può richiedere un'autorizzazione e un canone, **anche quando la foto è CC0 o l'opera è di pubblico dominio**. Il tema è stato oggetto di contenziosi recenti e va valutato con un legale.


**Europeana non è inclusa.** Da maggio 2025 la chiave "Personal", gratuita e immediata, è riservata a un uso individuale e *non di produzione*. Per un servizio in produzione serve una chiave "Project", soggetta ad approvazione (1–5 giorni lavorativi), e i termini non dicono esplicitamente se l'uso commerciale sia ammesso.

> ⚠️ La licenza dichiarata dalla fonte è quella che riceviamo: la libreria non può verificare che sia corretta. Per usi ad alto rischio, controlla sempre `sourceUrl`.

## API

### `new PhotoFinder(options)`

```ts
interface PhotoFinderOptions {
  providers?: Array<BuiltinProviderId | Provider>;
  contact?: string;
  userAgent?: string;
  locale?: 'it' | 'en';
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  pauseOnErrorMs?: number;
  fetch?: typeof fetch;
}
```

| Opzione | Default | Descrizione |
|---|---|---|
| `providers` | `defaultProviders`: `openverse`, `wikimedia`, `met`, `cleveland`, `maps` | Fonti da interrogare: nomi dei provider inclusi oppure oggetti `Provider`, inclusi o personalizzati |
| `contact` | — | Email o URL aggiunti allo User-Agent e all'header `AIC-User-Agent`. **Fortemente consigliato**: senza contatto Wikimedia limita a 10 richieste/min invece di 200. Se manca, viene stampato un avviso |
| `userAgent` | `photofinder/<versione> (<contact>)` | User-Agent completo; se impostato, `contact` viene ignorato |
| `locale` | `'it'` | Lingua delle stringhe di attribuzione |
| `timeoutMs` | `10000` | Timeout di ogni singola richiesta HTTP |
| `cacheTtlMs` | `600000` (10 min) | Durata della cache delle ricerche. `0` la disattiva |
| `cacheMaxEntries` | `500` | Numero massimo di ricerche in cache; le più vecchie vengono eliminate |
| `pauseOnErrorMs` | `300000` (5 min) | Per quanto saltare una fonte dopo un errore. `0` la riprova sempre |
| `fetch` | `globalThis.fetch` | Implementazione di `fetch` da usare, utile per test o proxy |

Opzioni specifiche di un provider:

```ts
import { PhotoFinder, wikimedia, met } from 'photofinder';

const finder = new PhotoFinder({
  providers: ['openverse', wikimedia({ batchSize: 30, thumbWidth: 600 }), met({ batchSize: 6 })],
});
```

Smithsonian e Pixabay richiedono la chiave, quindi vanno aggiunti come oggetto:

```ts
import { PhotoFinder, defaultProviders, pixabay, smithsonian } from 'photofinder';

const finder = new PhotoFinder({
  providers: [
    ...defaultProviders,
    smithsonian({ apiKey: process.env.SMITHSONIAN_API_KEY! }),
    pixabay({ apiKey: process.env.PIXABAY_API_KEY! }),
  ],
});
```

### `finder.search(query, options)`

```ts
search(query: string, options?: { page?: number; signal?: AbortSignal; kind?: SearchKind }): Promise<SearchResponse>
```

`SearchKind` è `'image' | 'map'`.

- Interroga in parallelo i provider del tipo richiesto (`kind`, default `'image'`) e alterna i risultati, uno per fonte a turno.
- Restituisce la risposta solo quando **tutte** le fonti hanno risposto. Per mostrare i risultati man mano, usa [`searchStream`](#findersearchstreamquery-options).
- **Non lancia eccezioni se una fonte fallisce**: l'errore finisce in `response.providers[id]`.
- Lancia `TypeError` se `query` è vuota, `page` non è un intero ≥ 1, `kind` non è valido o non c'è nessun provider per il tipo richiesto.
- Se `signal` viene annullato, la Promise viene rifiutata con l'errore del segnale (`AbortError`).
- Mette in cache solo le risposte in cui **tutte** le fonti hanno risposto. La chiave della cache include `kind` e ignora maiuscole e spazi iniziali e finali.

```ts
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 3000);
const res = await finder.search('gatto', { signal: ctrl.signal });

// Solo cartine: il finder deve includere il provider 'maps'
const cartine = await finder.search('fisica Toscana', { kind: 'map' });
```

### `finder.searchStream(query, options)`

```ts
searchStream(query: string, options?: { page?: number; signal?: AbortSignal; kind?: SearchKind }): AsyncGenerator<SearchEvent>
```

Stessa ricerca di `search()`, ma restituisce gli eventi **man mano che le fonti rispondono**. Così l'interfaccia può mostrare subito i primi risultati e indicare quali fonti sono ancora in attesa, invece di aspettare la più lenta (ad esempio Openverse, che va in timeout dopo `timeoutMs`). Anche qui `kind` filtra i provider: con `'map'` partecipa solo chi dichiara `kinds: ['map']`.

```ts
type SearchEvent =
  | { type: 'start'; query: string; page: number; kind: SearchKind;
      providers: Array<{ id: string; name: string }>;  // fonti configurate per quel tipo
      pending: string[];                               // quelle interrogate in rete
      cached: boolean }
  | { type: 'provider'; provider: string; name: string;
      status: ProviderStatus;
      results: ImageResult[];   // solo i risultati di questa fonte
      pending: string[] }       // fonti ancora in attesa
  | { type: 'done'; response: SearchResponse };  // identica a quella di search()
```

Ordine degli eventi:

1. un solo `start`;
2. subito, un `provider` per ogni fonte in pausa (`status.ok === false`, con `pausedUntil`);
3. un `provider` per ogni altra fonte, **nell'ordine in cui rispondono**;
4. un solo `done`.

Se la risposta è in cache, gli eventi arrivano tutti insieme, con `cached: true` e `pending` vuoto.

```ts
for await (const ev of finder.searchStream('faro')) {
  switch (ev.type) {
    case 'start':
      mostraCaricamento(ev.providers);
      break;
    case 'provider':
      aggiungiRisultati(ev.results);
      aggiornaAttesa(ev.pending);   // [] quando sono arrivate tutte
      break;
    case 'done':
      nascondiCaricamento();
      break;
  }
}
```

**Annullamento.** Se interrompi l'iterazione (`break`, `return`, un'eccezione nel ciclo) o annulli `signal`, le richieste ancora in corso verso le fonti vengono annullate. Nel caso di `signal` annullato, l'iteratore lancia `AbortError`.

#### Inviare lo stream al browser (Server-Sent Events)

L'esempio in [`examples/demo-server.ts`](examples/demo-server.ts) espone `GET /api/search/stream?q=...&page=...` in formato `text/event-stream`:

```ts
res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
const ctrl = new AbortController();
res.on('close', () => ctrl.abort());   // il browser chiude, annulliamo le richieste alle fonti

for await (const ev of finder.searchStream(q, { page, signal: ctrl.signal })) {
  res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
}
res.end();
```

E nel browser:

```js
const es = new EventSource(`/api/search/stream?q=${encodeURIComponent(q)}`);
es.addEventListener('provider', (e) => {
  const ev = JSON.parse(e.data);
  aggiungiRisultati(ev.results);
});
es.addEventListener('done', () => es.close());  // altrimenti EventSource si riconnette da solo
```

Nota: con JSON, `pausedUntil` arriva come stringa ISO, non come `Date`.

Esempio di tempi reali (ricerca "lighthouse", 2 novembre 2026):

```
0.00s start      in attesa: openverse, wikimedia, met, cleveland
1.10s cleveland  9 risultati
1.40s met        2 risultati
1.80s wikimedia  50 risultati
9.98s openverse  errore (timeout)
9.98s done
```

### `finder.reset()`

Svuota la cache e azzera le pause delle fonti.

### `ImageResult`

```ts
interface ImageResult {
  id: string;                  // "<provider>:<id originale>", es. "wikimedia:125747465"
  provider: string;            // "Openverse" | "Wikimedia Commons" | "The Met" | ...
  title: string;               // stringa vuota se la fonte non lo fornisce
  creator: string | null;
  imageUrl: string;            // immagine a piena risoluzione
  thumbnailUrl: string;        // anteprima (~400px dove disponibile)
  width?: number;              // larghezza in pixel, se disponibile
  height?: number;             // altezza in pixel, se disponibile
  sourceUrl: string;           // pagina originale con i dettagli della licenza
  license: string;             // es. "CC BY-SA 4.0", "CC0", "Public domain"
  licenseUrl: string | null;
  attributionRequired: boolean;
  attribution: string | null;  // testo da mostrare, o null se non serve
}
```

### `SearchResponse` e `ProviderStatus`

```ts
interface SearchResponse {
  query: string;     // la query normalizzata (senza spazi iniziali e finali)
  page: number;
  kind: SearchKind;  // 'image' oppure 'map'
  results: ImageResult[];
  providers: Record<string, ProviderStatus>;
  cached: boolean;
}

type ProviderStatus =
  | { ok: true; count: number }
  | { ok: false; error: string; pausedUntil?: Date };
```

### Provider inclusi

| Factory | `id` | Fonte | Opzioni |
|---|---|---|---|
| `openverse(opts?)` | `openverse` | [Openverse](https://api.openverse.org/v1/): aggregatore CC (Flickr, musei, Wikimedia…) | `pageSize` (default 20, massimo 20 senza autenticazione) |
| `wikimedia(opts?)` | `wikimedia` | [Wikimedia Commons](https://commons.wikimedia.org) | `batchSize` (default 50), `thumbWidth` (default 400) |
| `met(opts?)` | `met` | [The Met Open Access](https://metmuseum.github.io/) | `batchSize` (default 12) |
| `artic(opts?)` | `artic` | [Art Institute of Chicago](https://api.artic.edu/docs/) — **non attivo di default**, vedi Limiti noti | `pageSize` (default 20) |
| `cleveland(opts?)` | `cleveland` | [Cleveland Museum of Art Open Access](https://openaccess-api.clevelandart.org/) | `pageSize` (default 20) |
| `smithsonian(opts)` | `smithsonian` | [Smithsonian Open Access (EDAN)](https://edan.si.edu/openaccess/apidocs/) | **`apiKey`** (obbligatoria), `pageSize` (default 20), `thumbSize` (default 400) |
| `pixabay(opts)` | `pixabay` | [Pixabay](https://pixabay.com/api/docs/): foto, illustrazioni e vettoriali | **`apiKey`** (obbligatoria), `pageSize` (default 20, da 3 a 200), `imageType` (default `'photo'`), `safeSearch` (default `true`) |
| `maps(opts?)` | `maps` | Cartine geografiche da Wikimedia Commons: fisiche, politiche, mute, topografiche, satellitari e storiche | `pageSize` (default 50, max 50), `thumbWidth` (default 400) |

Note:

- **Wikimedia**: `batchSize` è il numero di file *richiesti*. Il filtro ne scarta parecchi, quindi i risultati restituiti sono di solito meno.
- **The Met**: la ricerca restituisce solo gli ID delle opere, quindi per ognuna serve una richiesta in più. Valori alti di `batchSize` rallentano.
- **AIC**: le immagini arrivano dal server IIIF del museo, a 843px (la dimensione raccomandata) e con anteprime a 200px.
- **Smithsonian**: i caratteri speciali della sintassi Lucene vengono rimossi dalla query. La chiave non compare mai negli errori (vedi `redactUrl`).
- **Pixabay**: usa la lingua di `locale` (`it` o `en`), arrotonda `pageSize` tra 3 e 200 e tronca la query a 100 caratteri. `attribution` è sempre presente perché l'API chiede di indicare la fonte. La chiave non compare mai negli errori.
- **Cartine**: `maps` è nei provider di default, ma viene interrogato **solo** con `kind: 'map'`; nelle ricerche di immagini normali non viene contattato.

### Cartine geografiche

Il provider `maps` cerca cartine già pronte su Wikimedia Commons. È incluso nei provider di default, ma viene interrogato **solo** quando la richiesta passa `kind: 'map'`.

```ts
import { PhotoFinder } from 'photofinder';

const finder = new PhotoFinder({ contact: 'dev@tuodominio.it' });

await finder.search('fisica Toscana', { kind: 'map' });
await finder.search('politica Italia', { kind: 'map' });
await finder.search('muta mondo', { kind: 'map' });
await finder.search('topografica Lombardia', { kind: 'map' });
```

L’interfaccia può aggiungere un pulsante **“Cartine”** che passa `kind: 'map'`: finché il pulsante è spento, `kind` resta `'image'` e la ricerca non interroga il provider delle cartine. Anche `#cartine` è accettato come prefisso, ma non è necessario.

Riconosce **Italia**, **mondo** e le **20 regioni italiane**. I tipi sono `fisica`, `politica`, `muta`, `topografica`, `satellitare` e `storica`; senza tipo restituisce un mix. Una query senza soggetto e senza tipo (ad esempio “gatto”) non produce cartine, anche con `kind: 'map'`.

Copertura verificata con l'API di Commons (novembre 2026):

| Categoria | File |
|---|---|
| `Relief location maps of Italy` | 42, incluse le carte in rilievo di tutte le 20 regioni (CC BY-SA 3.0) |
| `Maps of Italy` | 371, per le cartine politiche |
| `Blank maps of Italy` | 55 carte mute |
| `Blank maps of the world` | 62 |
| `Political maps of the world` | 358 |
| `Topographic maps of the world` | 154 |
| `intitle:"physical map" world` | 94 carte fisiche del mondo |

Le etichette possono essere in italiano, inglese o tedesco: il provider restituisce il titolo originale e non traduce la mappa. I risultati includono `width` e `height`, così l'interfaccia può mostrare la risoluzione e il docente può scegliere la variante più adatta.

Ogni ricerca fa da 1 a 4 richieste a Commons, una per categoria; la cache di `PhotoFinder` evita di ripeterle.

### Utility

```ts
buildAttribution(parts: AttributionParts, locale?: 'it' | 'en'): string
```
Compone la stringa TASL a partire da `{ title, creator, license, licenseUrl, sourceName, sourceUrl? }`.
Se `sourceUrl` è presente, il link alla pagina originale viene aggiunto dopo il nome della fonte.

```ts
isReusableWikimediaLicense(code?: string, shortName?: string): boolean
```
Restituisce `true` se una licenza di Commons è ammessa, ad esempio `('cc-by-sa-4.0', 'CC BY-SA 4.0')`.

```ts
interleave<T>(lists: T[][]): T[]
```
Alterna gli elementi di più liste, come avviene per i risultati.

```ts
stripHtml(html: string): string
```
Rimuove i tag HTML e decodifica le entità più comuni.

```ts
class HttpError extends Error { status: number; url: string }
```
Errore lanciato dai provider per le risposte HTTP non 2xx. In `url` le chiavi API sono oscurate.

```ts
redactUrl(url: string | URL): string
```
Sostituisce con `***` i parametri `api_key`, `wskey`, `key`, `apikey` e `token`.

## Gestione degli errori

```ts
const res = await finder.search('montagna');

for (const [id, status] of Object.entries(res.providers)) {
  if (!status.ok) {
    console.warn(`${id} non disponibile: ${status.error}`,
      status.pausedUntil ? `(riprovo dopo ${status.pausedUntil.toISOString()})` : '');
  }
}
```

Errori tipici:

| Messaggio | Causa |
|---|---|
| `The operation was aborted due to timeout` | la fonte non ha risposto entro `timeoutMs` |
| `HTTP 429`, `HTTP 504`… | limite di richieste superato o servizio non disponibile |
| `Wikimedia: cirrussearch-too-busy-error (...)` | ricerca di Commons sovraccarica. MediaWiki risponde HTTP 200 con un campo `error`, che la libreria trasforma in errore |
| `In pausa dopo un errore recente` | la fonte è stata saltata perché ha fallito da poco (vedi `pauseOnErrorMs`) |
| `Nessun provider configurato per il tipo "map"` | hai chiesto `kind: 'map'` ma non hai aggiunto il provider `maps` |

## Scrivere un provider personalizzato

Un provider è un oggetto con `id`, `name` e `search()`. Deve restituire **solo** immagini riutilizzabili e compilare `attribution` quando serve.

```ts
import { PhotoFinder, buildAttribution, type Provider } from 'photofinder';

const mioArchivio: Provider = {
  id: 'archivio',
  name: 'Archivio interno',
  async search(query, { page, locale, fetchJson }) {
    // fetchJson applica già timeout, User-Agent e annullamento; accetta { headers } aggiuntivi
    const data = await fetchJson<{ items: any[] }>(
      `https://archivio.example.it/api?q=${encodeURIComponent(query)}&p=${page}`
    );
    return data.items
      .filter((it) => it.license === 'CC BY 4.0' || it.license === 'CC0')
      .map((it) => {
        const base = {
          id: `archivio:${it.id}`,
          provider: 'Archivio interno',
          title: it.title,
          creator: it.author ?? null,
          imageUrl: it.url,
          thumbnailUrl: it.thumb,
          sourceUrl: it.page,
          license: it.license,
          licenseUrl: it.licenseUrl ?? null,
          attributionRequired: it.license !== 'CC0',
        };
        return {
          ...base,
          attribution: base.attributionRequired
            ? buildAttribution({ ...base, sourceName: 'Archivio interno' }, locale)
            : null,
        };
      });
  },
};

const finder = new PhotoFinder({ providers: ['wikimedia', mioArchivio] });
```

Un provider può dichiarare quali tipi di ricerca supporta:

```ts
const mioArchivio: Provider = {
  id: 'archivio',
  name: 'Archivio interno',
  kinds: ['map'], // senza questa proprietà vale ['image']
  async search(query, ctx) { /* ... */ },
};

const finder = new PhotoFinder({ providers: [...defaultProviders, mioArchivio] });
await finder.search('fisica Toscana', { kind: 'map' }); // interroga solo mioArchivio
```

## Limiti noti

- **Lingua delle query**: Commons e Openverse sono indicizzati soprattutto in inglese. Ad esempio, "cartina toscana" trova pochi file, "map tuscany" decine di migliaia. Per un pubblico italiano conviene tradurre la query o cercare in entrambe le lingue.
- **Openverse**: dal 20 ottobre 2026 la ricerca va in timeout per tutte le richieste non già in cache, mentre la radice dell'API risponde. È la segnalazione [WordPress/openverse#5649](https://github.com/WordPress/openverse/issues/5649), ancora aperta e senza risposta dei responsabili al 2 novembre. La libreria lo gestisce saltandolo per `pauseOnErrorMs`. Con `searchStream()` le altre fonti non devono aspettarlo.
- **The Met**: l'endpoint `/v1/search` è stato dismesso il 2026-10-01 e la libreria usa `/v1.1/search`.
- **Art Institute of Chicago — disattivato di default.** L'API dei dati funziona, ma da novembre 2026 il server delle immagini (`www.artic.edu/iiif`) risponde 403 ("Sorry, you have been blocked") anche ai browser, con `Cross-Origin-Resource-Policy: same-origin`: le immagini non si possono mostrare su siti esterni. È un [problema noto e aperto](https://github.com/art-institute-of-chicago/api-data/issues/9). Il provider resta disponibile con `providers: [..., 'artic']`, per quando verrà risolto. Non va aggirato scaricando le immagini lato server: è proprio ciò che il blocco vuole impedire.
- **Musei (Met, AIC, Cleveland, Smithsonian)**: coprono soprattutto arte, reperti e immagini storiche. Per foto contemporanee le fonti principali restano Wikimedia, Openverse e Pixabay.
- **Pixabay**: la cache in memoria predefinita dura 10 minuti, ma i termini dell'API chiedono 24 ore. Per rispettarli usa `cacheTtlMs: 86_400_000` (o una cache condivisa). Le immagini si possono mostrare nei risultati, ma non collegare in modo permanente: per usarle in una pagina o in un prodotto vanno scaricate sul tuo server. Il piano gratuito non espone l'originale e l'API restituisce al massimo 500 risultati per query.
- **Cartine**: le mappe di Commons non sono uniformi. Molte hanno etichette in tedesco o inglese, alcune sono storiche e la copertura per regione varia. Per le carte in rilievo la fonte migliore è `Relief location maps of Italy`; per le politiche `Maps of <regione>`; per le mute `Blank maps of Italy` e `Blank maps of the world`. Non è possibile ottenere colori, nomi o confini personalizzati: per quello serve un generatore cartografico separato.
- I limiti di richieste delle API cambiano nel tempo. Per un uso in produzione, consulta la documentazione di ciascuna fonte e valuta una cache condivisa (ad esempio Redis) al posto di quella in memoria.

## Sviluppo

```bash
npm install
cp .env.example .env  # poi compila le chiavi; .env è ignorato da git
npm test            # test con node:test e fetch simulato (non fanno richieste di rete)
npm run typecheck   # controllo dei tipi di src, test ed esempi
npm run build       # compila in dist/ (JS + .d.ts)
npm run demo        # app di prova su http://localhost:3000
```

`.env.example` elenca le variabili del demo: `PORT`, `PHOTOFINDER_CONTACT`, `SMITHSONIAN_API_KEY` e `PIXABAY_API_KEY`. Con Node ≥ 20.12 `npm run demo` carica `.env` automaticamente (le variabili già presenti nell'ambiente hanno la precedenza); su versioni precedenti esportale nella shell.

Struttura:

```
src/
  index.ts            export pubblici
  photofinder.ts      classe PhotoFinder (parallelismo, streaming, cache, pausa)
  types.ts            tipi pubblici
  attribution.ts      buildAttribution, stripHtml
  http.ts             fetch con timeout e User-Agent, HttpError
  providers/          openverse.ts, wikimedia.ts, maps.ts, met.ts, artic.ts, cleveland.ts, smithsonian.ts, pixabay.ts
test/                 test unitari con risposte simulate
examples/             demo-server.ts (JSON + Server-Sent Events) + public/index.html
```

Node ≥ 22.18 esegue i file `.ts` direttamente, quindi test e demo non richiedono una build. Gli import interni usano l'estensione `.ts`, che `tsc` riscrive in `.js` durante la build (`rewriteRelativeImportExtensions`).

**`dist/` è committata.** Chi installa da git (`npm i github:CesaTor/photofinder`, oppure `bun add github:CesaTor/photofinder`) riceve la build pronta: nessuna dipendenza di sviluppo, nessuno script di build, nessuna configurazione di script fidati. Dopo ogni modifica a `src/` esegui `npm run build` e committa `dist/` insieme al sorgente.

## Pubblicazione

Prima di pubblicare, verifica che il pacchetto contenga solo il necessario:

```bash
npm pack --dry-run
```

Poi pubblica su npm (lo script `prepublishOnly` esegue typecheck, test e build):

```bash
npm login
npm publish
```

Dopo la pubblicazione, aggiorna `version` in `package.json` (e la costante `VERSION` in `src/photofinder.ts`) per ogni nuova release.
