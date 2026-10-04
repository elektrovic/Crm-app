"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feilmelding } from "@/components/crm-handling";

/**
 * «Kopier forrige uke».
 *
 * Ukene ligner hverandre — et lag står på samme bygg i tre uker — og å
 * sette opp det samme rutenettet på nytt hver fredag er tjue klikk som
 * ikke gir noen ny opplysning.
 *
 * Den legger til, overskriver ikke, og hopper over det som alt står der.
 * Derfor er det trygt å trykke to ganger, og derfor spør den ikke «er du
 * sikker?» — det verste som skjer er at ingenting skjer.
 */
export function KopierUke({ mandag }: { mandag: string }) {
  const router = useRouter();
  const [jobber, settJobber] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);
  const [svar, settSvar] = useState<string | null>(null);

  const forrige = (() => {
    const d = new Date(`${mandag}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  async function kopier() {
    settSvar(null);
    settFeil(null);
    settJobber(true);
    try {
      const r = await fetch("/api/kalender/kopier-uke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fraMandag: forrige, tilMandag: mandag }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        settFeil(data?.feil ?? "Gikk ikke.");
        return;
      }
      settSvar(
        data.opprettet === 0
          ? "Alt sto der fra før."
          : `${data.opprettet} kopiert${data.hoppetOver > 0 ? `, ${data.hoppetOver} sto der fra før` : ""}.`,
      );
      // refresh(), ikke reload: rutenettet hentes på nytt fra serveren,
      // og meldingen over blir stående så man ser hva som skjedde.
      router.refresh();
    } catch {
      settFeil("Fikk ikke kontakt med serveren.");
    } finally {
      settJobber(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <button
        type="button"
        onClick={kopier}
        disabled={jobber}
        style={{
          height: 34,
          padding: "0 13px",
          borderRadius: 10,
          border: "1px solid var(--linje)",
          background: "var(--kort)",
          color: "var(--tekst)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {jobber ? "Kopierer…" : "Kopier forrige uke"}
      </button>
      {svar && <span style={{ fontSize: 12, color: "var(--dempet)" }}>{svar}</span>}
      <Feilmelding tekst={feil} />
    </div>
  );
}
