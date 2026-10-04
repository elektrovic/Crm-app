"use client";

import { useState } from "react";
import { Feilmelding, useHandling } from "@/components/crm-handling";
import { Etikett, Kort } from "@/components/ui";
import type { Pakkelinje } from "@/lib/data/kalender";

/**
 * Pakkelista, slik montøren møter den.
 *
 * Avkryssingen er optimistisk: haken flytter seg med en gang, og rulles
 * tilbake hvis skrivingen feiler. Det er med vilje — mannen står ved bilen
 * med hanskene på, og en liste som henger i et halvt sekund per hake blir
 * ikke brukt.
 */
export function Pakkeliste({
  linjer,
  kanFjerne,
  tildelingId,
}: {
  linjer: Pakkelinje[];
  kanFjerne: boolean;
  tildelingId: string;
}) {
  const { kjor, feil } = useHandling();
  const [lokal, setLokal] = useState<Record<string, boolean>>({});

  const erPakket = (l: Pakkelinje) => lokal[l.id] ?? l.pakket;
  const antallPakket = linjer.filter(erPakket).length;

  async function kryss(l: Pakkelinje, pakket: boolean) {
    setLokal((f) => ({ ...f, [l.id]: pakket }));
    const ok = await kjor("/api/kalender/medbring", "PATCH", { id: l.id, pakket });
    if (!ok) setLokal((f) => ({ ...f, [l.id]: !pakket }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }} id={`pakkeliste-${tildelingId}`}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Etikett>Ta med</Etikett>
        {linjer.length > 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: antallPakket === linjer.length ? "var(--gronn)" : "var(--oransje)",
            }}
          >
            {antallPakket}/{linjer.length}
          </span>
        )}
      </div>

      <Kort>
        {linjer.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--dempet)" }}>
            Ingen pakkeliste på denne jobben.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {linjer.map((l) => {
              const pakket = erPakket(l);
              return (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                      minWidth: 0,
                      // Stor nok flate til en hanske.
                      padding: "9px 2px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pakket}
                      onChange={(e) => void kryss(l, e.currentTarget.checked)}
                      style={{ width: 20, height: 20, flex: "none", accentColor: "var(--bla)" }}
                    />
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13.5,
                        color: pakket ? "var(--svak)" : "var(--tekst)",
                        textDecoration: pakket ? "line-through" : "none",
                      }}
                    >
                      {l.tekst}
                      {l.fraMangel && (
                        <span
                          title="Meldt inn som manglende på prosjektet"
                          style={{ fontSize: 10.5, color: "var(--svak)", marginLeft: 6 }}
                        >
                          meldt
                        </span>
                      )}
                    </span>
                    {l.antall && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          color: "var(--dempet)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {l.antall} {l.enhet}
                      </span>
                    )}
                  </label>

                  {kanFjerne && (
                    <button
                      type="button"
                      aria-label={`Fjern ${l.tekst}`}
                      onClick={async () => {
                        await kjor("/api/kalender/medbring", "DELETE", {
                          id: l.id,
                          slett: true,
                        });
                      }}
                      style={{
                        border: "none",
                        background: "none",
                        color: "var(--svak)",
                        fontSize: 16,
                        lineHeight: 1,
                        cursor: "pointer",
                        padding: "6px 4px",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Feilmelding tekst={feil} />
      </Kort>
    </div>
  );
}
