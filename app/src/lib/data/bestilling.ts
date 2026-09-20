/**
 * Bestillingslista som sendes til daglig leder.
 *
 * Formatet er laget for å limes rett inn i en bestilling hos grossisten:
 * prosjektnummeret øverst så det er sporbart, én vare per linje, og hvem
 * som meldte den inn så leder vet hvem han skal spørre.
 *
 * Ren modul uten I/O.
 */

export type BestillingsLinje = {
  tekst: string;
  antall: string | null;
  lagtInnAvNavn: string;
  taltInn: boolean;
};

export type BestillingsInput = {
  prosjektnummer: string;
  prosjektnavn: string;
  adresse: string | null;
  linjer: BestillingsLinje[];
  sendtAv: string;
};

export function emne(input: BestillingsInput): string {
  const antall = input.linjer.length;
  return `Materiell til prosjekt ${input.prosjektnummer} — ${antall} ${
    antall === 1 ? "vare" : "varer"
  }`;
}

export function brodtekst(input: BestillingsInput): string {
  const linjer = input.linjer.map((l) => {
    const antall = l.antall ? `${l.antall} ` : "";
    return `- ${antall}${l.tekst}  (${l.lagtInnAvNavn})`;
  });

  const hode = [
    `Prosjekt ${input.prosjektnummer} — ${input.prosjektnavn}`,
    input.adresse ? `Adresse: ${input.adresse}` : null,
    "",
    "Mangler på prosjektet:",
  ].filter((l): l is string => l !== null);

  return [
    ...hode,
    ...linjer,
    "",
    `Meldt inn av ${input.sendtAv} via Montørappen.`,
    `Merk bestillingen med prosjekt ${input.prosjektnummer}.`,
  ].join("\n");
}
