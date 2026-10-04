import Link from "next/link";
import { krevRolle } from "@/lib/tilgang";
import { hentKundevalg } from "@/lib/data/crm";
import { hentSamtaler, hentSamtaletall, varighet } from "@/lib/data/samtaler";
import { pocketErSattOpp } from "@/lib/pocket/klient";
import { Etikett, Kort, Pille, Tomt } from "@/components/ui";
import { Ring } from "@/components/ring";
import { Kobling, Forslag } from "./samtale-handlinger";

export const metadata = { title: "Samtaler · CRM" };

const KLOKKE = new Intl.DateTimeFormat("nb-NO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Samtalene fra Pocket.
 *
 * Det du ba om var sammendrag, tidspunkt og hva du må følge opp — og det
 * er alt som står her. Transkripsjonen hentes ikke og lagres ikke: en
 * ordrett gjengivelse av en samtale er personopplysninger om den du
 * snakket med, og den gir deg ingenting sammendraget ikke gir.
 *
 * Forslagene blir ikke oppfølginger av seg selv. Du gir dem en frist, og
 * først da havner de i lista du faktisk stoler på.
 */
export default async function Samtaler({
  searchParams,
}: {
  searchParams: Promise<{ ukoblede?: string }>;
}) {
  const okt = await krevRolle("leder");
  const { ukoblede } = await searchParams;
  const bareUkoblede = ukoblede === "1";

  const [rader, tall, kunder] = await Promise.all([
    hentSamtaler(okt, { bareUkoblede }),
    hentSamtaletall(okt),
    hentKundevalg(okt),
  ]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Etikett>
          {bareUkoblede ? "Samtaler uten kunde" : "Samtaler"} · {rader.length}
        </Etikett>

        <div style={{ display: "flex", gap: 7 }}>
          <Filterlenke merke="Alle" sti="/admin/crm/samtaler" aktiv={!bareUkoblede} />
          <Filterlenke
            merke={`Uten kunde${tall.ukoblede > 0 ? ` (${tall.ukoblede})` : ""}`}
            sti="/admin/crm/samtaler?ukoblede=1"
            aktiv={bareUkoblede}
          />
        </div>
      </div>

      {!pocketErSattOpp() && (
        <Kort style={{ borderLeft: "3px solid var(--oransje, #F97316)" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--dempet)", lineHeight: 1.6 }}>
            Pocket er ikke koblet til. Nøkkelen legges inn som{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>POCKET_AI_API_KEY</code> i Netlify,
            merket «Contains secret values». Samtalene hentes inn ved første besøk etter det.
          </p>
        </Kort>
      )}

      {rader.length === 0 ? (
        <Tomt
          tekst={
            bareUkoblede
              ? "Alle samtaler er koblet til en kunde."
              : "Ingen samtaler hentet inn ennå. De kommer med neste synk."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {rader.map((s) => (
            <Kort key={s.id} style={{ padding: "14px 16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 240px" }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
                    {s.tittel ?? "Telefonsamtale"}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "var(--svak)" }}>
                    {KLOKKE.format(s.startet)}
                    {varighet(s.varighetSekunder) && ` · ${varighet(s.varighetSekunder)}`}
                    {s.ansattNavn && ` · ${s.ansattNavn}`}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {s.kundeTelefon && <Ring nummer={s.kundeTelefon} />}
                  {s.forslag.length > 0 && (
                    <Pille farge="oransje">
                      {s.forslag.length} å følge opp
                    </Pille>
                  )}
                </div>
              </div>

              {s.sammendrag && (
                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 13,
                    color: "var(--dempet)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {s.sammendrag}
                </p>
              )}

              {s.forslag.length > 0 && (
                <ul style={{ listStyle: "none", margin: "11px 0 0", padding: 0 }}>
                  {s.forslag.map((o) => (
                    <Forslag key={o} samtaleId={s.id} oppgave={o} />
                  ))}
                </ul>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid var(--linje-svak)",
                }}
              >
                <Kobling
                  id={s.id}
                  kundeId={s.kundeId}
                  bekreftet={s.koblingBekreftet}
                  kunder={kunder}
                />
                {s.kundeId && (
                  <Link
                    href={`/admin/crm/kunder/${s.kundeId}`}
                    style={{ fontSize: 12.5, color: "var(--bla)", textDecoration: "none" }}
                  >
                    Se hele kundeforholdet →
                  </Link>
                )}
              </div>
            </Kort>
          ))}
        </div>
      )}
    </>
  );
}

function Filterlenke({ merke, sti, aktiv }: { merke: string; sti: string; aktiv: boolean }) {
  return (
    <Link
      href={sti}
      aria-current={aktiv ? "page" : undefined}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: aktiv ? "var(--bla)" : "var(--kort)",
        color: aktiv ? "#fff" : "var(--tekst-2)",
        boxShadow: aktiv ? "none" : "var(--skygge)",
        fontSize: 12.5,
        fontWeight: aktiv ? 700 : 600,
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      {merke}
    </Link>
  );
}
