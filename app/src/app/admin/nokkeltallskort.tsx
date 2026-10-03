import type { ReactNode } from "react";
import { IkonFlis, Kort } from "@/components/ui";

/**
 * Nøkkeltallskortet fra prototypen: farget ikonflis øverst, tittel og
 * undertekst, og tallet nederst — stort nok til å leses på avstand.
 *
 * `tall` kan være null. Da står det «—», og underteksten forklarer
 * hvorfor. Det er med vilje: et tomt felt som sier hvorfor det er tomt er
 * ærligere enn en null som ser ut som et måleresultat.
 */
export function Nokkeltallskort({
  tegn,
  farge,
  tittel,
  under,
  tall,
  framhev,
}: {
  tegn: ReactNode;
  farge: string;
  tittel: string;
  under: string;
  tall: string | null;
  /** Farger tallet rødt. Brukes når noen må gjøre noe. */
  framhev?: boolean;
}) {
  return (
    <Kort
      style={{
        padding: 20,
        minHeight: 168,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <IkonFlis farge={farge} storrelse={44}>
        {tegn}
      </IkonFlis>

      <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.25, marginTop: 16 }}>
        {tittel}
      </div>
      <div style={{ fontSize: 12, color: "var(--svak)", marginTop: 3, lineHeight: 1.35 }}>
        {under}
      </div>

      <div style={{ flex: 1, minHeight: 14 }} />

      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: "-.04em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          color: tall === null ? "var(--svak)" : framhev ? "var(--rod-tekst)" : "var(--tekst)",
        }}
      >
        {tall ?? "—"}
      </div>
    </Kort>
  );
}
