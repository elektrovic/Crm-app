"use client";

import { useState } from "react";
import { Feilmelding, knappstil } from "@/components/crm-handling";
import { Etikett, Kort } from "@/components/ui";

type Resultat = {
  prosjekter: { nye: number; oppdatert: number; deaktivert: number };
  aktiviteter: { nye: number; oppdatert: number };
  ansatte: { koblet: number; ukjente: string[] };
  geokoding: { treff: number; bom: number; gjenstaar: number };
  vedleggsko: { lastetOpp: number; feilet: number; oppgitt: number };
  vedleggsopprydding: { ryddet: number; frigjortByte: number; venterPaaTripletex: number };
};

/**
 * Kjør synken nå.
 *
 * Den planlagte kjøringen går hver time, men den er ikke til hjelp når man
 * nettopp har lagt inn et token og vil vite om det virker. Her får man
 * svaret med en gang — og hele feilmeldingen fra Tripletex hvis det ikke
 * gikk, i stedet for «se serverloggen» på en logg man ikke når.
 */
export function SynkNa() {
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Resultat | null>(null);

  async function kjor() {
    setJobber(true);
    setFeil(null);
    setResultat(null);
    try {
      const svar = await fetch("/api/synk", { method: "POST" });
      const tekst = await svar.text();

      if (!svar.ok) {
        // Kan være JSON fra oss, eller en HTML-side fra noe foran oss.
        // Begge deler er nyttig å se; vi later ikke som vi forsto den.
        try {
          const data = JSON.parse(tekst);
          setFeil(
            [data.feil, data.fraTripletex].filter(Boolean).join(" — ") ||
              tekst.slice(0, 400),
          );
        } catch {
          setFeil(`Svar ${svar.status}: ${tekst.slice(0, 300)}`);
        }
        return;
      }

      setResultat(JSON.parse(tekst) as Resultat);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Fikk ikke kontakt med serveren.");
    } finally {
      setJobber(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Etikett>Synk mot Tripletex</Etikett>

      <Kort>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--dempet)" }}>
            Henter prosjekter, aktiviteter og ansatte, og sender bilder som
            ligger i kø. Går automatisk hver time — denne knappen gjør det nå.
          </p>

          <div>
            <button type="button" onClick={() => void kjor()} disabled={jobber} style={knappstil}>
              {jobber ? "Synker…" : "Synk nå"}
            </button>
          </div>

          <Feilmelding tekst={feil} />

          {resultat && (
            <div style={{ display: "grid", gap: 7, fontSize: 13 }}>
              <Linje
                merke="Prosjekter"
                verdi={`${resultat.prosjekter.nye} nye · ${resultat.prosjekter.oppdatert} oppdatert · ${resultat.prosjekter.deaktivert} deaktivert`}
              />
              <Linje
                merke="Aktiviteter"
                verdi={`${resultat.aktiviteter.nye} nye · ${resultat.aktiviteter.oppdatert} oppdatert`}
              />
              <Linje
                merke="Ansatte"
                verdi={
                  resultat.ansatte.ukjente.length > 0
                    ? `${resultat.ansatte.koblet} koblet · ukjente: ${resultat.ansatte.ukjente.join(", ")}`
                    : `${resultat.ansatte.koblet} koblet`
                }
              />
              <Linje
                merke="Bilder til Tripletex"
                verdi={`${resultat.vedleggsko.lastetOpp} sendt · ${resultat.vedleggsko.feilet} feilet${
                  resultat.vedleggsko.oppgitt > 0 ? ` · ${resultat.vedleggsko.oppgitt} gitt opp` : ""
                }`}
              />
              <Linje
                merke="Geokoding"
                verdi={`${resultat.geokoding.treff} treff · ${resultat.geokoding.gjenstaar} gjenstår`}
              />
            </div>
          )}
        </div>
      </Kort>
    </div>
  );
}

function Linje({ merke, verdi }: { merke: string; verdi: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <span style={{ color: "var(--dempet)" }}>{merke}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, textAlign: "right" }}>
        {verdi}
      </span>
    </div>
  );
}
