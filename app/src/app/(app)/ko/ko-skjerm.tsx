"use client";

import { useEffect, useState } from "react";
import { Etikett, Knapp, Kort, Pille, Sidetittel, Tomt } from "@/components/ui";
import { fjernFraKo, hentKo, lyttPaKo, provIgjen, tomKo, type KoLinje } from "@/lib/offline/ko";

/**
 * Sendekøen sett fra montørens side.
 *
 * Poenget er at ingenting forsvinner i stillhet: alt som ikke er kommet fram
 * står her med en forklaring han kan gjøre noe med.
 */
export function KoSkjerm() {
  const [linjer, setLinjer] = useState<KoLinje[]>([]);
  const [paaNett, setPaaNett] = useState(true);
  const [sender, setSender] = useState(false);

  useEffect(() => {
    const oppdater = () => void hentKo().then(setLinjer);
    oppdater();

    const avNett = () => setPaaNett(navigator.onLine);
    avNett();
    window.addEventListener("online", avNett);
    window.addEventListener("offline", avNett);

    const slutt = lyttPaKo(oppdater);
    return () => {
      window.removeEventListener("online", avNett);
      window.removeEventListener("offline", avNett);
      slutt();
    };
  }, []);

  async function sendAlt() {
    setSender(true);
    await tomKo();
    setLinjer(await hentKo());
    setSender(false);
  }

  const venter = linjer.filter((l) => l.status === "i_ko").length;
  const feilet = linjer.filter((l) => l.status === "feilet").length;

  return (
    <>
      <Sidetittel
        tittel="Sendekø"
        under={
          linjer.length === 0
            ? "Alt er sendt"
            : `${venter} venter${feilet > 0 ? ` · ${feilet} trenger hjelp` : ""}`
        }
      />

      {!paaNett && (
        <Kort style={{ background: "var(--oransje-bg)", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Pille farge="oransje">Uten nett</Pille>
            <span style={{ fontSize: 13, color: "var(--oransje-tekst)", fontWeight: 600 }}>
              Alt under sendes automatisk når dekningen er tilbake.
            </span>
          </div>
        </Kort>
      )}

      {linjer.length === 0 ? (
        <Tomt tekst="Ingenting ligger i kø. Alt du har ført er kommet fram til Tripletex." />
      ) : (
        <>
          <Etikett style={{ padding: "0 4px" }}>I kø</Etikett>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linjer.map((l) => (
              <Kort key={l.klientNokkel} style={{ padding: "13px 15px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tekst)" }}>
                      {l.beskrivelse}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--svak)", marginTop: 2 }}>
                      {new Intl.DateTimeFormat("nb-NO", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "numeric",
                        month: "short",
                      }).format(new Date(l.opprettet))}
                      {l.forsok > 0 && ` · ${l.forsok} forsøk`}
                    </div>
                  </div>
                  <Pille
                    farge={
                      l.status === "feilet" ? "rod" : l.status === "sender" ? "bla" : "oransje"
                    }
                  >
                    {l.status === "feilet"
                      ? "Feilet"
                      : l.status === "sender"
                        ? "Sender"
                        : "Venter"}
                  </Pille>
                </div>

                {l.feilmelding && (
                  <p
                    style={{
                      margin: "10px 0 0",
                      paddingTop: 10,
                      borderTop: "1px solid var(--linje-svak)",
                      fontSize: 12.5,
                      color: l.status === "feilet" ? "var(--rod-tekst)" : "var(--dempet)",
                      lineHeight: 1.5,
                    }}
                  >
                    {l.feilmelding}
                  </p>
                )}

                {l.status === "feilet" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
                    <Knapp variant="sekundar" onClick={() => void provIgjen(l.klientNokkel)}>
                      Prøv igjen
                    </Knapp>
                    <Knapp variant="sekundar" onClick={() => void fjernFraKo(l.klientNokkel)}>
                      Forkast
                    </Knapp>
                  </div>
                )}
              </Kort>
            ))}
          </div>

          {venter > 0 && paaNett && (
            <Knapp bred variant="mork" disabled={sender} onClick={() => void sendAlt()}>
              {sender ? "Sender…" : `Send ${venter === 1 ? "linja" : `alle ${venter}`} nå`}
            </Knapp>
          )}
        </>
      )}
    </>
  );
}
