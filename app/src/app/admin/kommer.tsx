import { Etikett, Kort, Sidetittel } from "@/components/ui";

/**
 * Seksjoner som har plass i menyen, men ikke er bygget ennå.
 *
 * En tom fane som bare sier «kommer» er verdiløs. Derfor viser denne hva
 * som allerede ligger i databasen for området, og hva skjermen skal gjøre
 * når den bygges. Da ser man forskjellen på «det finnes ikke data» og
 * «dataene finnes, grensesnittet mangler» — og vet hvor man starter.
 */
export type Grunnlag = { hva: string; antall: number; enhet?: string };

export function Kommer({
  tittel,
  under,
  hensikt,
  grunnlag,
  avhenger,
}: {
  tittel: string;
  under: string;
  /** Hva skjermen skal gjøre når den er bygget. */
  hensikt: string[];
  /** Hva som allerede ligger i databasen for dette området. */
  grunnlag: Grunnlag[];
  /** Det som må på plass utenfor appen først, om noe. */
  avhenger?: string;
}) {
  return (
    <>
      <Sidetittel tittel={tittel} under={under} />

      <Kort>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                background: "var(--gul-flate, #FEF3C7)",
                color: "#92400E",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              Ikke bygget
            </span>
            <span style={{ fontSize: 13, color: "var(--dempet)" }}>
              Seksjonen har plass i menyen. Skjermen kommer.
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <Etikett>Skal gjøre</Etikett>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 5 }}>
              {hensikt.map((p) => (
                <li key={p} style={{ fontSize: 13.5, color: "var(--tekst)" }}>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Etikett>Ligger i databasen alt</Etikett>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {grunnlag.map((g) => (
                <div
                  key={g.hva}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--linje)",
                    minWidth: 112,
                  }}
                >
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      letterSpacing: "-.02em",
                      color: g.antall === 0 ? "var(--svak)" : "var(--tekst)",
                    }}
                  >
                    {g.antall}
                    {g.enhet ? <span style={{ fontSize: 12.5 }}> {g.enhet}</span> : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--dempet)" }}>{g.hva}</div>
                </div>
              ))}
            </div>
          </div>

          {avhenger && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--flate)",
                fontSize: 12.5,
                color: "var(--dempet)",
              }}
            >
              <strong style={{ color: "var(--tekst)" }}>Venter på:</strong> {avhenger}
            </div>
          )}
        </div>
      </Kort>
    </>
  );
}
