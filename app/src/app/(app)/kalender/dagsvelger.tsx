import Link from "next/link";

/**
 * Bla mellom dagene, og bytte til uka.
 *
 * Pilene er store nok til å treffes med hansker, og «I dag» står alltid
 * i midten — den er den eneste man leter etter når man har bladd for
 * langt og vil tilbake.
 */
export function Dagsvelger({
  dato,
  iDag,
  forrige,
  neste,
}: {
  dato: string;
  iDag: string;
  forrige: string;
  neste: string;
}) {
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "stretch" }}>
      <Link href={`/kalender?dag=${forrige}`} aria-label="Forrige dag" style={pil}>
        ‹
      </Link>

      <Link
        href="/kalender"
        style={{
          ...pil,
          flex: 1,
          fontSize: 13,
          background: dato === iDag ? "var(--bla)" : "var(--kort)",
          color: dato === iDag ? "#fff" : "var(--tekst)",
          borderColor: dato === iDag ? "var(--bla)" : "var(--linje)",
        }}
      >
        I dag
      </Link>

      <Link href={`/kalender?dag=${neste}`} aria-label="Neste dag" style={pil}>
        ›
      </Link>

      <Link href="/kalender/uke" style={{ ...pil, fontSize: 13, padding: "0 15px" }}>
        Uka
      </Link>
    </div>
  );
}

const pil = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 46,
  minWidth: 46,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 19,
  fontWeight: 700,
  textDecoration: "none",
} as const;
