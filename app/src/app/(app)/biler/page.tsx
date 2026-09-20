import { krevOkt } from "@/lib/tilgang";
import { abax, type AbaxKjoretoy } from "@/lib/abax/client";
import { Etikett, Kort, Pille, Sidetittel, Tomt } from "@/components/ui";

export const metadata = { title: "Bilkart · Montørappen" };

// Posisjoner endrer seg hele tiden, men ikke sekund for sekund.
// Ett minutts buffer sparer ABAX for kall uten at kartet blir gammelt.
export const revalidate = 60;

function alder(tidspunkt?: string): string {
  if (!tidspunkt) return "Ukjent tidspunkt";
  const min = Math.round((Date.now() - new Date(tidspunkt).getTime()) / 60000);
  if (min < 2) return "Nå nettopp";
  if (min < 60) return `${min} min siden`;
  const t = Math.round(min / 60);
  return t === 1 ? "1 time siden" : `${t} timer siden`;
}

export default async function Biler() {
  const okt = await krevOkt();

  let kjoretoy: AbaxKjoretoy[] = [];
  let feil: string | null = null;

  try {
    kjoretoy = await abax.kjoretoy();
  } catch (e) {
    feil = e instanceof Error ? e.message : "Ukjent feil mot ABAX.";
    console.error("Klarte ikke å hente kjøretøy fra ABAX", e);
  }

  return (
    <>
      <Sidetittel
        tittel="Bilkart"
        under={feil ? "Kunne ikke hente fra ABAX" : `${kjoretoy.length} biler i ABAX`}
      />

      {feil && (
        <Kort style={{ background: "var(--rod-bg)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rod-tekst)", lineHeight: 1.55 }}>
            Fikk ikke kontakt med ABAX. Prøv igjen om litt — er det fortsatt
            feil, si fra til kontoret.
          </p>
        </Kort>
      )}

      {!feil && kjoretoy.length === 0 && (
        <Tomt tekst="Ingen biler kom tilbake fra ABAX. Sjekk at API-tilgangen dekker kjøretøy." />
      )}

      {kjoretoy.length > 0 && (
        <>
          <Etikett style={{ padding: "0 4px" }}>Biler</Etikett>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kjoretoy.map((k) => {
              const min = k.location?.timestamp
                ? (Date.now() - new Date(k.location.timestamp).getTime()) / 60000
                : Infinity;
              const erDin = k.id === okt.abaxVehicleId;

              return (
                <Kort key={k.id} style={{ padding: "13px 15px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--tekst)",
                          }}
                        >
                          {k.license_plate ?? "Uten regnr"}
                        </span>
                        {erDin && <Pille farge="bla">Din bil</Pille>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--tekst-2)", marginTop: 3 }}>
                        {k.alias ?? "Uten navn"}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--svak)", marginTop: 2 }}>
                        {alder(k.location?.timestamp)}
                        {k.location &&
                          ` · ${k.location.latitude.toFixed(4)}, ${k.location.longitude.toFixed(4)}`}
                      </div>
                    </div>
                    <Pille farge={min < 15 ? "gronn" : "noytral"}>
                      {min < 15 ? "Fersk" : "Eldre"}
                    </Pille>
                  </div>
                </Kort>
              );
            })}
          </div>
        </>
      )}

      <Kort style={{ background: "var(--kort-2)", boxShadow: "none" }}>
        <Etikett>Om posisjonsdata</Etikett>
        <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "var(--dempet)", lineHeight: 1.55 }}>
          Posisjonene brukes til å finne nærmeste ledige bil og til å foreslå
          timer du selv bekrefter. De brukes ikke til å vurdere arbeidsinnsats.
        </p>
      </Kort>
    </>
  );
}
