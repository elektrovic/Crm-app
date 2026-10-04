"use client";

import { useState } from "react";
import { Feilmelding, feltstil, knappstil, useHandling } from "@/components/crm-handling";
import { Kort } from "@/components/ui";

/**
 * Skriv ned det som nettopp skjedde.
 *
 * Feltet står alltid åpent, ikke bak en knapp. Et notat som krever to
 * klikk før man kan begynne å skrive, blir ikke skrevet — og da er
 * samtalen borte.
 */
export function Notat({ kundeId }: { kundeId: string }) {
  const { kjor, jobber, feil } = useHandling();
  const [tekst, setTekst] = useState("");

  return (
    <Kort>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await kjor("/api/crm/historikk", "POST", {
            kundeId,
            hendelse: tekst.trim(),
            dato: null,
          });
          if (ok) setTekst("");
        }}
        style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
      >
        <input
          value={tekst}
          onChange={(e) => setTekst(e.currentTarget.value)}
          maxLength={500}
          placeholder="Ringte Bjørn, han kommer tilbake i uke 42"
          style={{ ...feltstil, flex: 1 }}
        />
        <button type="submit" disabled={jobber || !tekst.trim()} style={knappstil}>
          {jobber ? "Lagrer…" : "Skriv"}
        </button>
      </form>
      <Feilmelding tekst={feil} />
    </Kort>
  );
}
