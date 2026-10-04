import Link from "next/link";
import { notFound } from "next/navigation";
import { krevRolle } from "@/lib/tilgang";
import { hentSak } from "@/lib/data/crm";
import { hentProsjektvalg } from "@/lib/data/kalender";
import { Etikett, Kort, RadVerdi, Sidetittel, kroner, visDato } from "@/components/ui";
import { Ring } from "@/components/ring";
import { Trinnvelger } from "../../crm-handlinger";
import { utenNummer } from "@/lib/prosjektnavn";

export const metadata = { title: "Sak · CRM" };

const TRINNAVN: Record<string, string> = {
  ny: "Ny",
  kontaktet: "Kontaktet",
  befaring_avtalt: "Befaring avtalt",
  tilbud_sendt: "Tilbud sendt",
  vunnet: "Vunnet",
  tapt: "Tapt",
};

export default async function Saksside({ params }: { params: Promise<{ id: string }> }) {
  const okt = await krevRolle("leder");
  const { id } = await params;

  const sak = await hentSak(okt, id);
  if (!sak) notFound();

  const prosjektvalg = await hentProsjektvalg(okt);
  const harApen = sak.oppfolginger.some((o) => !o.fullfort);
  const nummer = sak.avsenderTelefon ?? sak.kundeTelefon;

  return (
    <>
      <Link
        href="/admin/crm/pipeline"
        style={{ fontSize: 13, color: "var(--bla)", textDecoration: "none" }}
      >
        ‹ Alle henvendelser
      </Link>

      <Sidetittel
        tittel={sak.kundeNavn ?? sak.avsenderNavn ?? "Ukjent avsender"}
        under={`${TRINNAVN[sak.trinn] ?? sak.trinn} · ${sak.kanal} · ${new Intl.DateTimeFormat(
          "nb-NO",
          { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
        ).format(sak.mottatt)}`}
      />

      <Kort>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {nummer && (
            <RadVerdi k="Telefon" v={<Ring nummer={nummer} storrelse={14} />} />
          )}
          {sak.avsenderEpost && (
            <RadVerdi
              k="E-post"
              v={
                <a href={`mailto:${sak.avsenderEpost}`} style={{ color: "var(--bla)" }}>
                  {sak.avsenderEpost}
                </a>
              }
            />
          )}
          {sak.kundeId && (
            <RadVerdi
              k="Kunde"
              v={
                <Link href={`/admin/crm/kunder/${sak.kundeId}`} style={{ color: "var(--bla)" }}>
                  {sak.kundeNavn} ›
                </Link>
              }
            />
          )}
          {sak.prosjektNummer && (
            <RadVerdi
              k="Ble til"
              v={
                <Link href={`/prosjekt/${sak.prosjektNummer}`} style={{ color: "var(--bla)" }}>
                  {sak.prosjektNummer} {utenNummer(sak.prosjektNummer, sak.prosjektNavn ?? "")} ›
                </Link>
              }
            />
          )}
          {sak.sum !== null && <RadVerdi k="Sum" v={kroner.format(sak.sum)} />}
          <RadVerdi k="Ansvarlig" v={sak.ansvarligNavn ?? "ufordelt"} />
        </div>
      </Kort>

      <Etikett>Henvendelsen</Etikett>
      <Kort>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {sak.innhold}
        </p>
        {sak.aiSammendrag && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--dempet)" }}>
            Sammendrag: {sak.aiSammendrag}
          </p>
        )}
      </Kort>

      <Etikett>Trinn</Etikett>
      <Kort>
        <Trinnvelger
          id={sak.id}
          trinn={sak.trinn}
          harNesteSteg={harApen}
          kundeId={sak.kundeId}
          hvem={sak.kundeNavn ?? sak.avsenderNavn}
          prosjektId={sak.prosjektId}
          prosjekter={prosjektvalg.map((p) => ({
            id: p.id,
            nummer: p.nummer,
            navn: utenNummer(p.nummer, p.navn),
          }))}
        />
      </Kort>

      <Etikett>Avtalt videre ({sak.oppfolginger.length})</Etikett>
      <Kort>
        {sak.oppfolginger.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--dempet)" }}>
            Ingenting avtalt. Flytt trinnet over, så spør den om en frist.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {sak.oppfolginger.map((o) => (
              <div key={o.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: o.fullfort ? "var(--gronn)" : "var(--oransje)",
                    minWidth: 52,
                  }}
                >
                  {visDato(o.frist)}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    color: o.fullfort ? "var(--svak)" : "var(--tekst)",
                    textDecoration: o.fullfort ? "line-through" : "none",
                  }}
                >
                  {o.hva}
                </span>
              </div>
            ))}
          </div>
        )}
      </Kort>
    </>
  );
}
