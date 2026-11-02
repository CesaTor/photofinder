// App di prova: barra di ricerca + griglia di risultati.
// Avvio: `npm run demo`. Variabili d'ambiente opzionali:
//   PORT=xxxx                 porta (default 3000)
//   PHOTOFINDER_CONTACT=...   contatto per lo User-Agent (consigliato da Wikimedia e AIC)
//   SMITHSONIAN_API_KEY=...   attiva Smithsonian (chiave gratuita da https://api.data.gov/signup/)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { PhotoFinder, defaultProviders, smithsonian, type BuiltinProviderId, type Provider } from '../src/index.ts';

const PORT = Number(process.env.PORT) || 3000;
const providers: Array<BuiltinProviderId | Provider> = [...defaultProviders];
if (process.env.SMITHSONIAN_API_KEY) providers.push(smithsonian({ apiKey: process.env.SMITHSONIAN_API_KEY }));
const finder = new PhotoFinder({ contact: process.env.PHOTOFINDER_CONTACT, providers });

function send(res: http.ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

/**
 * Ricerca in streaming con Server-Sent Events: un evento `start`, uno `provider`
 * per ogni fonte appena risponde, poi `done`. Se il browser chiude la connessione,
 * le richieste ancora in corso verso le fonti vengono annullate.
 */
async function streamSearch(req: http.IncomingMessage, res: http.ServerResponse, q: string, page: number) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const ctrl = new AbortController();
  res.on('close', () => ctrl.abort());
  const emit = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    for await (const ev of finder.searchStream(q, { page, signal: ctrl.signal })) {
      // In `done` i risultati sono già stati inviati provider per provider: basta lo stato finale.
      if (ev.type === 'done') emit('done', { providers: ev.response.providers, cached: ev.response.cached });
      else emit(ev.type, ev);
    }
  } catch (err) {
    if (ctrl.signal.aborted) return; // il client se n'è andato
    console.error(err);
    // Non "error": è il nome riservato da EventSource agli errori di connessione.
    emit('failure', { error: err instanceof Error ? err.message : String(err) });
  }
  res.end();
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    try {
      if (url.pathname === '/') {
        const html = await readFile(new URL('./public/index.html', import.meta.url), 'utf8');
        return send(res, 200, html, 'text/html; charset=utf-8');
      }
      if (url.pathname === '/api/search' || url.pathname === '/api/search/stream') {
        const q = url.searchParams.get('q')?.trim();
        if (!q) return send(res, 400, { error: 'Parametro "q" mancante' });
        const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
        if (url.pathname === '/api/search') return send(res, 200, await finder.search(q, { page }));
        return streamSearch(req, res, q, page);
      }
      send(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error(err);
      send(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  })
  .listen(PORT, () => console.log(`photofinder demo su http://localhost:${PORT}`));
