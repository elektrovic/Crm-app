"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * Felleslaget for alt som skriver i CRM-en.
 *
 * Uten dette gjentar hver knapp og hvert skjema den samme dansen: slå av
 * kontrollen, send, les feilmeldingen fra serveren, oppdater sida. Her
 * ligger den ett sted, og komponentene handler om det de faktisk gjør.
 *
 * Feilen vises der handlingen skjedde, ikke i et hjørne. En melding man
 * må lete etter er en melding ingen leser.
 */
export function useHandling() {
  const router = useRouter();
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  async function kjor(
    sti: string,
    metode: "POST" | "PATCH" | "DELETE",
    kropp: unknown,
    etterpa?: () => void,
  ): Promise<boolean> {
    setJobber(true);
    setFeil(null);
    try {
      const svar = await fetch(sti, {
        method: metode,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(kropp),
      });

      if (!svar.ok) {
        const data = await svar.json().catch(() => null);
        // Zod-feilene er mer presise enn den generelle meldingen, så de
        // vises når de finnes.
        const detalj = data?.detaljer?.[0]?.message;
        setFeil(detalj ?? data?.feil ?? "Noe gikk galt. Prøv en gang til.");
        return false;
      }

      etterpa?.();
      router.refresh();
      return true;
    } catch {
      setFeil("Fikk ikke kontakt med serveren.");
      return false;
    } finally {
      setJobber(false);
    }
  }

  return { kjor, jobber, feil, nullstillFeil: () => setFeil(null) };
}

/** Feilmelding i rødt, eller ingenting. */
export function Feilmelding({ tekst }: { tekst: string | null }) {
  if (!tekst) return null;
  return (
    <p
      role="alert"
      style={{
        margin: 0,
        fontSize: 13,
        fontWeight: 600,
        color: "var(--rod-tekst)",
        background: "var(--rod-bg)",
        padding: "9px 12px",
        borderRadius: 10,
      }}
    >
      {tekst}
    </p>
  );
}

/**
 * Et skjema som folder seg ut når man trenger det.
 *
 * CRM-flatene er lister man leser. Et skjema som alltid står åpent stjeler
 * plassen fra det man kom for.
 */
export function Utfoldbart({
  knappetekst,
  tittel,
  children,
  apen,
  settApen,
}: {
  knappetekst: string;
  tittel: string;
  children: ReactNode;
  apen: boolean;
  settApen: (v: boolean) => void;
}) {
  if (!apen) {
    return (
      <button
        type="button"
        onClick={() => settApen(true)}
        style={{
          alignSelf: "flex-start",
          height: 40,
          padding: "0 16px",
          borderRadius: 11,
          border: "none",
          background: "var(--bla)",
          color: "#fff",
          fontSize: 13.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {knappetekst}
      </button>
    );
  }

  return (
    <div
      style={{
        background: "var(--kort)",
        borderRadius: 14,
        boxShadow: "var(--skygge)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 15.5, fontWeight: 700 }}>{tittel}</div>
        <button
          type="button"
          onClick={() => settApen(false)}
          aria-label="Lukk"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            border: "none",
            background: "var(--flate)",
            color: "var(--dempet)",
            fontSize: 17,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

/** Feltrad i et skjema: etikett over, kontroll under. */
export function Felt({
  merke,
  children,
  bredde = "1 1 200px",
}: {
  merke: string;
  children: ReactNode;
  bredde?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: bredde, minWidth: 0 }}>
      <span
        style={{
          fontFamily: "var(--font-mono, ui-monospace)",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--svak)",
        }}
      >
        {merke}
      </span>
      {children}
    </label>
  );
}

export const feltstil = {
  height: 40,
  padding: "0 11px",
  borderRadius: 10,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 14,
  fontFamily: "inherit",
  width: "100%",
  minWidth: 0,
} as const;

export const knappstil = {
  height: 40,
  padding: "0 16px",
  borderRadius: 11,
  border: "none",
  background: "var(--bla)",
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
} as const;
