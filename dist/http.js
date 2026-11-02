/** Parametri di query che contengono chiavi API e non devono comparire negli errori. */
const SECRET_PARAMS = ['api_key', 'wskey', 'key', 'apikey', 'token'];
/** Restituisce l'URL con le chiavi API sostituite da `***`. */
export function redactUrl(url) {
    try {
        const u = new URL(url);
        for (const p of SECRET_PARAMS)
            if (u.searchParams.has(p))
                u.searchParams.set(p, '***');
        return u.toString();
    }
    catch {
        return String(url);
    }
}
/** Errore HTTP restituito da un provider. `url` ha le chiavi API oscurate. */
export class HttpError extends Error {
    status;
    url;
    constructor(status, url) {
        super(`HTTP ${status}`);
        this.name = 'HttpError';
        this.status = status;
        this.url = redactUrl(url);
    }
}
export function createFetchJson({ fetch, userAgent, timeoutMs, signal }) {
    return async (url, init) => {
        const timeout = AbortSignal.timeout(timeoutMs);
        const res = await fetch(url, {
            headers: { 'User-Agent': userAgent, Accept: 'application/json', ...init?.headers },
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (!res.ok)
            throw new HttpError(res.status, String(url));
        return (await res.json());
    };
}
//# sourceMappingURL=http.js.map