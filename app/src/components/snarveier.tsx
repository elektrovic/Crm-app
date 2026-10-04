import { normaliserEllerNull, tilVisning } from "@/lib/sms/telefon";

/**
 * De to knappene som faktisk sparer tid ute.
 *
 * Begge fantes før som tekst man kunne trykke på. Forskjellen er at en
 * lenke midt i en liste ikke ser ut som noe man kan trykke på — og en
 * mann med hansker treffer den uansett ikke. Her er de knapper med
 * tommelstørrelse, og de står alltid på samme sted.
 *
 * Serverkomponenter, begge to: de har ingen tilstand, bare en href.
 */

const knapp = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  // 48 px er tommelmål. Under det bommer man med hansker.
  minHeight: 48,
  padding: "0 16px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  textDecoration: "none",
  flex: "1 1 140px",
} as const;

/**
 * Veibeskrivelse, ikke bare et kart.
 *
 * `dir/?api=1&destination=` starter ruta fra der man står. `search/` ville
 * bare vist adressen på et kart, og da måtte man trykt «Kjør» selv — ett
 * trykk til, i bil.
 *
 * Google Maps-URL-en åpner appen på Android, og på iPhone enten Google
 * Maps-appen eller Apple Maps via nettleseren. Den virker alle steder,
 * og det var viktigere enn å treffe Apple Maps direkte.
 */
export function VeiKnapp({ adresse }: { adresse: string | null }) {
  if (!adresse) return null;

  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`}
      target="_blank"
      rel="noreferrer"
      style={{
        ...knapp,
        background: "var(--bla)",
        color: "#fff",
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>➤</span>
      Veibeskrivelse
    </a>
  );
}

/**
 * Ring den som åpner døra.
 *
 * Navnet står på knappen når vi har det. «Ring Bjørn» er noe annet enn
 * «Ring» — man vet hvem man får i andre enden før man trykker.
 */
export function RingKnapp({
  nummer,
  navn,
}: {
  nummer: string | null;
  navn?: string | null;
}) {
  if (!nummer) return null;

  const e164 = normaliserEllerNull(nummer);
  const fornavn = navn?.trim().split(/\s+/)[0];

  return (
    <a
      href={`tel:${e164 ?? nummer.replace(/\s/g, "")}`}
      style={{
        ...knapp,
        background: "var(--kort)",
        color: "var(--tekst)",
        border: "1px solid var(--linje)",
      }}
    >
      <span aria-hidden style={{ fontSize: 15 }}>✆</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <span>{fornavn ? `Ring ${fornavn}` : "Ring"}</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            color: "var(--svak)",
          }}
        >
          {e164 ? tilVisning(e164) : nummer}
        </span>
      </span>
    </a>
  );
}
