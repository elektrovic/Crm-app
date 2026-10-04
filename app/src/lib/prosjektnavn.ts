/**
 * Prosjektnavnet slik det skal vises.
 *
 * Tripletex sitt `displayName` har som regel nummeret foran navnet allerede
 * — «20006 Gregers Grams vei 3». Viser vi nummeret ved siden av, står det
 * to ganger: «20006 20006 Gregers Grams vei 3».
 *
 * Vi retter det ved visning, ikke ved import. Navnet i databasen skal være
 * det Tripletex sier, så en som leter etter et prosjekt finner det samme
 * her som der. Det er bare øynene som skal slippe gjentakelsen.
 */
export function utenNummer(nummer: string, navn: string): string {
  const n = nummer.trim();
  if (!n) return navn.trim();

  const rent = navn.trim();
  if (!rent.startsWith(n)) return rent;

  // Bare når nummeret står alene foran. «20061» skal ikke klippes av
  // «200610 Noe», og «2006-noe» er et navn, ikke et nummer og en tekst.
  const resten = rent.slice(n.length);
  const skille = /^[\s–—:.\-–—]+/.exec(resten);
  if (!skille) return rent;

  const igjen = resten.slice(skille[0].length).trim();
  // Står det ingenting igjen, var nummeret hele navnet. Behold det heller
  // enn å vise en tom linje.
  return igjen.length > 0 ? igjen : rent;
}
