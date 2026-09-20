import Link from "next/link";
import { notFound } from "next/navigation";
import { krevOkt } from "@/lib/tilgang";
import { hentMangler, hentProsjekt, hentTidsvindu } from "@/lib/data/prosjekt";
import { iDag } from "@/lib/data/dagen";
import { lagMelding } from "@/lib/sms/meldinger";
import { normaliserEllerNull, tilVisning } from "@/lib/sms/telefon";
import { smsErSattOpp } from "@/lib/sms/client";
import { Etikett, IkonFlis, Kort, Pille, Sidetittel } from "@/components/ui";
import { AdkomstKort } from "./adkomst-kort";
import { SmsKort } from "./sms-kort";

export async function generateMetadata({ params }: { params: Promise<{ nr: string }> }) {
  const { nr } = await params;
  return { title: `Prosjekt ${nr} · Montørappen` };
}

export default async function Prosjekt({ params }: { params: Promise<{ nr: string }> }) {
  const okt = await krevOkt();
  const { nr } = await params;

  const prosjekt = await hentProsjekt(okt, nr);
  if (!prosjekt) notFound();

  const mangler = await hentMangler(okt, prosjekt.id);
  const apneMangler = mangler.filter((m) => !m.bestilt).length;

  const tidsvindu = await hentTidsvindu(okt, prosjekt.id, iDag());
  const kundenummer = normaliserEllerNull(prosjekt.adkomst?.kontakttelefon);

  // Meldingene lages på serveren, slik at montøren ser nøyaktig den teksten
  // som blir sendt — ikke en tilnærming satt sammen i nettleseren.
  const meldingsInput = {
    kundenavn: prosjekt.adkomst?.kontaktperson ?? null,
    prosjektnummer: prosjekt.nummer,
    montornavn: okt.navn,
    firmanavn: process.env.FIRMANAVN ?? "Halland Gruppen",
    tidsvindu,
    kontakttelefon: process.env.KONTAKTTELEFON ?? null,
  };

  const snarveier = [
    {
      sti: `/prosjekt/${nr}/mangler`,
      navn: "Mangler",
      under: apneMangler === 0 ? "Ingenting å hente" : `${apneMangler} å hente hos grossist`,
      farge: "var(--oransje)",
      ikon: "M",
    },
    {
      sti: `/prosjekt/${nr}/tillegg`,
      navn: "Tillegg",
      under: "Med bilde og signatur",
      farge: "var(--bla)",
      ikon: "T",
    },
    {
      sti: `/prosjekt/${nr}/skjema`,
      navn: "Kontrollskjema",
      under: "Ett spørsmål av gangen",
      farge: "var(--lilla)",
      ikon: "K",
    },
  ];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            width: 5,
            alignSelf: "stretch",
            minHeight: 46,
            borderRadius: 999,
            background: prosjekt.farge,
            flex: "none",
          }}
        />
        <Sidetittel tittel={prosjekt.navn} under={`${prosjekt.nummer} · ${prosjekt.kunde ?? "Uten kunde"}`} />
      </div>

      <Kort>
        <Etikett>Om prosjektet</Etikett>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {prosjekt.adresse && (
            <div style={{ fontSize: 13.5, color: "var(--tekst)", fontWeight: 600 }}>
              {prosjekt.adresse}
            </div>
          )}
          {tidsvindu && (
            <div style={{ fontSize: 12.5, color: "var(--dempet)" }}>
              Du er satt opp {tidsvindu} i dag
            </div>
          )}
        </div>
      </Kort>

      <AdkomstKort prosjektId={prosjekt.id} adkomst={prosjekt.adkomst} />

      {kundenummer && smsErSattOpp() && (
        <SmsKort
          prosjektId={prosjekt.id}
          mottaker={kundenummer}
          mottakerVisning={tilVisning(kundenummer)}
          kontaktperson={prosjekt.adkomst?.kontaktperson ?? null}
          forOppdrag={lagMelding("for_oppdrag", meldingsInput)}
          etterOppdrag={lagMelding("etter_oppdrag", meldingsInput)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Etikett style={{ padding: "0 4px" }}>På denne jobben</Etikett>
        {snarveier.map((s) => (
          <Link key={s.sti} href={s.sti} style={{ textDecoration: "none" }}>
            <Kort style={{ padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <IkonFlis farge={s.farge}>{s.ikon}</IkonFlis>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--tekst)" }}>
                    {s.navn}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--dempet)" }}>{s.under}</div>
                </div>
                {s.navn === "Mangler" && apneMangler > 0 && (
                  <Pille farge="oransje">{apneMangler}</Pille>
                )}
                <span style={{ color: "var(--svak)", fontSize: 17 }} aria-hidden="true">
                  ›
                </span>
              </div>
            </Kort>
          </Link>
        ))}
      </div>

      <Link href={`/timer?prosjekt=${prosjekt.nummer}`} style={{ textDecoration: "none" }}>
        <Kort style={{ background: "var(--mork)", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
              Før timer på dette prosjektet
            </span>
            <span style={{ color: "#fff", fontSize: 15 }} aria-hidden="true">
              ›
            </span>
          </div>
        </Kort>
      </Link>
    </>
  );
}
