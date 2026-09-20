/**
 * Frister og sortering for oppfølgingslista.
 *
 * Rekkefølgen er hele poenget med «Oppfølging i dag»: det som er over frist
 * skal ligge øverst, deretter det som forfaller i dag, og ufordelte saker
 * skal være synlige uansett hvor de havner i tid — ellers blir de liggende.
 *
 * Ren modul uten I/O, så rekkefølgen kan testes uten en database.
 */

export const FRISTKLASSER = ["over_frist", "i_dag", "snart", "senere"] as const;
export type Fristklasse = (typeof FRISTKLASSER)[number];

/** Antall dager fram som regnes som «snart». */
const SNART_DAGER = 7;

/** Antall hele dager fra `fra` til `frist`. Negativt når fristen har gått ut. */
export function dagerTil(frist: string, fra: string): number {
  const a = Date.parse(`${fra}T00:00:00Z`);
  const b = Date.parse(`${frist}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new RangeError(`Ugyldig dato: «${frist}» eller «${fra}»`);
  }
  return Math.round((b - a) / 86_400_000);
}

export function klassifiserFrist(frist: string, iDag: string): Fristklasse {
  const dager = dagerTil(frist, iDag);
  if (dager < 0) return "over_frist";
  if (dager === 0) return "i_dag";
  if (dager <= SNART_DAGER) return "snart";
  return "senere";
}

/** «3 dager på overtid», «I dag», «Om 5 dager» — teksten som vises på raden. */
export function fristTekst(frist: string, iDag: string): string {
  const dager = dagerTil(frist, iDag);
  if (dager === 0) return "I dag";
  if (dager === 1) return "I morgen";
  if (dager === -1) return "1 dag på overtid";
  if (dager < 0) return `${Math.abs(dager)} dager på overtid`;
  return `Om ${dager} dager`;
}

export type Oppfolgingsrad = {
  id: string;
  hva: string;
  frist: string;
  ansvarligNavn: string | null;
  kundeNavn: string | null;
  fullfort: boolean;
};

export type SortertRad<T extends Oppfolgingsrad> = T & {
  klasse: Fristklasse;
  tekst: string;
  ufordelt: boolean;
};

/**
 * Sorterer oppfølgingene slik lista skal leses: over frist først, deretter
 * i dag, så framover i tid. Innenfor samme dato kommer ufordelte saker
 * først — de trenger en eier før de trenger noe annet.
 *
 * Fullførte rader faller ut.
 */
export function sorterOppfolginger<T extends Oppfolgingsrad>(
  rader: T[],
  iDag: string,
): SortertRad<T>[] {
  return rader
    .filter((r) => !r.fullfort)
    .map((r) => ({
      ...r,
      klasse: klassifiserFrist(r.frist, iDag),
      tekst: fristTekst(r.frist, iDag),
      ufordelt: r.ansvarligNavn === null,
    }))
    .sort((a, b) => {
      // Eldste frist først, uansett klasse — det gir over frist øverst.
      if (a.frist !== b.frist) return a.frist < b.frist ? -1 : 1;
      // Samme dato: ufordelt før tildelt.
      if (a.ufordelt !== b.ufordelt) return a.ufordelt ? -1 : 1;
      return a.hva.localeCompare(b.hva, "nb-NO");
    });
}

/** Tallene i toppen av oppfølgingsskjermen. */
export function tellFrister<T extends Oppfolgingsrad>(
  rader: SortertRad<T>[],
): { overFrist: number; iDag: number; ufordelt: number } {
  return {
    overFrist: rader.filter((r) => r.klasse === "over_frist").length,
    iDag: rader.filter((r) => r.klasse === "i_dag").length,
    ufordelt: rader.filter((r) => r.ufordelt).length,
  };
}
