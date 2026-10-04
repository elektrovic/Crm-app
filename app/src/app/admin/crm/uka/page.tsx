import Link from "next/link";
import { krevRolle } from "@/lib/tilgang";
import { iDag } from "@/lib/data/dagen";
import { mandagen } from "@/lib/uke";
import { sondagen } from "@/lib/data/kalender";
import { hentUkesoppsummering } from "@/lib/data/crm";
import { Etikett, Kort, Sidetittel, Tomt, visDato } from "@/components/ui";

export const metadata = { title: "Uka · CRM" };

function flytt(mandag: string, uker: number): string {
  const d = new Date(`${mandag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + uker * 7);
  return d.toISOString().slice(0, 10);
}

export default async function Uka({
  searchParams,
}: {
  searchParams: Promise<{ uke?: string }>;
}) {
  const okt = await krevRolle("leder");
  const { uke } = await searchParams;
  const mandag = mandagen(uke && /^\d{4}-\d{2}-\d{2}$/.test(uke) ? uke : iDag());
  const sondag = sondagen(mandag);

  const u = await hentUkesoppsummering(okt, mandag, sondag);

  const dato = (d: string) =>
    new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" }).format(
      new Date(`${d}T00:00:00Z`),
    );

  return (
    <>
      <Sidetittel
        tittel={`Uka ${dato(mandag)} – ${dato(sondag)}`}
        under="Det som skjedde, og det som står igjen"
      />

      <div style={{ display: "flex", gap: 8 }}>
        <Link href={`/admin/crm/uka?uke=${flytt(mandag, -1)}`} style={pilstil}>
          ‹ Forrige
        </Link>
        <Link href="/admin/crm/uka" style={pilstil}>
          Denne uka
        </Link>
        <Link href={`/admin/crm/uka?uke=${flytt(mandag, 1)}`} style={pilstil}>
          Neste ›
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <Tall merke="Inn denne uka" verdi={u.inn} />
        <Tall merke="Oppfølginger gjort" verdi={u.gjort} />
        <Tall
          merke="Nye reklamasjoner"
          verdi={u.nyeReklamasjoner}
          farge={u.nyeReklamasjoner > 0 ? "var(--rod-tekst)" : undefined}
        />
        <Tall merke="Reklamasjoner lukket" verdi={u.lukkedeReklamasjoner} />
        <Tall merke="Vunnet totalt" verdi={u.vunnet} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Etikett style={u.staarIgjen.length > 0 ? { color: "var(--oransje)" } : undefined}>
            Står igjen ({u.staarIgjen.length})
          </Etikett>
          {u.staarIgjen.length === 0 ? (
            <Tomt tekst="Ingenting med frist denne uka er ugjort." />
          ) : (
            <Kort>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {u.staarIgjen.map((o) => (
                  <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--oransje)",
                        minWidth: 52,
                      }}
                    >
                      {visDato(o.frist)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{o.hva}</span>
                    <span style={{ fontSize: 11, color: "var(--svak)" }}>
                      {o.hvem ?? "ufordelt"}
                    </span>
                  </div>
                ))}
              </div>
            </Kort>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Etikett>Gjort ({u.gjortListe.length})</Etikett>
          {u.gjortListe.length === 0 ? (
            <Tomt tekst="Ingen oppfølginger er krysset av denne uka." />
          ) : (
            <Kort>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {u.gjortListe.map((g) => (
                  <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--gronn)",
                        minWidth: 52,
                      }}
                    >
                      {new Intl.DateTimeFormat("nb-NO", {
                        day: "numeric",
                        month: "short",
                      }).format(g.naar)}
                    </span>
                    <span
                      style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--dempet)" }}
                    >
                      {g.hva}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--svak)" }}>
                      {g.hvem ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Kort>
          )}
        </div>
      </div>
    </>
  );
}

function Tall({ merke, verdi, farge }: { merke: string; verdi: number; farge?: string }) {
  return (
    <Kort style={{ padding: "13px 15px" }}>
      <Etikett>{merke}</Etikett>
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginTop: 4,
          color: farge ?? "var(--tekst)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {verdi}
      </div>
    </Kort>
  );
}

const pilstil = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid var(--linje)",
  background: "var(--kort)",
  color: "var(--tekst)",
  fontSize: 12.5,
  fontWeight: 600,
  textDecoration: "none",
} as const;
