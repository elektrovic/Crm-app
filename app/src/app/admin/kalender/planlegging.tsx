"use client";

import { useState } from "react";
import { Feilmelding, Felt, feltstil, knappstil, useHandling } from "@/components/crm-handling";
import { Etikett, Kort } from "@/components/ui";
import type { Manglerlinje } from "@/lib/data/kalender";

const sekundar = {
  ...knappstil,
  background: "transparent",
  color: "var(--dempet)",
  border: "1px solid var(--linje)",
} as const;

/**
 * Planleggingen: det bare ledelsen ser.
 *
 * Tre ting i ett panel, fordi de gjøres i samme åndedrag når jobben settes
 * opp: hva som skal med, et bilde som forklarer noe ord ikke gjør, og
 * klokkeslettene hvis de endrer seg.
 */
export function Planlegging({
  tildelingId,
  prosjektId,
  ledigeMangler,
  fraKl,
  tilKl,
  notat,
}: {
  tildelingId: string;
  prosjektId: string;
  /** Mangler som ikke alt står på pakkelista. */
  ledigeMangler: Manglerlinje[];
  fraKl: string | null;
  tilKl: string | null;
  notat: string | null;
}) {
  const { kjor, jobber, feil } = useHandling();
  const [valgte, setValgte] = useState<string[]>([]);
  const [frie, setFrie] = useState<{ tekst: string; antall: string }[]>([]);
  const [utkast, setUtkast] = useState("");
  const [bildefeil, setBildefeil] = useState<string | null>(null);
  const [laster, setLaster] = useState(false);

  function vipp(id: string) {
    setValgte((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }

  async function lagrePakkeliste() {
    const ok = await kjor("/api/kalender/medbring", "POST", {
      tildelingId,
      mangelIder: valgte,
      fritekst: frie
        .filter((f) => f.tekst.trim())
        .map((f) => ({ tekst: f.tekst.trim(), antall: f.antall.trim() || null, enhet: "STK" })),
    });
    if (ok) {
      setValgte([]);
      setFrie([]);
    }
  }

  /**
   * Bildet krympes i nettleseren før det sendes.
   *
   * Et telefonbilde er gjerne 4 MB. Taket på serveren er 1,5 MB, og en
   * database er uansett ikke et bildearkiv. 1600 px er rikelig til å se
   * hvilken kurs som er merket feil.
   */
  async function lastOppBilde(fil: File) {
    setBildefeil(null);
    setLaster(true);
    try {
      const bitmap = await createImageBitmap(fil);
      const skala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const lerret = document.createElement("canvas");
      lerret.width = Math.round(bitmap.width * skala);
      lerret.height = Math.round(bitmap.height * skala);
      lerret.getContext("2d")?.drawImage(bitmap, 0, 0, lerret.width, lerret.height);

      const dataUrl = lerret.toDataURL("image/jpeg", 0.82);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        setBildefeil("Fikk ikke lest bildet.");
        return;
      }

      const svar = await fetch("/api/kalender/bilde", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prosjektId, mimetype: "image/jpeg", base64 }),
      });
      if (!svar.ok) {
        const data = await svar.json().catch(() => null);
        setBildefeil(data?.feil ?? "Opplastingen gikk ikke gjennom.");
        return;
      }
      window.location.reload();
    } catch {
      setBildefeil("Fikk ikke lest bildet. Prøv et vanlig JPEG eller PNG.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Etikett>Planlegging</Etikett>

      <Kort>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Legg til på pakkelista */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Legg til på pakkelista</div>

            {ledigeMangler.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--dempet)" }}>
                Ingen innmeldte mangler igjen å hake av. Skriv linjene du trenger under.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {ledigeMangler.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 2px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={valgte.includes(m.id)}
                      onChange={() => vipp(m.id)}
                      style={{ width: 18, height: 18, accentColor: "var(--bla)" }}
                    />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{m.tekst}</span>
                    {m.antall && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: "var(--dempet)",
                        }}
                      >
                        {m.antall} {m.enhet}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {frie.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <input
                  value={f.tekst}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setFrie((rad) => rad.map((r, j) => (j === i ? { ...r, tekst: v } : r)));
                  }}
                  placeholder="Stigen fra verkstedet"
                  style={{ ...feltstil, flex: 1 }}
                />
                <input
                  value={f.antall}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setFrie((rad) => rad.map((r, j) => (j === i ? { ...r, antall: v } : r)));
                  }}
                  placeholder="1"
                  style={{ ...feltstil, width: 72, flex: "none" }}
                />
              </div>
            ))}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setFrie((f) => [...f, { tekst: "", antall: "" }])}
                style={sekundar}
              >
                + Egen linje
              </button>
              <button
                type="button"
                onClick={() => void lagrePakkeliste()}
                disabled={jobber || (valgte.length === 0 && frie.every((f) => !f.tekst.trim()))}
                style={knappstil}
              >
                {jobber ? "Lagrer…" : "Legg til"}
              </button>
            </div>
            <Feilmelding tekst={feil} />
          </div>

          {/* Bilde */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Legg på et bilde</div>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--dempet)" }}>
              Skisse, bilde av tavla, utsnitt av en tegning. Krympes før sending.
            </p>
            <input
              type="file"
              accept="image/*"
              disabled={laster}
              onChange={(e) => {
                const fil = e.currentTarget.files?.[0];
                if (fil) void lastOppBilde(fil);
              }}
              style={{ fontSize: 12.5 }}
            />
            {laster && (
              <span style={{ fontSize: 12, color: "var(--dempet)" }}>Laster opp…</span>
            )}
            <Feilmelding tekst={bildefeil} />
          </div>

          {/* Tid og beskjed */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await kjor("/api/kalender/tildeling", "PATCH", {
                id: tildelingId,
                fraKl: String(f.get("fraKl") ?? "") || null,
                tilKl: String(f.get("tilKl") ?? "") || null,
                notat: String(f.get("notat") ?? "") || null,
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Tid og beskjed</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Felt merke="Fra kl." bredde="0 1 120px">
                <input type="time" name="fraKl" defaultValue={fraKl ?? ""} style={feltstil} />
              </Felt>
              <Felt merke="Til kl." bredde="0 1 120px">
                <input type="time" name="tilKl" defaultValue={tilKl ?? ""} style={feltstil} />
              </Felt>
            </div>
            <Felt merke="Beskjed til montøren">
              <textarea
                name="notat"
                rows={3}
                defaultValue={notat ?? ""}
                style={{ ...feltstil, height: "auto", padding: "9px 11px", resize: "vertical" }}
              />
            </Felt>
            <button type="submit" disabled={jobber} style={knappstil}>
              Lagre
            </button>
          </form>

          {/* Avlysning */}
          <div style={{ borderTop: "1px solid var(--linje)", paddingTop: 12 }}>
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Fjerne denne jobben fra kalenderen? Pakkelista følger med.")) {
                  return;
                }
                const ok = await kjor("/api/kalender/tildeling", "PATCH", {
                  id: tildelingId,
                  slett: true,
                });
                if (ok) window.location.href = "/admin/kalender";
              }}
              style={{ ...sekundar, color: "var(--rod)" }}
            >
              Fjern jobben
            </button>
          </div>
        </div>
      </Kort>
    </div>
  );
}
