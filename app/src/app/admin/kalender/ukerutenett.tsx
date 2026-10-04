"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Kalenderjobb } from "@/lib/data/kalender";
import { IkonFlis } from "@/components/ui";
import { Feilmelding, feltstil, useHandling } from "@/components/crm-handling";
import { prosjektfarge } from "@/lib/kalenderfarge";

/**
 * Uka som rutenett: én kolonne per dag, én rad per montør.
 *
 * Forskjellen fra forrige utgave er hvordan man setter opp uka. Før måtte
 * man åpne et skjema og velge montør og dato fra to nedtrekkslister — to
 * valg man allerede hadde gjort i hodet da man så på den tomme ruta. Nå
 * trykker man i ruta, og de to er gitt.
 *
 * Fargen følger prosjektet, ikke montøren. Radene sier allerede hvem det
 * er; det man leter etter nedover uka er hvilken jobb som går hvor, og da
 * må samme jobb ha samme farge på tvers av rader.
 *
 * På telefon ruller rutenettet sideveis i sin egen kasse. En uke med sju
 * dager blir ikke lesbar presset inn på 390 px, og en leder som er ute
 * ser som regel på én dag.
 */
const DAGNAVN = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/**
 * Markeringen av dagens kolonne.
 *
 * Første utgave brukte --flate, som er samme grå som sida rundt. Da så
 * kolonnen ut som om den falt utenfor kortet i stedet for å være
 * framhevet — særlig når det var søndag, og kolonnen lå helt ute ved
 * kanten. En svak blåtone sier «her er du» uten å ta oppmerksomhet fra
 * jobbene.
 */
const IDAGSFARGE = "rgba(37, 99, 235, .055)";

export type Montorrad = { id: string; navn: string; initialer: string; farge: string };
export type Prosjektvalg = { id: string; nummer: string; navn: string };

type Rute = { ansattId: string; dato: string } | null;

