/** Geometri. Ren modul uten I/O, slik at den kan testes fritt. */

export type Punkt = { lat: number; lon: number };

/** Avstand i meter mellom to punkter (haversine). */
export function avstandMeter(a: Punkt, b: Punkt): number {
  const R = 6_371_000;
  const tilRad = (g: number) => (g * Math.PI) / 180;
  const dLat = tilRad(b.lat - a.lat);
  const dLon = tilRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(tilRad(a.lat)) * Math.cos(tilRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
