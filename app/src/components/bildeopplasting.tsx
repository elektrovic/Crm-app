"use client";

import { useState } from "react";
import { Feilmelding } from "@/components/crm-handling";

/**
 * Bildeopplasting, delt mellom planleggingen og jobbkortet.
 *
 * Bildet krympes i nettleseren før det sendes. Et telefonbilde er gjerne
 * 4 MB; 1600 px er rikelig til å se hvilken kurs som er merket feil, og
 * forskjellen er det montøren merker når han står med én strek dekning.
 */
export function Bildeopplasting({
  tildelingId,
  slag,
  merke,
  hjelpetekst,
}: {
  tildelingId: string;
  slag: "planlegging" | "jobb";
  merke: string;
  hjelpetekst?: string;
}) {
  const [feil, setFeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  async function last(fil: File) {
    setFeil(null);
    setLaster(true);
    try {
      const bitmap = await createImageBitmap(fil);
      const skala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const lerret = document.createElement("canvas");
      lerret.width = Math.round(bitmap.width * skala);
      lerret.height = Math.round(bitmap.height * skala);
      lerret.getContext("2d")?.drawImage(bitmap, 0, 0, lerret.width, lerret.height);

      const base64 = lerret.toDataURL("image/jpeg", 0.82).split(",")[1];
      if (!base64) {
        setFeil("Fikk ikke lest bildet.");
        return;
      }

      const svar = await fetch("/api/kalender/bilde", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tildelingId, slag, mimetype: "image/jpeg", base64 }),
      });
      if (!svar.ok) {
        const data = await svar.json().catch(() => null);
        setFeil(data?.feil ?? "Opplastingen gikk ikke gjennom.");
        return;
      }
      window.location.reload();
    } catch {
      setFeil("Fikk ikke lest bildet. Prøv et vanlig JPEG eller PNG.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700 }}>{merke}</div>
      {hjelpetekst && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--dempet)" }}>{hjelpetekst}</p>
      )}
      <input
        type="file"
        accept="image/*"
        // capture lar telefonen åpne kameraet direkte i stedet for
        // bildebiblioteket. På PC er den uten virkning.
        {...(slag === "jobb" ? { capture: "environment" as const } : {})}
        disabled={laster}
        onChange={(e) => {
          const fil = e.currentTarget.files?.[0];
          if (fil) void last(fil);
        }}
        style={{ fontSize: 12.5 }}
      />
      {laster && <span style={{ fontSize: 12, color: "var(--dempet)" }}>Laster opp…</span>}
      <Feilmelding tekst={feil} />
    </div>
  );
}
