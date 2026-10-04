import Link from "next/link";
import { Etikett, Kort, Tomt } from "@/components/ui";
import type { Glipp, StilleKunde } from "@/lib/data/crm";

const TRINNNAVN: Record<string, string> = {
  ny: "Ny",
  kontaktet: "Kontaktet",
  befaring_avtalt: "Befaring avtalt",
  tilbud_sendt: "Tilbud sendt",
};

/**
 * De to listene som gjør at ingenting blir glemt.
 *
 * Alt annet i CRM-en kan man finne hvis man leter. Disse to finner man
 * bare hvis noen viser dem: en henvendelse ingen har satt en frist på, og
 * en kunde det er blitt stille rundt. Ingen av dem ser gale ut i en
 * vanlig liste — de står bare der.
 */
export function Glipper({
  utenNesteSteg,
  stille,
}: {
  utenNesteSteg: Glipp[];
  stille: StilleKunde[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Etikett style={utenNesteSteg.length > 0 ? { color: "var(--oransje)" } : undefined}>
          Uten neste steg ({utenNesteSteg.length})
        </Etikett>

        {utenNesteSteg.length === 0 ? (
          <Tomt tekst="Alle åpne henvendelser har en frist. Det er slik det skal se ut." />
        ) : (
          <Kort>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {utenNesteSteg.slice(0, 8).map((g) => (
                <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: g.dager > 14 ? "var(--rod)" : "var(--oransje)",
                      whiteSpace: "nowrap",
                      minWidth: 44,
                    }}
                  >
                    {g.dager} d
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                      {g.kundeId ? (
                        <Link
                          href={`/admin/crm/kunder/${g.kundeId}`}
                          style={{ color: "var(--tekst)", textDecoration: "none" }}
                        >
                          {g.kunde ?? g.hva}
                        </Link>
                      ) : (
                        g.hva
                      )}
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--dempet)" }}>
                      {TRINNNAVN[g.trinn] ?? g.trinn}
                      {g.hvem ? ` · ${g.hvem}` : " · ufordelt"}
                    </span>
                  </span>
                </div>
              ))}
              {utenNesteSteg.length > 8 && (
                <Link
                  href="/admin/crm/pipeline"
                  style={{ fontSize: 12, color: "var(--bla)", textDecoration: "none" }}
                >
                  + {utenNesteSteg.length - 8} til ›
                </Link>
              )}
            </div>
          </Kort>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Etikett>Stille for lenge ({stille.length})</Etikett>

        {stille.length === 0 ? (
          <Tomt tekst="Ingen kunder har ligget urørt i to måneder." />
        ) : (
          <Kort>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stille.map((k) => (
                <div key={k.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--svak)",
                      whiteSpace: "nowrap",
                      minWidth: 58,
                    }}
                  >
                    {k.dager === null ? "aldri" : `${k.dager} d`}
                  </span>
                  <Link
                    href={`/admin/crm/kunder/${k.id}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--tekst)",
                      textDecoration: "none",
                    }}
                  >
                    {k.navn}
                  </Link>
                  <span style={{ fontSize: 11, color: "var(--svak)" }}>{k.status}</span>
                </div>
              ))}
            </div>
          </Kort>
        )}
      </div>
    </div>
  );
}
