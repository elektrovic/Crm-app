/**
 * Hvilken kunde en samtale handlet om.
 *
 * Pocket gir oss en tittel og et sammendrag — ikke et telefonnummer. Så
 * koblingen må gjøres på navn, og det er mindre pålitelig enn et nummer.
 *
 * Derfor er regelen streng: kundens navn må stå i teksten, og bare én
 * kunde kan treffe. «Selvaag» i en tittel er godt nok; to kunder som
 * begge heter noe med «Sameiet» er det ikke.
 *
 * Treffer ingen eller flere, blir samtalen stående ukoblet — og det er
 * meningen. En samtale lagt på feil kunde er verre enn en ukoblet, fordi
 * den feilen ikke synes.
 */
export type Kundenavn = { id: string; navn: string };

/** Ord som finnes i halvparten av alle firmanavn og ikke skiller noen. */
const INTETSIGENDE = new Set([
  "as",
  "asa",
  "ans",
  "da",
  "sameiet",
  "sameie",
  "borettslag",
  "brl",
  "eiendom",
  "bolig",
  "gruppen",
  "og",
  "the",
]);

/** Delene av et kundenavn som faktisk kan kjenne det igjen. */
export function kjennetegn(navn: string): string[] {
  return navn
    .toLowerCase()
    .split(/[^a-zåæøäöé0-9]+/i)
    .filter((o) => o.length >= 4 && !INTETSIGENDE.has(o));
}

export function velgKundeFraTekst(
  tekst: string | null | undefined,
  kunder: Kundenavn[],
): string | null {
  const t = (tekst ?? "").toLowerCase();
  if (t.length < 3) return null;

  const treff = kunder.filter((k) => {
    const ord = kjennetegn(k.navn);
    // Uten kjennetegn kan vi ikke si noe. «AS» alene treffer alt.
    if (ord.length === 0) return false;
    return ord.some((o) => t.includes(o));
  });

  return treff.length === 1 ? treff[0]!.id : null;
}
