"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Etikett, Knapp, Kort, Pille, Sidetittel } from "@/components/ui";
import { leggIKo, tomKo } from "@/lib/offline/ko";

export type Rad = {
  prosjektId: string;
  nummer: string;
  navn: string;
  farge: string;
  meta: string;
  fraKalender: boolean;
};

export type ForslagVisning = {
  prosjektId: string;
  nummer: string;
  navn: string;
  farge: string;
  timer: number;
  spenn: string;
  meterFraProsjekt: number;
};

type Dag = { iso: string; off: number; dag: string; dato: string };

export type Aktivitet = { id: number; navn: string; erStandard: boolean };

/** Norsk tallformat: 3,5 — ikke 3.5. */
function nTall(t: number): string {
  return t.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
}

export function TimerSkjerm({
  dager,
  valgtDato,
  rader,
  forslag,
  aktiviteter,
  harAbax,
}: {
  dager: Dag[];
  valgtDato: string;
  rader: Rad[];
  forslag: ForslagVisning[];
  aktiviteter: Aktivitet[];
  harAbax: boolean;
}) {
  const router = useRouter();
  const [venter, startOvergang] = useTransition();

  /** Timer per prosjekt, forhåndsfylt fra kjørebokforslagene. */
  const [timer, setTimer] = useState<Record<string, number>>(() =>
    Object.fromEntries(forslag.map((f) => [f.prosjektId, f.timer])),
  );
  const [apen, setApen] = useState<string | null>(null);

  /**
   * Aktiviteten timene føres på. Avdelingens standard er forhåndsvalgt, så
   * montøren slipper å ta stilling til den på en vanlig dag — men kan bytte
   * når han faktisk har gjort noe annet.
   */
  const [aktivitetId, setAktivitetId] = useState<number | null>(
    aktiviteter.find((a) => a.erStandard)?.id ?? aktiviteter[0]?.id ?? null,
  );
  const [kvittering, setKvittering] = useState<string | null>(null);
  const [brukteForslag, setBrukteForslag] = useState(false);

  const sum = Object.values(timer).reduce((a, b) => a + b, 0);
  const antallLinjer = Object.values(timer).filter((t) => t > 0).length;

  function settTimer(prosjektId: string, verdi: number) {
    setTimer((f) => ({ ...f, [prosjektId]: Math.max(0, Math.min(24, verdi)) }));
  }

  function brukAlleForslag() {
    setTimer((f) => {
      const ny = { ...f };
      for (const forsl of forslag) ny[forsl.prosjektId] = forsl.timer;
      return ny;
    });
    setBrukteForslag(true);
  }

  function byttDato(iso: string) {
    startOvergang(() => router.push(`/timer?dato=${iso}`));
  }

  async function send() {
    const linjer = Object.entries(timer).filter(([, t]) => t > 0);
    if (linjer.length === 0 || aktivitetId === null) return;

    for (const [prosjektId, t] of linjer) {
      const rad = rader.find((r) => r.prosjektId === prosjektId);
      await leggIKo(
        "timeforing",
        {
          prosjektId,
          dato: valgtDato,
          timer: t,
          aktivitetId,
          fraKjorebok: forslag.some((f) => f.prosjektId === prosjektId && f.timer === t),
        },
        `${nTall(t)} t på ${rad?.nummer ?? prosjektId}`,
      );
    }

    setKvittering(
      `${antallLinjer === 1 ? "1 linje" : `${antallLinjer} linjer`} lagt i sendekøen.`,
    );
    setTimer({});

    // Prøver å sende med én gang. Er montøren uten nett, blir linjene
    // stående i køen og går av gårde når dekningen er tilbake.
    void tomKo();
  }

  return (
    <>
      <Sidetittel
        tittel="Før timer"
        under={
          venter ? "Henter dagen…" : `${antallLinjer} linjer klare · ${nTall(sum)} t til sammen`
        }
      />

      {/* Datostripe */}
      <div className="sc" style={{ display: "flex", gap: 6, overflowX: "auto", padding: "1px" }}>
        {dager.map((d) => {
          const aktiv = d.iso === valgtDato;
          return (
            <button
              key={d.iso}
              onClick={() => byttDato(d.iso)}
              aria-pressed={aktiv}
              style={{
                flex: "none",
                minWidth: 62,
                padding: "9px 10px",
                borderRadius: 12,
                border: "none",
                background: aktiv ? "var(--bla)" : "var(--kort)",
                color: aktiv ? "#fff" : "var(--tekst)",
                boxShadow: aktiv ? "none" : "var(--skygge)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: aktiv ? "rgba(255,255,255,.75)" : "var(--svak)",
                  textTransform: "capitalize",
                }}
              >
                {d.off === 0 ? "I dag" : d.dag}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 1 }}>{d.dato}</div>
            </button>
          );
        })}
      </div>

      {/* Kjørebokforslag */}
      {forslag.length > 0 && !brukteForslag && (
        <Kort style={{ background: "var(--bla-svak)", boxShadow: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 11,
            }}
          >
            <div>
              <Etikett style={{ color: "var(--bla-morkt)" }}>Fra kjøreboka</Etikett>
              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: 13,
                  color: "var(--tekst-2)",
                  lineHeight: 1.5,
                }}
              >
                Bilen din sto disse stedene i dag. Sjekk at det stemmer før du
                sender.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {forslag.map((f) => (
              <div
                key={f.prosjektId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--kort)",
                  borderRadius: 11,
                  padding: "10px 12px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    alignSelf: "stretch",
                    borderRadius: 999,
                    background: f.farge,
                    flex: "none",
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--svak)" }}>
                      {f.nummer}
                    </span>{" "}
                    {f.navn}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--dempet)" }}>
                    {f.spenn} · {f.meterFraProsjekt} m fra adressen
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, flex: "none" }}>
                  {nTall(f.timer)} t
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <Knapp bred onClick={brukAlleForslag}>
              Bruk alle · {nTall(forslag.reduce((a, f) => a + f.timer, 0))} t
            </Knapp>
          </div>
        </Kort>
      )}

      {brukteForslag && (
        <Kort style={{ background: "var(--gronn-bg)", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Pille farge="gronn">Fylt inn</Pille>
            <span style={{ fontSize: 13, color: "var(--gronn-tekst)", fontWeight: 600 }}>
              Forslagene fra kjøreboka er lagt inn. Endre om noe er feil.
            </span>
          </div>
        </Kort>
      )}

      {harAbax && forslag.length === 0 && (
        <p style={{ margin: "0 4px", fontSize: 12.5, color: "var(--svak)" }}>
          Ingen stopp i kjøreboka for denne dagen. Før timene manuelt under.
        </p>
      )}

      {/* Aktivitet — én for hele føringen, som i Tripletex */}
      {aktiviteter.length > 0 ? (
        <Kort style={{ padding: "13px 15px" }}>
          <label style={{ display: "block" }}>
            <Etikett>Aktivitet</Etikett>
            <select
              value={aktivitetId ?? ""}
              onChange={(e) => setAktivitetId(Number(e.target.value))}
              style={{
                width: "100%",
                marginTop: 9,
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid var(--linje)",
                fontSize: 15.5,
                fontFamily: "var(--font)",
                background: "var(--kort)",
                color: "var(--tekst)",
              }}
            >
              {aktiviteter.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.navn}
                  {a.erStandard ? " (standard)" : ""}
                </option>
              ))}
            </select>
          </label>
        </Kort>
      ) : (
        <Kort style={{ background: "var(--oransje-bg)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--oransje-tekst)", lineHeight: 1.55 }}>
            Ingen aktiviteter hentet fra Tripletex ennå. Kontoret må kjøre en
            synk før du kan føre timer.
          </p>
        </Kort>
      )}

      {/* Prosjektrader — sammenleggbare, så syv jobber går på én skjerm */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Etikett style={{ padding: "0 4px" }}>Prosjekter</Etikett>

        {rader.length === 0 && (
          <Kort>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>
              Ingen prosjekter å føre på ennå. De dukker opp her når du er satt
              opp på en jobb eller har ført på et prosjekt før.
            </p>
          </Kort>
        )}

        {rader.map((r) => {
          const erApen = apen === r.prosjektId;
          const verdi = timer[r.prosjektId] ?? 0;
          return (
            <Kort key={r.prosjektId} style={{ padding: "12px 14px" }}>
              <button
                onClick={() => setApen(erApen ? null : r.prosjektId)}
                aria-expanded={erApen}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  width: "100%",
                  background: "none",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    height: 34,
                    borderRadius: 999,
                    background: r.farge,
                    flex: "none",
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--tekst)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.navn}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--svak)" }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{r.nummer}</span> · {r.meta}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: verdi > 0 ? "var(--tekst)" : "var(--svak)",
                    flex: "none",
                  }}
                >
                  {nTall(verdi)} t
                </span>
              </button>

              {erApen && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 12,
                    paddingTop: 11,
                    borderTop: "1px solid var(--linje-svak)",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => settTimer(r.prosjektId, verdi - 0.5)}
                    aria-label="Færre timer"
                    style={knappStil}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="24"
                    value={verdi}
                    onChange={(e) => settTimer(r.prosjektId, Number(e.target.value))}
                    aria-label={`Timer på ${r.navn}`}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--linje)",
                      fontSize: 16,
                      fontWeight: 700,
                      textAlign: "center",
                      fontFamily: "var(--font)",
                    }}
                  />
                  <button
                    onClick={() => settTimer(r.prosjektId, verdi + 0.5)}
                    aria-label="Flere timer"
                    style={knappStil}
                  >
                    +
                  </button>
                </div>
              )}
            </Kort>
          );
        })}
      </div>

      {kvittering && (
        <Kort style={{ background: "var(--gronn-bg)", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Pille farge="gronn">Sendt</Pille>
            <span style={{ fontSize: 13, color: "var(--gronn-tekst)", fontWeight: 600 }}>
              {kvittering}
            </span>
          </div>
        </Kort>
      )}

      <div style={{ position: "sticky", bottom: 16, paddingTop: 4 }}>
        <Knapp
          bred
          variant="mork"
          disabled={antallLinjer === 0 || aktivitetId === null}
          onClick={() => void send()}
        >
          {aktivitetId === null
            ? "Mangler aktivitet"
            : antallLinjer === 0
              ? "Ingenting å sende"
              : `Send ${nTall(sum)} t på ${antallLinjer === 1 ? "1 prosjekt" : `${antallLinjer} prosjekter`}`}
        </Knapp>
      </div>
    </>
  );
}

const knappStil: React.CSSProperties = {
  width: 44,
  height: 42,
  borderRadius: 10,
  border: "1px solid var(--linje)",
  background: "var(--kort-2)",
  fontSize: 19,
  fontWeight: 700,
  color: "var(--tekst)",
  flex: "none",
};
