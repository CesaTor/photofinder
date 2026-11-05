import type { Provider } from '../types.ts';
export interface MapsOptions {
    /** Risultati per pagina, da 1 a 50. Default: `50`. */
    pageSize?: number;
    /** Larghezza dell'anteprima in pixel. Default: `400`. */
    thumbWidth?: number;
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
export declare function maps({ pageSize, thumbWidth }?: MapsOptions): Provider;
//# sourceMappingURL=maps.d.ts.map