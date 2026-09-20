import { krevRolle } from "@/lib/tilgang";
import { hentPipeline } from "@/lib/data/crm";
import { PIPELINE, type PipelineTrinn } from "@/db/schema";
import { Etikett, Kort, Pille, kroner } from "@/components/ui";

export const metadata = { title: "Pipeline · CRM" };

/**
 * Pipelinen som kolonner, slik prototypen viser den.
 *
 * Trinnene er gjettet ut fra prototypen og skal rettes når dere sier hva
 * dere faktisk kaller stegene — de ligger som én liste i skjemaet, så det
 * er en liten endring.
 */
const TRINNAVN: Record<PipelineTrinn, string> = {
  ny: "Ny",
  kontaktet: "Kontaktet",
  befaring_avtalt: "Befaring avtalt",
  tilbud_sendt: "Tilbud sendt",
  vunnet: "Vunnet",
  tapt: "Tapt",
};

const KANALNAVN: Record<string, string> = {
  telefon: "Telefon",
  epost: "E-post",
  nettskjema: "Nettskjema",
  anbefaling: "Anbefaling",
};

function alder(mottatt: Date): string {
  const dager = Math.floor((Date.now() - mottatt.getTime()) / 86_400_000);
  if (dager === 0) return "I dag";
  if (dager === 1) return "1 dag";
  return `${dager} dager`;
}

export default async function Pipeline() {
  const okt = await krevRolle("leder");
  const kort = await hentPipeline(okt);

  // Tapt vises ikke i tavla — den ville bare fylt en kolonne med historikk.
  const synligeTrinn = PIPELINE.filter((t) => t !== "tapt");

  return (
    <div className="sc" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
      {synligeTrinn.map((trinn) => {
        const iTrinn = kort.filter((k) => k.trinn === trinn);
        const sum = iTrinn.reduce((a, k) => a + (k.sum ?? 0), 0);

        return (
          <div
            key={trinn}
            style={{ flex: "none", width: 268, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                padding: "0 4px",
              }}
            >
              <Etikett>{TRINNAVN[trinn]}</Etikett>
              <span style={{ fontSize: 11.5, color: "var(--svak)" }}>
                {iTrinn.length}
                {sum > 0 && ` · ${kroner.format(sum)}`}
              </span>
            </div>

            {iTrinn.length === 0 ? (
              <div
                style={{
                  border: "1px dashed var(--linje)",
                  borderRadius: 13,
                  padding: "18px 14px",
                  textAlign: "center",
                  fontSize: 12.5,
                  color: "var(--svak)",
                }}
              >
                Tom
              </div>
            ) : (
              iTrinn.map((k) => (
                <Kort key={k.id} style={{ padding: "13px 15px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 9,
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--tekst)" }}>
                      {k.kundeNavn ?? k.avsenderNavn ?? "Ukjent avsender"}
                    </div>
                    {k.aiHastegrad === "akutt" && <Pille farge="rod">Akutt</Pille>}
                    {k.aiHastegrad === "hoy" && <Pille farge="oransje">Haster</Pille>}
                  </div>

                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12.5,
                      color: "var(--dempet)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {k.innhold}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 11,
                      paddingTop: 9,
                      borderTop: "1px solid var(--linje-svak)",
                      fontSize: 11.5,
                      color: "var(--svak)",
                    }}
                  >
                    <span>
                      {KANALNAVN[k.kanal] ?? k.kanal} · {alder(k.mottatt)}
                    </span>
                    {k.sum !== null && (
                      <span style={{ fontWeight: 700, color: "var(--tekst)" }}>
                        {kroner.format(k.sum)}
                      </span>
                    )}
                  </div>
                </Kort>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
