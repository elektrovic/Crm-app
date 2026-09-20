/**
 * Adressetekst inn, søkestreng ut.
 *
 * Tripletex gir oss adressen som fritekst — «Bekkeveien 4, 0596 Oslo».
 * Kartverket vil ha den litt ryddigere enn som så, og et postnummer er
 * verdt mer enn et bynavn når to gater deler navn.
 *
 * Ren modul uten I/O, så oppryddingen kan testes uten å ringe noen.
 */

export type Adressedeler = {
  /** Gateadressen alene: «Bekkeveien 4». */
  gate: string;
  postnummer: string | null;
  poststed: string | null;
};

/**
 * Plukker adressen fra hverandre.
 *
 * Formene som faktisk kommer fra Tripletex:
 *   «Bekkeveien 4, 0596 Oslo»
 *   «Bekkeveien 4 0596 Oslo»
 *   «Bekkeveien 4»
 *   «Turbinveien 12, 0195 OSLO»
 */
export function delOppAdresse(raa: string): Adressedeler | null {
  const rensket = raa.replace(/\s+/g, " ").trim();
  if (rensket.length === 0) return null;

  // Postnummer er fire siffer som står alene, og alt etter er poststed.
  const treff = /^(.*?)[,\s]+(\d{4})\s+(.+)$/.exec(rensket);
  if (treff) {
    const gate = treff[1]!.replace(/,\s*$/, "").trim();
    if (gate.length === 0) return null;
    return {
      gate,
      postnummer: treff[2]!,
      poststed: treff[3]!.trim(),
    };
  }

  // Ingen postnummer — da er hele strengen gateadressen.
  return { gate: rensket.replace(/,\s*$/, "").trim(), postnummer: null, poststed: null };
}

/**
 * Søkestrengen vi sender til Kartverket.
 *
 * Poststedet utelates med vilje når vi har postnummeret: postnummeret er
 * entydig, og et bynavn skrevet med varierende store bokstaver gir bare
 * flere måter å bomme på.
 */
export function tilSokestreng(deler: Adressedeler): string {
  return deler.postnummer ? `${deler.gate} ${deler.postnummer}` : deler.gate;
}

/** Sant når to koordinater er så nær hverandre at forskjellen ikke betyr noe. */
export function sammePunkt(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): boolean {
  // Fem desimaler er drøyt én meter — under det er det støy.
  return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lon - b.lon) < 0.00001;
}
