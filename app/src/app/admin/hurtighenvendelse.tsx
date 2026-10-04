"use client";

import { useState } from "react";
import { Feilmelding, feltstil, knappstil, useHandling } from "@/components/crm-handling";

/** I morgen. Nær nok til å være ekte, og den vanligste fristen i praksis. */
function imorgen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const FRISTVALG = [
  { merke: "I morgen", dager: 1 },
  { merke: "Om 3 dager", dager: 3 },
  { merke: "Neste uke", dager: 7 },
];

function omDager(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Registrer en henvendelse mens du har røret i hånda.
 *
 * Knappen ligger fast nederst til høyre på alle ledersider, fordi
 * telefonen ringer mens du står i noe annet. Må du først finne fram til
 * riktig skjerm, blir samtalen skrevet ned etterpå — og «etterpå» er der
 * saker forsvinner.
 *
 * Tre felt og en frist. Fristen er forhåndsvalgt, ikke valgfri: en
 * henvendelse uten neste steg er den ene tingen hele CRM-en er bygget for
 * å hindre. Man kan skru den av, men man må gjøre det med vilje.
 *
 * Kunden kjennes igjen på telefonnummeret av serveren. Vi gjør det ikke
 * her, fordi nummeret kan være skrevet på fem måter og sammenligningen
 * skal skje mot normaliserte former.
 */
export function Hurtighenvendelse() {
  const { kjor, jobber, feil } = useHandling();
  const [apen, setApen] = useState(false);
  const [frist, setFrist] = useState<string | null>(imorgen());
  const [kvittering, setKvittering] = useState<string | null>(null);

  if (!apen) {
    return (
      <button
        type="button"
        onClick={() => {
          setKvittering(null);
          setApen(true);
        }}
        aria-label="Ny henvendelse"
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 50,
          height: 52,
          padding: "0 20px",
          borderRadius: 999,
          border: "none",
          background: "var(--bla)",
          color: "#fff",
          fontSize: 15,
          fontWeight: 700,
          boxShadow: "0 6px 20px rgba(37,99,235,.35)",
          cursor: "pointer",
        }}
      >
        + Ny henvendelse
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Ny henvendelse"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,23,42,.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 14,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setApen(false);
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const skjema = e.currentTarget;
          const f = new FormData(skjema);
          const svar = await kjor("/api/crm/henvendelser", "POST", {
            kanal: f.get("kanal"),
            avsenderNavn: String(f.get("navn") ?? "") || null,
            avsenderTelefon: String(f.get("telefon") ?? "") || null,
            innhold: f.get("innhold"),
            frist,
          });
          if (svar) {
            setKvittering("Registrert.");
            skjema.reset();
          }
        }}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--kort)",
          borderRadius: "var(--r-kort)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 11,
          boxShadow: "var(--skygge-loft)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>Ny henvendelse</span>
          <button
            type="button"
            onClick={() => setApen(false)}
            aria-label="Lukk"
            style={{
              border: "none",
              background: "none",
              fontSize: 22,
              lineHeight: 1,
              color: "var(--dempet)",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <input
          name="navn"
          placeholder="Hvem ringer?"
          autoFocus
          maxLength={200}
          style={feltstil}
        />
        <input
          name="telefon"
          type="tel"
          inputMode="tel"
          placeholder="Telefon"
          maxLength={40}
          style={feltstil}
        />
        <textarea
          name="innhold"
          required
          rows={3}
          maxLength={4000}
          placeholder="Hva gjelder det?"
          style={{ ...feltstil, height: "auto", padding: "10px 11px", resize: "vertical" }}
        />

        <select name="kanal" defaultValue="telefon" style={feltstil}>
          <option value="telefon">Telefon</option>
          <option value="epost">E-post</option>
          <option value="nettskjema">Nettskjema</option>
          <option value="anbefaling">Anbefaling</option>
        </select>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: "var(--svak)" }}>Følg opp</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FRISTVALG.map((v) => {
              const dato = omDager(v.dager);
              const valgt = frist === dato;
              return (
                <button
                  key={v.merke}
                  type="button"
                  onClick={() => setFrist(dato)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 999,
                    border: `1px solid ${valgt ? "var(--bla)" : "var(--linje)"}`,
                    background: valgt ? "var(--bla)" : "transparent",
                    color: valgt ? "#fff" : "var(--dempet)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {v.merke}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setFrist(null)}
              style={{
                padding: "7px 12px",
                borderRadius: 999,
                border: `1px solid ${frist === null ? "var(--oransje)" : "var(--linje)"}`,
                background: "transparent",
                color: frist === null ? "var(--oransje)" : "var(--svak)",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              Ingen frist
            </button>
          </div>
        </div>

        <Feilmelding tekst={feil} />
        {kvittering && (
          <span style={{ fontSize: 12.5, color: "var(--gronn)" }}>
            {kvittering} Skriv en til, eller lukk.
          </span>
        )}

        <button type="submit" disabled={jobber} style={{ ...knappstil, height: 46 }}>
          {jobber ? "Lagrer…" : "Registrer"}
        </button>
      </form>
    </div>
  );
}
