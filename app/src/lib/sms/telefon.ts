/**
 * Telefonnummer.
 *
 * Numre kommer inn fra Tripletex og fra folk som skriver dem for hånd, i
 * alle varianter: «922 41 088», «+47 92241088», «0047 922 41 088».
 * Alt normaliseres til E.164 før det sendes, ellers avvises meldingen av
 * operatøren — eller verre, den går til feil person.
 *
 * Ren modul uten I/O.
 */

/** Landkode brukt når nummeret ikke har en. */
const STANDARD_LANDKODE = "47";

export class UgyldigNummerFeil extends Error {
  constructor(readonly raatt: string) {
    super(`«${raatt}» ser ikke ut som et gyldig mobilnummer.`);
    this.name = "UgyldigNummerFeil";
  }
}

/**
 * Gjør et nummer om til E.164 (+4792241088).
 * Kaster hvis nummeret ikke kan være et norsk mobilnummer.
 */
export function normaliserNummer(raatt: string, landkode = STANDARD_LANDKODE): string {
  const bare = raatt.replace(/[\s\-().]/g, "");
  if (bare.length === 0) throw new UgyldigNummerFeil(raatt);

  let siffer: string;

  if (bare.startsWith("+")) {
    siffer = bare.slice(1);
  } else if (bare.startsWith("00")) {
    siffer = bare.slice(2);
  } else if (bare.length === 8) {
    // Åtte siffer uten landkode er et norsk nummer.
    siffer = landkode + bare;
  } else {
    siffer = bare;
  }

  if (!/^\d+$/.test(siffer)) throw new UgyldigNummerFeil(raatt);

  // Norske mobilnumre er åtte siffer og starter på 4 eller 9.
  if (siffer.startsWith(STANDARD_LANDKODE)) {
    const nasjonalt = siffer.slice(STANDARD_LANDKODE.length);
    if (nasjonalt.length !== 8 || !/^[49]/.test(nasjonalt)) {
      throw new UgyldigNummerFeil(raatt);
    }
  } else if (siffer.length < 8 || siffer.length > 15) {
    // Utenlandske numre sjekker vi bare grovt — E.164 tillater 15 siffer.
    throw new UgyldigNummerFeil(raatt);
  }

  return `+${siffer}`;
}

/** Som normaliserNummer, men gir null i stedet for å kaste. */
export function normaliserEllerNull(raatt: string | null | undefined): string | null {
  if (!raatt) return null;
  try {
    return normaliserNummer(raatt);
  } catch {
    return null;
  }
}

/** «+4792241088» → «922 41 088», til visning i grensesnittet. */
export function tilVisning(e164: string): string {
  const m = /^\+47(\d{8})$/.exec(e164);
  if (!m) return e164;
  const n = m[1]!;
  return `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5)}`;
}
