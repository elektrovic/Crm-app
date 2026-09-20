/**
 * Ukeberegning.
 *
 * Ren modul uten I/O, så den kan testes fritt — og fordi datologikk er lett
 * å bomme på: all regning gjøres i UTC, slik at uka ikke forskyver seg den
 * helga klokka stilles.
 */

/** Mandag i uka som inneholder `dato`, som ISO-dato. */
export function mandagen(dato: string): string {
  const d = new Date(`${dato}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Ugyldig dato: «${dato}»`);
  // getUTCDay: 0 = søndag. Vi vil ha mandag som første dag i uka.
  const forskyvning = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - forskyvning);
  return d.toISOString().slice(0, 10);
}

export type Ukedag = { iso: string; navn: string; dato: string };

/** De fem virkedagene fra og med `mandag`. */
export function ukedager(mandag: string): Ukedag[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(`${mandag}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) throw new RangeError(`Ugyldig dato: «${mandag}»`);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      navn: new Intl.DateTimeFormat("nb-NO", { weekday: "short", timeZone: "UTC" }).format(d),
      dato: new Intl.DateTimeFormat("nb-NO", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(d),
    };
  });
}
