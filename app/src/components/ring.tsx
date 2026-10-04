import { normaliserEllerNull, tilVisning } from "@/lib/sms/telefon";

/**
 * Et telefonnummer du kan trykke på.
 *
 * `tel:`-lenker virker på telefon og på Mac, og gjør ingenting på en PC
 * uten telefoni. Det er greit — nummeret er lesbart uansett, og det var
 * halve poenget: før måtte man innom Kunder for å se det i det hele tatt.
 *
 * Vises i pen norsk form, men lenka bruker internasjonal form, fordi det
 * er den telefonen forstår uten å gjette landkode.
 *
 * Dette er en serverkomponent, og det er med vilje: den har ingen
 * tilstand. Første utgave hadde en onClick for å stoppe klikket fra å
 * boble opp — den veltet hele sida, fordi en serverkomponent ikke kan ta
 * imot hendelseshåndterere. Den var dessuten unødvendig: lenka står ved
 * siden av de andre lenkene, ikke inni dem.
 */
export function Ring({
  nummer,
  storrelse = 12.5,
}: {
  nummer: string | null;
  storrelse?: number;
}) {
  if (!nummer) return null;

  const e164 = normaliserEllerNull(nummer);
  const vist = e164 ? tilVisning(e164) : nummer;

  return (
    <a
      href={`tel:${e164 ?? nummer.replace(/\s/g, "")}`}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: storrelse,
        color: "var(--bla)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {vist}
    </a>
  );
}
