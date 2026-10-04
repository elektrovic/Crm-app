/**
 * Fargen en jobb får i ukerutenettet.
 *
 * Fargen følger prosjektet, ikke montøren. Radene i rutenettet sier
 * allerede hvem det er; det man leter etter når man ser nedover uka er
 * hvilken jobb som går hvor, og da må samme jobb ha samme farge på tvers
 * av rader og dager.
 *
 * Den regnes ut av prosjektets id i stedet for å lagres. Det betyr at
 * fargen er den samme hver gang uten at noen må velge den, og at et
 * prosjekt som kommer inn fra Tripletex har farge med en gang.
 */

/**
 * Tolv farger som er til å skille fra hverandre.
 *
 * Alle er mørke nok til at hvit tekst ikke trengs — de brukes som
 * venstrekant mot en lys flate, ikke som bakgrunn, nettopp for at
 * teksten skal være lesbar uansett hvilken farge som faller på.
 */
export const KALENDERFARGER = [
  "#2563EB",
  "#0F766E",
  "#A855F7",
  "#F97316",
  "#DC2626",
  "#0EA5E9",
  "#65A30D",
  "#DB2777",
  "#7C3AED",
  "#CA8A04",
  "#059669",
  "#E11D48",
] as const;

/**
 * Samme id gir alltid samme farge.
 *
 * FNV-1a er valgt fordi den er kort, stabil og sprer godt nok. Dette er
 * ikke kryptografi — det er en farge.
 */
export function prosjektfarge(id: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const n = Math.abs(h) % KALENDERFARGER.length;
  return KALENDERFARGER[n] ?? KALENDERFARGER[0];
}
