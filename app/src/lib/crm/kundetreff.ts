import { normaliserEllerNull } from "../sms/telefon";

/**
 * Hvilken kunde et telefonnummer hører til.
 *
 * Et nummer kan skrives på mange måter — «922 41 088», «92241088»,
 * «+47 922 41 088» — så sammenligningen skjer mot normaliserte former og
 * ikke mot teksten slik den tilfeldigvis ble tastet.
 *
 * Ved flere treff kobles ingenting. To kunder på samme nummer er vanlig i
 * praksis: et sameie og entreprenøren deler styrelederens mobil. Da er det
 * et menneske som vet hvem som ringte, ikke vi — og en sak koblet til feil
 * kunde er verre enn en sak uten kunde, fordi den feilen ikke synes.
 */
export function velgKunde<T extends { id: string; telefon: string | null }>(
  raattNummer: string | null | undefined,
  kunder: T[],
): string | null {
  const nummer = normaliserEllerNull(raattNummer);
  if (!nummer) return null;

  const treff = kunder.filter((k) => normaliserEllerNull(k.telefon) === nummer);
  return treff.length === 1 ? treff[0]!.id : null;
}
