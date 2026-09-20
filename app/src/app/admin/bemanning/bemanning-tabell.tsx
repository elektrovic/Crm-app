"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Celle, Etikett, Pille, Tabell } from "@/components/ui";
import type { Avdeling, Rolle } from "@/db/schema";

export type AnsattRad = {
  id: string;
  navn: string;
  epost: string;
  rolle: Rolle;
  avdeling: Avdeling;
  farge: string;
  initialer: string;
  abaxVehicleId: string | null;
  tripletexEmployeeId: number | null;
  aktiv: boolean;
};

/**
 * Fargene ansatte kan få. Hentet fra paletten i prototypen, slik at
 * kalenderen ser ut som den er tegnet av samme hånd.
 */
const FARGER = [
  "#2563EB",
  "#F97316",
  "#A855F7",
  "#22C55E",
  "#F43F5E",
  "#6366F1",
  "#0A5C34",
  "#7A8494",
];

export function BemanningTabell({
  ansatte,
  kanRedigere,
}: {
  ansatte: AnsattRad[];
  kanRedigere: boolean;
}) {
  const router = useRouter();
  const [lagrer, setLagrer] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  async function settFarge(id: string, farge: string) {
    setLagrer(id);
    setFeil(null);
    try {
      const svar = await fetch("/api/bemanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, farge }),
      });
      if (!svar.ok) {
        const k = (await svar.json().catch(() => ({}))) as { feil?: string };
        setFeil(k.feil ?? "Fikk ikke lagret fargen.");
        return;
      }
      router.refresh();
    } catch {
      setFeil("Ingen forbindelse. Prøv igjen.");
    } finally {
      setLagrer(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Etikett>Ansatte</Etikett>

      {feil && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--rod-tekst)", fontWeight: 600 }}>
          {feil}
        </p>
      )}

      <Tabell
        kolonner={["Ansatt", "Avdeling", "Rolle", "Fargekode", "Bil i ABAX", "Tripletex"]}
        antall={ansatte.length}
        tomtekst="Ingen aktive ansatte lagt inn ennå."
      >
        {ansatte.map((a) => (
          <tr key={a.id}>
            <Celle hoved under={a.epost}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: a.farge,
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {a.initialer}
                </span>
                {a.navn}
              </span>
            </Celle>
            <Celle>{a.avdeling}</Celle>
            <Celle>
              {a.rolle === "montor" ? "Montør" : a.rolle === "leder" ? "Leder" : "Administrator"}
            </Celle>
            <Celle>
              {kanRedigere ? (
                <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {FARGER.map((f) => (
                    <button
                      key={f}
                      onClick={() => void settFarge(a.id, f)}
                      disabled={lagrer === a.id}
                      aria-label={`Sett fargekode ${f} for ${a.navn}`}
                      aria-pressed={a.farge.toUpperCase() === f}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: f,
                        border:
                          a.farge.toUpperCase() === f
                            ? "2px solid var(--tekst)"
                            : "2px solid transparent",
                        boxShadow: "0 0 0 1px var(--linje)",
                        padding: 0,
                        cursor: lagrer === a.id ? "wait" : "pointer",
                      }}
                    />
                  ))}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: a.farge,
                  }}
                />
              )}
            </Celle>
            <Celle>
              {a.abaxVehicleId ? (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {a.abaxVehicleId}
                </span>
              ) : (
                <Pille farge="oransje">Ikke koblet</Pille>
              )}
            </Celle>
            <Celle tall>
              {a.tripletexEmployeeId ?? <Pille farge="rod">Mangler</Pille>}
            </Celle>
          </tr>
        ))}
      </Tabell>

      <p style={{ margin: "0 2px", fontSize: 12, color: "var(--svak)", lineHeight: 1.55 }}>
        Fargekoden er den montøren ser i kalenderen sin. Mangler Tripletex-ID
        kan ikke den ansatte føre timer — den settes når brukeren opprettes.
      </p>
    </div>
  );
}