export function Ukerutenett({
  mandag,
  montorer,
  jobber,
  prosjekter,
  iDag,
}: {
  mandag: string;
  montorer: Montorrad[];
  jobber: Kalenderjobb[];
  prosjekter: Prosjektvalg[];
  iDag: string;
}) {
  const [apen, settApen] = useState<Rute>(null);
  const [valgtJobb, settValgtJobb] = useState<string | null>(null);

  const dager = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${mandag}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div
      style={{
        overflowX: "auto",
        background: "var(--kort)",
        borderRadius: "var(--r-kort)",
        boxShadow: "var(--skygge)",
      }}
    >
      {/* tableLayout: fixed — uten den vokser cellen med den lengste
          prosjekttittelen, og siste kolonne dyttes utenfor kortet. */}
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          minWidth: 960,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            <th style={{ ...hodestil, position: "sticky", left: 0, minWidth: 150 }}>Montør</th>
            {dager.map((d, i) => (
              <th
                key={d}
                style={{
                  ...hodestil,
                  borderLeft: "1px solid var(--linje)",
                  minWidth: 140,
                  background: d === iDag ? IDAGSFARGE : "var(--kort)",
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tekst)" }}>
                  {DAGNAVN[i]}
                </div>
                <div style={{ fontSize: 11, color: "var(--dempet)", fontWeight: 500 }}>
                  {d.slice(8)}.{d.slice(5, 7)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {montorer.map((m) => (
            <tr key={m.id}>
              <td
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--linje)",
                  position: "sticky",
                  left: 0,
                  background: "var(--kort)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IkonFlis farge={m.farge} storrelse={26}>
                    {m.initialer}
                  </IkonFlis>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{m.navn}</span>
                </div>
              </td>

              {dager.map((d, kolonne) => {
                const celle = jobber.filter((j) => j.ansattId === m.id && j.dato === d);
                // De to siste kolonnene står ved kanten av kortet. Et
                // skjema som åpner mot høyre der blir klippet bort av
                // rullekassa, så det speiles.
                const motVenstre = kolonne >= 5;
                const erApen = apen?.ansattId === m.id && apen?.dato === d;

                return (
                  <td
                    key={d}
                    style={{
                      padding: 6,
                      verticalAlign: "top",
                      borderBottom: "1px solid var(--linje)",
                      borderLeft: "1px solid var(--linje)",
                      background: d === iDag ? IDAGSFARGE : undefined,
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {celle.map((j) => (
                        <Jobbrute
                          key={j.tildelingId}
                          jobb={j}
                          apen={valgtJobb === j.tildelingId}
                          settApen={(v) => settValgtJobb(v ? j.tildelingId : null)}
                          montorer={montorer}
                          motVenstre={motVenstre}
                        />
                      ))}

                      {/* Tom plass er en knapp. Det er hele poenget: ruta
                          du ser på bestemmer hvem og når. */}
                      <button
                        type="button"
                        onClick={() => {
                          settValgtJobb(null);
                          settApen(erApen ? null : { ansattId: m.id, dato: d });
                        }}
                        aria-label={`Sett opp jobb for ${m.navn} ${d}`}
                        style={{
                          height: celle.length > 0 ? 22 : 40,
                          borderRadius: 8,
                          border: "1px dashed var(--linje)",
                          background: "transparent",
                          color: "var(--svak)",
                          fontSize: 15,
                          lineHeight: 1,
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>

                    {erApen && (
                      <Hurtigskjema
                        ansattId={m.id}
                        dato={d}
                        prosjekter={prosjekter}
                        motVenstre={motVenstre}
                        lukk={() => settApen(null)}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const hodestil = {
  textAlign: "left",
  padding: "11px 13px",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  letterSpacing: ".12em",
  textTransform: "uppercase",
  color: "var(--svak)",
  borderBottom: "1px solid var(--linje)",
  background: "var(--kort)",
} as const;

/**
 * Sett opp en jobb i ruta du trykket i.
 *
 * Prosjekt er det eneste som må velges. Klokkeslettene står tomme og
 * betyr «hele dagen» — de fleste jobber er det, og å kreve dem ville
 * gjort hver eneste oppføring til tre felter i stedet for ett.
 */
function Hurtigskjema({
  ansattId,
  dato,
  prosjekter,
  motVenstre,
  lukk,
}: {
  ansattId: string;
  dato: string;
  prosjekter: Prosjektvalg[];
  /** Sann i de siste kolonnene: da åpner skjemaet mot venstre. */
  motVenstre: boolean;
  lukk: () => void;
}) {
  const { kjor, jobber, feil } = useHandling();
  const [prosjektId, settProsjektId] = useState("");
  const [fraKl, settFraKl] = useState("");
  const [tilKl, settTilKl] = useState("");
  const [tilDato, settTilDato] = useState("");
  const boks = useRef<HTMLDivElement>(null);

  // Escape og klikk utenfor lukker. Et skjema man ikke blir kvitt uten å
  // fylle det ut er et skjema man vegrer seg for å åpne.
  useEffect(() => {
    function tast(e: KeyboardEvent) {
      if (e.key === "Escape") lukk();
    }
    function klikk(e: MouseEvent) {
      if (boks.current && !boks.current.contains(e.target as Node)) lukk();
    }
    document.addEventListener("keydown", tast);
    document.addEventListener("mousedown", klikk);
    return () => {
      document.removeEventListener("keydown", tast);
      document.removeEventListener("mousedown", klikk);
    };
  }, [lukk]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId) return;
    const ok = await kjor("/api/kalender/tildeling", "POST", {
      ansattId,
      prosjektId,
      dato,
      tilDato: tilDato || null,
      fraKl: fraKl || null,
      tilKl: tilKl || null,
    });
    if (ok) lukk();
  }

  return (
    <div
      ref={boks}
      style={{
        position: "absolute",
        zIndex: 30,
        top: 4,
        ...(motVenstre ? { right: 4 } : { left: 4 }),
        width: 262,
        padding: 13,
        borderRadius: 13,
        border: "1px solid var(--linje)",
        background: "var(--kort)",
        boxShadow: "0 12px 34px rgba(15,23,42,.19)",
      }}
    >
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <select
          value={prosjektId}
          onChange={(e) => settProsjektId(e.target.value)}
          required
          autoFocus
          aria-label="Prosjekt"
          style={{ ...feltstil, height: 36, fontSize: 12.5 }}
        >
          <option value="">Velg prosjekt …</option>
          {prosjekter.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nummer} {p.navn}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 7 }}>
          <input
            type="time"
            value={fraKl}
            onChange={(e) => settFraKl(e.target.value)}
            aria-label="Fra klokka"
            style={{ ...feltstil, height: 34, fontSize: 12.5, flex: 1 }}
          />
          <input
            type="time"
            value={tilKl}
            onChange={(e) => settTilKl(e.target.value)}
            aria-label="Til klokka"
            style={{ ...feltstil, height: 34, fontSize: 12.5, flex: 1 }}
          />
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 10.5, color: "var(--svak)" }}>
            Varer til og med (flerdagersjobb)
          </span>
          <input
            type="date"
            value={tilDato}
            min={dato}
            onChange={(e) => settTilDato(e.target.value)}
            style={{ ...feltstil, height: 34, fontSize: 12.5 }}
          />
        </label>

        <Feilmelding tekst={feil} />

        <div style={{ display: "flex", gap: 7 }}>
          <button
            type="submit"
            disabled={jobber || !prosjektId}
            style={{
              flex: 1,
              height: 36,
              borderRadius: 9,
              border: "none",
              background: "var(--bla)",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: prosjektId ? "pointer" : "default",
              opacity: prosjektId ? 1 : 0.55,
            }}
          >
            {jobber ? "Setter opp…" : "Sett opp"}
          </button>
          <button
            type="button"
            onClick={lukk}
            style={{
              height: 36,
              padding: "0 11px",
              borderRadius: 9,
              border: "1px solid var(--linje)",
              background: "var(--kort)",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Avbryt
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * En jobb i rutenettet.
 *
 * Et trykk åpner handlingene i stedet for å gå rett til jobbkortet.
 * Flytting en dag fram eller tilbake er det man gjør oftest når en uke
 * skal rettes opp, og å måtte innom en egen side for det gjør at man
 * heller lar det stå feil.
 */
function Jobbrute({
  jobb,
  apen,
  settApen,
  montorer,
  motVenstre,
}: {
  jobb: Kalenderjobb;
  apen: boolean;
  settApen: (v: boolean) => void;
  montorer: Montorrad[];
  motVenstre: boolean;
}) {
  const router = useRouter();
  const { kjor, jobber: sender, feil } = useHandling();
  const farge = prosjektfarge(jobb.prosjektId);

  const klokke =
    jobb.fraKl && jobb.tilKl ? `${jobb.fraKl}–${jobb.tilKl}` : (jobb.fraKl ?? "Hele dagen");

  function flyttDag(antall: number) {
    const d = new Date(`${jobb.dato}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + antall);
    void kjor("/api/kalender/tildeling", "PATCH", {
      id: jobb.tildelingId,
      dato: d.toISOString().slice(0, 10),
      fraKl: jobb.fraKl,
      tilKl: jobb.tilKl,
      notat: jobb.notat,
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => settApen(!apen)}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          minWidth: 0,
          borderRadius: 9,
          padding: "7px 8px",
          border: "none",
          borderLeft: `3px solid ${farge}`,
          background: apen ? "var(--linje-svak, var(--flate))" : "var(--flate)",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: "var(--tekst)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {jobb.nummer} {jobb.navn}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--dempet)" }}>{klokke}</div>
        {jobb.antallMedbring > 0 && (
          <div
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color:
                jobb.antallPakket === jobb.antallMedbring ? "var(--gronn)" : "var(--oransje)",
            }}
          >
            {jobb.antallPakket}/{jobb.antallMedbring} pakket
          </div>
        )}
        {jobb.kolleger.length > 0 && (
          <div style={{ fontSize: 10, color: "var(--svak)" }}>
            med {jobb.kolleger.map((k) => k.initialer).join(", ")}
          </div>
        )}
      </button>

      {apen && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "100%",
            ...(motVenstre ? { right: 0 } : { left: 0 }),
            marginTop: 4,
            width: 215,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--linje)",
            background: "var(--kort)",
            boxShadow: "0 12px 34px rgba(15,23,42,.19)",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" disabled={sender} onClick={() => flyttDag(-1)} style={ministil}>
              ‹ Dag
            </button>
            <button type="button" disabled={sender} onClick={() => flyttDag(1)} style={ministil}>
              Dag ›
            </button>
          </div>

          <select
            value={jobb.ansattId}
            disabled={sender}
            aria-label="Flytt til montør"
            onChange={(e) =>
              void kjor("/api/kalender/tildeling", "PATCH", {
                id: jobb.tildelingId,
                ansattId: e.target.value,
                fraKl: jobb.fraKl,
                tilKl: jobb.tilKl,
                notat: jobb.notat,
              })
            }
            style={{ ...feltstil, height: 32, fontSize: 12 }}
          >
            {montorer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.navn}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => router.push(`/admin/kalender/${jobb.tildelingId}`)}
            style={ministil}
          >
            Åpne jobbkortet
          </button>

          <button
            type="button"
            disabled={sender}
            onClick={() =>
              void kjor("/api/kalender/tildeling", "PATCH", {
                id: jobb.tildelingId,
                slett: true,
                fraKl: null,
                tilKl: null,
              })
            }
            style={{ ...ministil, color: "var(--rod-tekst)" }}
          >
            Fjern fra uka
          </button>

          <Feilmelding tekst={feil} />
        </div>
      )}
    </div>
  );
}

const ministil = {
  flex: 1,
  height: 32,
  padding: "0 10px",
  borderRadius: 9,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
} as const;
