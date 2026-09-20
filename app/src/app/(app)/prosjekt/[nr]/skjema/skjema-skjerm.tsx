"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Etikett, Knapp, Kort, Pille, Sidetittel } from "@/components/ui";
import type { SkjemaSporsmal } from "@/db/schema";
import { lagKlientNokkel } from "@/lib/offline/ko";
import { lyttEtterTale, taleStottes } from "@/lib/tale";

/**
 * Kontrollskjema, ett spørsmål av gangen.
 *
 * Ett spørsmål per skjerm er ikke pynt: en montør som står med hansker og
 * telefon i én hånd skal se ett valg og trykke, ikke lese et skjema med
 * femten felt. Det siste steget er fritekst — der får han diktere, fordi
 * montører sjelden skriver lange avsnitt på telefon.
 */
export function SkjemaSkjerm({
  prosjektId,
  prosjektNummer,
  prosjektNavn,
  skjemaNavn,
  sporsmal,
  beskrivelseLedetekst,
}: {
  prosjektId: string;
  prosjektNummer: string;
  prosjektNavn: string;
  skjemaNavn: string;
  sporsmal: SkjemaSporsmal[];
  beskrivelseLedetekst: string | null;
}) {
  const router = useRouter();

  // Siste steg er alltid fritekstbeskrivelsen.
  const antallSteg = sporsmal.length + 1;
  const [steg, setSteg] = useState(0);
  const [svar, setSvar] = useState<Record<number, string>>({});
  const [beskrivelse, setBeskrivelse] = useState("");
  const [lytter, setLytter] = useState(false);
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [ferdig, setFerdig] = useState(false);

  const paaFritekst = steg === sporsmal.length;
  const naavaerende = sporsmal[steg];
  const kanGaaVidere = paaFritekst ? beskrivelse.trim().length > 0 : svar[steg] !== undefined;

  function velg(alternativ: string) {
    setSvar((s) => ({ ...s, [steg]: alternativ }));
    // Litt forsinkelse så montøren rekker å se at valget ble registrert.
    setTimeout(() => setSteg((n) => Math.min(n + 1, antallSteg - 1)), 180);
  }

  function diktér() {
    const lytterInstans = lyttEtterTale({
      onTekst: (ord) => setBeskrivelse((t) => (t ? `${t} ${ord}` : ord)),
      onFeil: () => {
        setFeil("Fikk ikke tak i mikrofonen. Skriv i stedet.");
        setLytter(false);
      },
      onSlutt: () => setLytter(false),
    });
    if (!lytterInstans) return;
    setFeil(null);
    setLytter(true);
    lytterInstans.start();
  }

  async function fullfor() {
    setJobber(true);
    setFeil(null);
    try {
      const respons = await fetch("/api/skjema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klientNokkel: lagKlientNokkel(),
          prosjektId,
          skjemaNavn,
          svar: sporsmal.map((s, i) => ({ sporsmal: s.tekst, svar: svar[i] ?? "" })),
          beskrivelse: beskrivelse.trim() || null,
        }),
      });

      if (!respons.ok) {
        const k = (await respons.json().catch(() => ({}))) as { feil?: string };
        setFeil(k.feil ?? "Fikk ikke lagret skjemaet.");
        return;
      }

      setFerdig(true);
      router.refresh();
    } catch {
      setFeil("Ingen forbindelse. Prøv igjen når du har dekning.");
    } finally {
      setJobber(false);
    }
  }

  if (ferdig) {
    return (
      <>
        <Sidetittel tittel={skjemaNavn} under={`${prosjektNummer} · ${prosjektNavn}`} />
        <Kort style={{ background: "var(--gronn-bg)", boxShadow: "none" }}>
          <Pille farge="gronn">Fullført</Pille>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              color: "var(--gronn-tekst)",
              lineHeight: 1.55,
            }}
          >
            {skjemaNavn} er lagret på prosjekt {prosjektNummer}. Alle {sporsmal.length}{" "}
            spørsmålene er besvart.
          </p>
        </Kort>
      </>
    );
  }

  return (
    <>
      <Sidetittel tittel={skjemaNavn} under={`${prosjektNummer} · ${prosjektNavn}`} />

      {/* Framdrift */}
      <div style={{ display: "flex", gap: 5 }}>
        {Array.from({ length: antallSteg }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: i <= steg ? "var(--bla)" : "var(--linje)",
              transition: "background .2s ease",
            }}
          />
        ))}
      </div>
      <p style={{ margin: "-6px 4px 0", fontSize: 11.5, color: "var(--svak)" }}>
        Steg {steg + 1} av {antallSteg}
      </p>

      <Kort>
        {paaFritekst ? (
          <>
            <Etikett>{beskrivelseLedetekst ?? "Beskriv arbeidet som er utført"}</Etikett>
            <textarea
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
              rows={7}
              placeholder="Skriv, eller trykk mikrofonen og snakk."
              style={{
                width: "100%",
                marginTop: 11,
                padding: "12px 13px",
                borderRadius: 11,
                border: "1px solid var(--linje)",
                fontSize: 15.5,
                lineHeight: 1.55,
                fontFamily: "var(--font)",
                resize: "vertical",
              }}
            />
            {taleStottes() && (
              <div style={{ marginTop: 9 }}>
                <Knapp variant="sekundar" onClick={diktér} disabled={lytter}>
                  {lytter ? "Hører etter…" : "Snakk inn"}
                </Knapp>
              </div>
            )}
          </>
        ) : (
          naavaerende && (
            <>
              <Etikett>Spørsmål {steg + 1}</Etikett>
              <h2
                style={{
                  margin: "9px 0 0",
                  fontSize: 19,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: "-.02em",
                  color: "var(--tekst)",
                }}
              >
                {naavaerende.tekst}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                {naavaerende.alternativer.map((a) => {
                  const erValgt = svar[steg] === a;
                  return (
                    <button
                      key={a}
                      onClick={() => velg(a)}
                      aria-pressed={erValgt}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: `1px solid ${erValgt ? "var(--bla)" : "var(--linje)"}`,
                        background: erValgt ? "var(--bla-svak)" : "var(--kort)",
                        color: erValgt ? "var(--bla-morkt)" : "var(--tekst)",
                        fontSize: 15,
                        fontWeight: 700,
                        textAlign: "left",
                      }}
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
            </>
          )
        )}
      </Kort>

      {feil && (
        <Kort style={{ background: "var(--rod-bg)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rod-tekst)", fontWeight: 600 }}>
            {feil}
          </p>
        </Kort>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {steg > 0 && (
          <Knapp variant="sekundar" onClick={() => setSteg((n) => n - 1)} disabled={jobber}>
            Tilbake
          </Knapp>
        )}

        {paaFritekst ? (
          <Knapp
            variant="mork"
            bred={steg === 0}
            disabled={!kanGaaVidere || jobber}
            onClick={() => void fullfor()}
          >
            {jobber ? "Lagrer…" : "Fullfør skjemaet"}
          </Knapp>
        ) : (
          <Knapp
            variant="sekundar"
            disabled={!kanGaaVidere}
            onClick={() => setSteg((n) => Math.min(n + 1, antallSteg - 1))}
          >
            Neste
          </Knapp>
        )}
      </div>
    </>
  );
}
