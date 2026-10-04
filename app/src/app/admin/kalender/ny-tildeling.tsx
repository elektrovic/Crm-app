"use client";

import { useState } from "react";
import { Feilmelding, Felt, feltstil, knappstil, useHandling } from "@/components/crm-handling";
import { Kort } from "@/components/ui";

/** Avbryt-knappen skal ikke se ut som en handling man vil ta. */
const sekundar = {
  ...knappstil,
  background: "transparent",
  color: "var(--dempet)",
  border: "1px solid var(--linje)",
} as const;

type Valg = { id: string; navn: string; nummer?: string; avdeling: string };

/**
 * Sett opp en jobb.
 *
 * «Til og med»-feltet er det som gjør skjemaet brukbart i praksis: en
 * montasje går sjelden én dag. Står det en sluttdato, lages én tildeling
 * per dag i spennet, og pakkelista legges på hver av dem for seg — to
 * dager på samme bygg er to billaster.
 */
export function NyTildeling({
  montorer,
  prosjekter,
  standarddato,
}: {
  montorer: Valg[];
  prosjekter: Valg[];
  standarddato: string;
}) {
  const { kjor, jobber, feil, nullstillFeil } = useHandling();
  const [apen, setApen] = useState(false);

  if (!apen) {
    return (
      <button type="button" onClick={() => setApen(true)} style={knappstil}>
        Sett opp jobb
      </button>
    );
  }

  return (
    <Kort>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const tilDato = String(f.get("tilDato") ?? "");
          const ok = await kjor("/api/kalender/tildeling", "POST", {
            ansattId: f.get("ansattId"),
            prosjektId: f.get("prosjektId"),
            dato: f.get("dato"),
            tilDato: tilDato || null,
            fraKl: String(f.get("fraKl") ?? "") || null,
            tilKl: String(f.get("tilKl") ?? "") || null,
            notat: String(f.get("notat") ?? "") || null,
          });
          if (ok) setApen(false);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>Sett opp jobb</div>

        <Felt merke="Montør">
          <select name="ansattId" required style={feltstil}>
            {montorer.map((m) => (
              <option key={m.id} value={m.id}>
                {m.navn} · {m.avdeling}
              </option>
            ))}
          </select>
        </Felt>

        <Felt merke="Prosjekt">
          <select name="prosjektId" required style={feltstil}>
            {prosjekter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nummer} {p.navn}
              </option>
            ))}
          </select>
        </Felt>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Felt merke="Dato">
            <input type="date" name="dato" required defaultValue={standarddato} style={feltstil} />
          </Felt>
          <Felt merke="Til og med (valgfritt)">
            <input type="date" name="tilDato" style={feltstil} />
          </Felt>
          <Felt merke="Fra kl.">
            <input type="time" name="fraKl" style={feltstil} />
          </Felt>
          <Felt merke="Til kl.">
            <input type="time" name="tilKl" style={feltstil} />
          </Felt>
        </div>

        <Felt merke="Beskjed til montøren">
          <textarea
            name="notat"
            rows={3}
            placeholder="Møt Bjørn i resepsjonen. Heis ute av drift, ta trappa."
            style={{ ...feltstil, height: "auto", padding: "9px 11px", resize: "vertical" }}
          />
        </Felt>

        <Feilmelding tekst={feil} />

        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={jobber} style={knappstil}>
            {jobber ? "Lagrer…" : "Sett opp"}
          </button>
          <button
            type="button"
            onClick={() => {
              nullstillFeil();
              setApen(false);
            }}
            style={sekundar}
          >
            Avbryt
          </button>
        </div>
      </form>
    </Kort>
  );
}
