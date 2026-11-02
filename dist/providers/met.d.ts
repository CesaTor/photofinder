import type { Provider } from '../types.ts';
export interface MetOptions {
    /**
     * Opere da richiedere per pagina. La ricerca restituisce solo ID, quindi per
     * ognuna serve una richiesta in più: valori alti rallentano. Default: `12`.
     */
    batchSize?: number;
}
/**
 * [The Metropolitan Museum of Art](https://metmuseum.github.io/): opere d'arte
 * e oggetti storici. Restituisce solo le opere `isPublicDomain`, rilasciate in CC0.
 * Non richiede chiave API.
 */
export declare function met({ batchSize }?: MetOptions): Provider;
//# sourceMappingURL=met.d.ts.map