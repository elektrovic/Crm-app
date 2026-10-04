"use client";

import { useState } from "react";
import { Feilmelding, feltstil, knappstil, useHandling } from "@/components/crm-handling";

export type Kundevalg = { id: string; navn: string };

/**
 * Hvem handlet samtalen om?
 *
 * Står den uten kunde, finner du den aldri igjen. Derfor er dette en
 * nedtrekksliste rett i raden og ikke et skjema bak et trykk: valget tar
 * to sekunder, og alt som tar lengre tid blir ikke gjort.
 *
 * Gjetter systemet, står valget der med et spørsmålstegn. Bekrefter du,
 * slutter det å gjette.
 */
export function Kobling({
  id,
  kundeId,
  bekreftet,
  kunder,
}: {
  id: string;
  kundeId: string | null;
  bekreftet: boolean;
  kunder: Kundevalg[];
}) {
  const { kjor, jobber, feil } = useHandling();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select
        value={kundeId ?? ""}
        disabled={jobber}
        aria-label="Kunde samtalen gjelder"
        onChange={(e) => kjor("/api/crm/samtaler", "PATCH", { id, kundeId: e.target.value || null })}
        style={{
          ...feltstil,
          height: 34,
          fontSize: 13,
          width: "auto",
          minWidth: 190,
          maxWidth: "100%",
          borderColor: kundeId ? "var(--linje)" : "var(--oransje, #F97316)",
        }}
      >
        <option value="">Ingen kunde valgt</option>
        {kunder.map((k) => (
          <option key={k.id} value={k.id}>
            {k.navn}
          </option>
        ))}
      </select>

      {kundeId && !bekreftet && (
        <span style={{ fontSize: 11.5, color: "var(--svak)" }}>foreslått av systemet</span>
      )}

      {feil && <Feilmelding tekst={feil} />}
    </div>
  );
}

const DAG = 86_400_000;

function omDager(antall: number): string {
  return new Date(Date.now() + antall * DAG).toISOString().slice(0, 10);
}

/**
 * Et forslag fra Pocket, med en frist du velger.
 *
 * Forslaget blir ikke en oppfølging før du gir det en dato. Det er hele
 * forskjellen mellom en liste du stoler på og en liste full av gjetninger
 * du må sile hver morgen.
 *
 * Fristknappene er der fordi en datovelger på telefon er fire trykk, og
 * «i morgen» er svaret ni av ti ganger.
 */
export function Forslag({ samtaleId, oppgave }: { samtaleId: string; oppgave: string }) {
  const [apen, settApen] = useState(false);
  const [frist, settFrist] = useState(() => omDager(1));
  const { kjor, jobber, feil } = useHandling();

  const valg: { merke: string; dato: string }[] = [
    { merke: "I morgen", dato: omDager(1) },
    { merke: "Om 3 dager", dato: omDager(3) },
    { merke: "Neste uke", dato: omDager(7) },
  ];

  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "9px 0",
        borderTop: "1px solid var(--linje-svak)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: "1 1 220px", fontSize: 13, color: "var(--tekst-2)", lineHeight: 1.5 }}>
          {oppgave}
        </span>
        {!apen && (
          <button
            type="button"
            onClick={() => settApen(true)}
            style={{ ...knappstil, height: 32, padding: "0 13px", fontSize: 12.5 }}
          >
            Sett frist
          </button>
        )}
      </div>

      {apen && (
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
          {valg.map((v) => (
            <button
              key={v.merke}
              type="button"
              onClick={() => settFrist(v.dato)}
              style={{
                height: 32,
                padding: "0 11px",
                borderRadius: 999,
                border: "1px solid var(--linje)",
                background: frist === v.dato ? "var(--bla)" : "var(--kort)",
                color: frist === v.dato ? "#fff" : "var(--tekst-2)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {v.merke}
            </button>
          ))}

          <input
            type="date"
            value={frist}
            onChange={(e) => settFrist(e.target.value)}
            aria-label="Frist"
            style={{ ...feltstil, height: 32, fontSize: 12.5, width: "auto" }}
          />

          <button
            type="button"
            disabled={jobber}
            onClick={() => kjor("/api/crm/samtaler", "POST", { id: samtaleId, oppgave, frist })}
            style={{ ...knappstil, height: 32, padding: "0 13px", fontSize: 12.5 }}
          >
            {jobber ? "Lagrer…" : "Legg i oppfølging"}
          </button>

          <button
            type="button"
            onClick={() => settApen(false)}
            style={{
              height: 32,
              padding: "0 11px",
              borderRadius: 9,
              border: "none",
              background: "none",
              color: "var(--svak)",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Avbryt
          </button>
        </div>
      )}

      {feil && <Feilmelding tekst={feil} />}
    </li>
  );
}
