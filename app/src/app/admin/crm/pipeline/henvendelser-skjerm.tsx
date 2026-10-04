"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Etikett, Knapp, Kort, Pille } from "@/components/ui";
import type { Kanal, PipelineTrinn } from "@/db/schema";

export type Henvendelse = {
  id: string;
  kanal: Kanal;
  mottatt: string;
  innhold: string;
  avsenderNavn: string | null;
  avsenderTelefon: string | null;
  avsenderEpost: string | null;
  trinn: PipelineTrinn;
  aiSammendrag: string | null;
  aiKategori: string | null;
  aiHastegrad: string | null;
  aiVurdert: string | null;
  aiModell: string | null;
};

const KANALNAVN: Record<Kanal, string> = {
  telefon: "Telefon",
  epost: "E-post",
  nettskjema: "Nettskjema",
  anbefaling: "Anbefaling",
};

const KATEGORINAVN: Record<string, string> = {
  nytt_oppdrag: "Nytt oppdrag",
  service: "Service",
  reklamasjon: "Reklamasjon",
  tilbudsforesporsel: "Tilbudsforespørsel",
  faktura: "Faktura",
  annet: "Annet",
};

const HASTEGRAD: Record<string, { tekst: string; farge: "rod" | "oransje" | "bla" | "noytral" }> = {
  akutt: { tekst: "Akutt", farge: "rod" },
  hoy: { tekst: "Haster", farge: "oransje" },
  normal: { tekst: "Normal", farge: "bla" },
  lav: { tekst: "Lav", farge: "noytral" },
};

/**
 * Innboksen: alle kanaler i én liste til venstre, valgt henvendelse med
 * AI-forslag til høyre.
 *
 * AI-blokka er tydelig merket som forslag. Den viser hvilken modell som
 * svarte, slik at et rart forslag kan spores tilbake — og saksbehandleren
 * skal alltid kunne overprøve den uten friksjon.
 */
