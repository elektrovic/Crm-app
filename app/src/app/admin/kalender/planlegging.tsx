"use client";

import { useState } from "react";
import { Feilmelding, Felt, feltstil, knappstil, useHandling } from "@/components/crm-handling";
import { Etikett, Kort } from "@/components/ui";
import type { Manglerlinje } from "@/lib/data/kalender";
import { Bildeopplasting } from "@/components/bildeopplasting";

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
  ledigeMangler,
  fraKl,
  tilKl,
  notat,
}: {
  tildelingId: string;
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

          <Bildeopplasting
            tildelingId={tildelingId}
            slag="planlegging"
            merke="Legg på et bilde"
            hjelpetekst="Skisse, bilde av tavla, utsnitt av en tegning. Krympes før sending, og følger med til Tripletex ved neste synk."
          />

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
