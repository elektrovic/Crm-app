"use client";

import { useState } from "react";
import { Etikett, Knapp, Kort, Pille } from "@/components/ui";
import { lagKlientNokkel } from "@/lib/offline/ko";

type Anledning = "for_oppdrag" | "etter_oppdrag";

/**
 * Melding til kunden før og etter oppdraget.
 *
 * Montøren ser hele teksten før han sender, og må bekrefte. En SMS kan ikke
 * angres — derfor to trykk, aldri ett, og aldri automatisk utsending.
 */
export function SmsKort({
  prosjektId,
  mottaker,
  mottakerVisning,
  kontaktperson,
  forOppdrag,
  etterOppdrag,
}: {
  prosjektId: string;
  mottaker: string;
  mottakerVisning: string;
  kontaktperson: string | null;
  forOppdrag: string;
  etterOppdrag: string;
}) {
  const [apen, setApen] = useState<Anledning | null>(null);
  const [sender, setSender] = useState(false);
  const [sendt, setSendt] = useState<Anledning[]>([]);
  const [feil, setFeil] = useState<string | null>(null);

  const tekst = apen === "for_oppdrag" ? forOppdrag : etterOppdrag;

  async function send() {
    if (!apen) return;
    setSender(true);
    setFeil(null);
    try {
      const svar = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klientNokkel: lagKlientNokkel(),
          prosjektId,
          anledning: apen,
          mottaker,
          melding: tekst,
        }),
      });

      if (!svar.ok) {
        const k = (await svar.json().catch(() => ({}))) as { feil?: string };
        setFeil(k.feil ?? "Meldingen gikk ikke ut.");
        return;
      }

      setSendt((s) => [...s, apen]);
      setApen(null);
    } catch {
      setFeil("Ingen forbindelse. SMS krever nett — prøv igjen når du har dekning.");
    } finally {
      setSender(false);
    }
  }

  return (
    <Kort>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Etikett>Meld fra til kunden</Etikett>
        <span style={{ fontSize: 11.5, color: "var(--svak)" }}>{mottakerVisning}</span>
      </div>

      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--dempet)" }}>
        {kontaktperson ? `Går til ${kontaktperson}.` : "Går til kontaktpersonen på prosjektet."}{" "}
        Du får se teksten før den sendes.
      </p>

      {apen === null ? (
        <div style={{ display: "flex", gap: 8, marginTop: 13, flexWrap: "wrap" }}>
          {(
            [
              ["for_oppdrag", "Vi kommer"],
              ["etter_oppdrag", "Vi er ferdige"],
            ] as const
          ).map(([anledning, etikett]) => (
            <Knapp
              key={anledning}
              variant="sekundar"
              onClick={() => {
                setFeil(null);
                setApen(anledning);
              }}
            >
              {etikett}
              {sendt.includes(anledning) ? " · sendt" : ""}
            </Knapp>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 13 }}>
          <div
            style={{
              background: "var(--kort-2)",
              border: "1px solid var(--linje)",
              borderRadius: 12,
              padding: "12px 14px",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--tekst)",
            }}
          >
            {tekst}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Knapp variant="mork" onClick={() => void send()} disabled={sender}>
              {sender ? "Sender…" : `Send til ${mottakerVisning}`}
            </Knapp>
            <Knapp variant="sekundar" onClick={() => setApen(null)} disabled={sender}>
              Avbryt
            </Knapp>
          </div>
        </div>
      )}

      {feil && (
        <p style={{ margin: "11px 0 0", fontSize: 12.5, color: "var(--rod-tekst)" }}>{feil}</p>
      )}

      {sendt.length > 0 && apen === null && (
        <div style={{ marginTop: 12 }}>
          <Pille farge="gronn">
            {sendt.length === 1 ? "1 melding sendt" : `${sendt.length} meldinger sendt`}
          </Pille>
        </div>
      )}
    </Kort>
  );
}
