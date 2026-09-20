/**
 * Kjernekomponentene i Montørappen, hentet 1:1 fra formspråket i prototypen:
 * hvite kort med lav skygge, fargede ikonfliser, blå avrundet pille som
 * aktiv markør, og mono-etiketter i store bokstaver over hver seksjon.
 */
import type { CSSProperties, ReactNode } from "react";

export type Statusfarge = "gronn" | "oransje" | "rod" | "bla" | "noytral";

const statusStiler: Record<Statusfarge, { bg: string; fg: string }> = {
  gronn: { bg: "var(--gronn-bg)", fg: "var(--gronn-tekst)" },
  oransje: { bg: "var(--oransje-bg)", fg: "var(--oransje-tekst)" },
  rod: { bg: "var(--rod-bg)", fg: "var(--rod-tekst)" },
  bla: { bg: "var(--bla-svak)", fg: "var(--bla-morkt)" },
  noytral: { bg: "var(--kort-2)", fg: "var(--dempet)" },
};

export function Kort({
  children,
  style,
  loft = false,
}: {
  children: ReactNode;
  style?: CSSProperties;
  loft?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--kort)",
        borderRadius: "var(--r-kort)",
        padding: "18px 20px",
        boxShadow: loft ? "var(--skygge-loft)" : "var(--skygge)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Etikett({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: ".16em",
        textTransform: "uppercase",
        color: "var(--svak)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pille({
  children,
  farge = "noytral",
  prikk = true,
}: {
  children: ReactNode;
  farge?: Statusfarge;
  prikk?: boolean;
}) {
  const s = statusStiler[farge];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flex: "none",
        padding: prikk ? "4px 10px 4px 8px" : "4px 10px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {prikk && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flex: "none",
          }}
        />
      )}
      {children}
    </span>
  );
}

/** Fargede ikonfliser — blå/oransje/lilla/grønn, som på hjem-skjermen. */
export function IkonFlis({
  farge,
  children,
  storrelse = 38,
}: {
  farge: string;
  children: ReactNode;
  storrelse?: number;
}) {
  return (
    <div
      style={{
        width: storrelse,
        height: storrelse,
        borderRadius: 11,
        background: farge,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: storrelse * 0.4,
        fontWeight: 700,
        flex: "none",
        letterSpacing: "-.02em",
      }}
    >
      {children}
    </div>
  );
}

export function Knapp({
  children,
  variant = "primar",
  bred = false,
  disabled = false,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  variant?: "primar" | "sekundar" | "mork";
  bred?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const varianter: Record<string, CSSProperties> = {
    primar: { background: "var(--bla)", color: "#fff", border: "none" },
    sekundar: {
      background: "var(--kort)",
      color: "var(--tekst)",
      border: "1px solid var(--linje)",
    },
    mork: { background: "var(--mork)", color: "#fff", border: "none" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...varianter[variant],
        padding: "12px 18px",
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        width: bred ? "100%" : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "opacity .15s ease",
      }}
    >
      {children}
    </button>
  );
}

export function Sidetittel({ tittel, under }: { tittel: string; under?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 25,
          fontWeight: 800,
          letterSpacing: "-.03em",
          color: "var(--tekst)",
          lineHeight: 1.1,
        }}
      >
        {tittel}
      </h1>
      {under && (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>{under}</p>
      )}
    </div>
  );
}

export function RadVerdi({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        fontSize: 13,
        alignItems: "baseline",
      }}
    >
      <span style={{ color: "var(--dempet)", flex: "none" }}>{k}</span>
      <span style={{ color: "var(--tekst)", fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

export function Tomt({ tekst }: { tekst: string }) {
  return (
    <Kort style={{ textAlign: "center", padding: "28px 20px" }}>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>{tekst}</p>
    </Kort>
  );
}

/**
 * Tabell for admin-flaten.
 *
 * Brede tabeller scroller inne i sin egen ramme, slik at siden aldri
 * scroller sidelengs — det er lett å miste kolonner på en bærbar skjerm.
 */
export function Tabell({
  kolonner,
  children,
  tomtekst,
  antall,
}: {
  kolonner: string[];
  children: ReactNode;
  tomtekst: string;
  antall: number;
}) {
  if (antall === 0) return <Tomt tekst={tomtekst} />;

  return (
    <div
      style={{
        overflowX: "auto",
        background: "var(--kort)",
        borderRadius: "var(--r-kort)",
        boxShadow: "var(--skygge)",
      }}
    >
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720, fontSize: 13.5 }}>
        <thead>
          <tr>
            {kolonner.map((k) => (
              <th
                key={k}
                style={{
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  letterSpacing: ".13em",
                  textTransform: "uppercase",
                  color: "var(--svak)",
                  fontWeight: 500,
                  padding: "16px 14px 10px",
                  borderBottom: "1px solid var(--linje)",
                  whiteSpace: "nowrap",
                }}
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Celle({
  children,
  hoved = false,
  under,
  tall = false,
}: {
  children: ReactNode;
  /** Uthevet, for den kolonnen som identifiserer raden. */
  hoved?: boolean;
  under?: ReactNode;
  tall?: boolean;
}) {
  return (
    <td
      style={{
        padding: "13px 14px",
        borderBottom: "1px solid var(--linje-svak)",
        color: hoved ? "var(--tekst)" : "var(--tekst-2)",
        fontWeight: hoved ? 700 : 400,
        verticalAlign: "top",
        fontVariantNumeric: tall ? "tabular-nums" : undefined,
      }}
    >
      {children}
      {under && (
        <span style={{ display: "block", fontSize: 12, color: "var(--svak)", marginTop: 3 }}>
          {under}
        </span>
      )}
    </td>
  );
}

/** Kroner uten desimaler — beløpene i CRM-en er grove nok til det. */
export const kroner = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

/** «2. sep 2026» */
export function visDato(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(`${iso}T12:00:00Z`) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