export function HenvendelserSkjerm({
  henvendelser,
  kanTriagere,
}: {
  henvendelser: Henvendelse[];
  kanTriagere: boolean;
}) {
  const router = useRouter();
  const [kanalFilter, setKanalFilter] = useState<Kanal | "alle">("alle");
  const [valgtId, setValgtId] = useState<string | null>(henvendelser[0]?.id ?? null);
  const [vurderer, setVurderer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const synlige =
    kanalFilter === "alle" ? henvendelser : henvendelser.filter((h) => h.kanal === kanalFilter);
  const valgt = henvendelser.find((h) => h.id === valgtId) ?? null;

  async function triager(id: string) {
    setVurderer(true);
    setFeil(null);
    try {
      const svar = await fetch("/api/henvendelser/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!svar.ok) {
        const k = (await svar.json().catch(() => ({}))) as { feil?: string };
        setFeil(k.feil ?? "Klarte ikke å vurdere henvendelsen.");
        return;
      }
      router.refresh();
    } catch {
      setFeil("Ingen forbindelse til tjenesten.");
    } finally {
      setVurderer(false);
    }
  }

  return (
    <>
      <style>{`
        .innboks { display: grid; grid-template-columns: minmax(280px, 380px) 1fr; gap: 16px; align-items: start; }
        @media (max-width: 900px) { .innboks { grid-template-columns: 1fr; } }
      `}</style>

      <div className="sc" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {(["alle", "telefon", "epost", "nettskjema"] as const).map((k) => {
          const aktiv = kanalFilter === k;
          const antall =
            k === "alle" ? henvendelser.length : henvendelser.filter((h) => h.kanal === k).length;
          return (
            <button
              key={k}
              onClick={() => setKanalFilter(k)}
              aria-pressed={aktiv}
              style={{
                flex: "none",
                padding: "7px 13px",
                borderRadius: 999,
                border: "none",
                background: aktiv ? "var(--mork)" : "var(--kort)",
                color: aktiv ? "#fff" : "var(--tekst-2)",
                boxShadow: aktiv ? "none" : "var(--skygge)",
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {k === "alle" ? "Alle" : KANALNAVN[k]} · {antall}
            </button>
          );
        })}
      </div>

      <div className="innboks">
        {/* Lista */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {synlige.length === 0 && (
            <Kort>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>
                Ingen henvendelser på denne kanalen.
              </p>
            </Kort>
          )}

          {synlige.map((h) => {
            const aktiv = h.id === valgtId;
            const hast = h.aiHastegrad ? HASTEGRAD[h.aiHastegrad] : null;

            return (
              <Kort key={h.id} style={{ padding: 0 }} loft={aktiv}>
                <button
                  onClick={() => setValgtId(h.id)}
                  aria-pressed={aktiv}
                  style={{
                    display: "block",
                    width: "100%",
                    background: aktiv ? "var(--bla-svak)" : "transparent",
                    border: "none",
                    borderRadius: "var(--r-kort)",
                    padding: "13px 15px",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 9,
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--tekst)" }}>
                      {h.avsenderNavn ?? "Ukjent avsender"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--svak)", flex: "none" }}>
                      {new Intl.DateTimeFormat("nb-NO", {
                        day: "numeric",
                        month: "short",
                      }).format(new Date(h.mottatt))}
                    </span>
                  </span>

                  <span
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      fontSize: 12.5,
                      color: "var(--dempet)",
                      lineHeight: 1.5,
                      marginTop: 4,
                    }}
                  >
                    {h.aiSammendrag ?? h.innhold}
                  </span>

                  <span
                    style={{ display: "flex", gap: 6, marginTop: 9, alignItems: "center" }}
                  >
                    <span style={{ fontSize: 11, color: "var(--svak)" }}>
                      {KANALNAVN[h.kanal]}
                    </span>
                    {hast && <Pille farge={hast.farge}>{hast.tekst}</Pille>}
                  </span>
                </button>
              </Kort>
            );
          })}
        </div>

        {/* Valgt henvendelse */}
        {valgt && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Kort>
              <Etikett>{KANALNAVN[valgt.kanal]}</Etikett>
              <h2
                style={{
                  margin: "8px 0 0",
                  fontSize: 19,
                  fontWeight: 800,
                  letterSpacing: "-.02em",
                }}
              >
                {valgt.avsenderNavn ?? "Ukjent avsender"}
              </h2>

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  marginTop: 5,
                  fontSize: 12.5,
                  color: "var(--dempet)",
                }}
              >
                {valgt.avsenderTelefon && (
                  <a href={`tel:${valgt.avsenderTelefon.replace(/\s/g, "")}`}>
                    {valgt.avsenderTelefon}
                  </a>
                )}
                {valgt.avsenderEpost && (
                  <a href={`mailto:${valgt.avsenderEpost}`}>{valgt.avsenderEpost}</a>
                )}
                <span>
                  Mottatt{" "}
                  {new Intl.DateTimeFormat("nb-NO", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(valgt.mottatt))}
                </span>
              </div>

              <p
                style={{
                  margin: "14px 0 0",
                  paddingTop: 13,
                  borderTop: "1px solid var(--linje-svak)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--tekst-2)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {valgt.innhold}
              </p>
            </Kort>

            <Kort style={{ background: "var(--bla-svak)", boxShadow: "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Etikett style={{ color: "var(--bla-morkt)" }}>AI-forslag</Etikett>
                {valgt.aiModell && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: "var(--dempet)",
                    }}
                  >
                    {valgt.aiModell}
                  </span>
                )}
              </div>

              {valgt.aiVurdert ? (
                <>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: "var(--tekst-2)",
                    }}
                  >
                    {valgt.aiSammendrag}
                  </p>
                  <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                    {valgt.aiKategori && (
                      <Pille farge="bla" prikk={false}>
                        {KATEGORINAVN[valgt.aiKategori] ?? valgt.aiKategori}
                      </Pille>
                    )}
                    {valgt.aiHastegrad && HASTEGRAD[valgt.aiHastegrad] && (
                      <Pille farge={HASTEGRAD[valgt.aiHastegrad]!.farge}>
                        {HASTEGRAD[valgt.aiHastegrad]!.tekst}
                      </Pille>
                    )}
                  </div>
                  <p
                    style={{
                      margin: "12px 0 0",
                      paddingTop: 10,
                      borderTop: "1px solid rgba(37,99,235,.15)",
                      fontSize: 11.5,
                      color: "var(--dempet)",
                      lineHeight: 1.5,
                    }}
                  >
                    Dette er et forslag, ikke en avgjørelse. Kategori og hastegrad
                    settes av deg.
                  </p>
                </>
              ) : (
                <>
                  <p
                    style={{
                      margin: "9px 0 0",
                      fontSize: 13,
                      color: "var(--dempet)",
                      lineHeight: 1.55,
                    }}
                  >
                    {kanTriagere
                      ? "Ikke vurdert ennå. Kjør en vurdering for å få sammendrag, kategori og hastegrad."
                      : "AI-triagering er ikke satt opp ennå. Sett AI_LEVERANDOR i miljøet for å slå det på."}
                  </p>
                  {kanTriagere && (
                    <div style={{ marginTop: 12 }}>
                      <Knapp onClick={() => void triager(valgt.id)} disabled={vurderer}>
                        {vurderer ? "Vurderer…" : "Vurder henvendelsen"}
                      </Knapp>
                    </div>
                  )}
                </>
              )}

              {feil && (
                <p style={{ margin: "11px 0 0", fontSize: 12.5, color: "var(--rod-tekst)" }}>
                  {feil}
                </p>
              )}
            </Kort>
          </div>
        )}
      </div>
    </>
  );
}
