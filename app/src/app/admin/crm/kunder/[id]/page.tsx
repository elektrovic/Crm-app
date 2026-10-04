import Link from "next/link";
import { notFound } from "next/navigation";
import { krevRolle } from "@/lib/tilgang";
import { hentKunde, hentKundetidslinje } from "@/lib/data/crm";
import { Etikett, Kort, RadVerdi, Sidetittel, Tomt } from "@/components/ui";
import { Notat } from "../notat";

export const metadata = { title: "Kunde · CRM" };

const kroner = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

export default async function Kundekort({ params }: { params: Promise<{ id: string }> }) {
  const okt = await krevRolle("leder");
  const { id } = await params;

  const kunde = await hentKunde(okt, id);
  if (!kunde) notFound();

  const tidslinje = await hentKundetidslinje(okt, id);

  return (
    <>
      <Link
        href="/admin/crm/kunder"
        style={{ fontSize: 13, color: "var(--bla)", textDecoration: "none" }}
      >
        ‹ Alle kunder
      </Link>

      <Sidetittel
        tittel={kunde.navn}
        under={[kunde.type, kunde.avdeling, kunde.status].filter(Boolean).join(" · ")}
      />

      <Kort>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {kunde.kontaktperson && <RadVerdi k="Kontakt" v={kunde.kontaktperson} />}
          {kunde.telefon && (
            <RadVerdi
              k="Telefon"
              v={
                <a
                  href={`tel:${kunde.telefon.replace(/\s/g, "")}`}
                  style={{ color: "var(--bla)" }}
                >
                  {kunde.telefon}
                </a>
              }
            />
          )}
          {kunde.epost && (
            <RadVerdi
              k="E-post"
              v={
                <a href={`mailto:${kunde.epost}`} style={{ color: "var(--bla)" }}>
                  {kunde.epost}
                </a>
              }
            />
          )}
          {kunde.adresse && <RadVerdi k="Adresse" v={kunde.adresse} />}
          <RadVerdi
            k="Omsetning"
            v={
              kunde.omsetning ? (
                kroner.format(Number(kunde.omsetning))
              ) : (
                // Tallet kommer fra Tripletex. Står det tomt, er det fordi
                // synken ikke har hentet det — ikke fordi det er null.
                <span style={{ color: "var(--svak)" }}>ikke hentet</span>
              )
            }
          />
        </div>
      </Kort>

      <Etikett>Historikk ({tidslinje.length})</Etikett>

      <Notat kundeId={kunde.id} />

      {tidslinje.length === 0 ? (
        <Tomt tekst="Ingenting registrert på denne kunden ennå." />
      ) : (
        <Kort>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {tidslinje.map((h, i) => (
              <li
                key={`${h.slag}-${h.id}`}
                style={{
                  display: "flex",
                  gap: 12,
                  paddingBottom: i === tidslinje.length - 1 ? 0 : 16,
                  position: "relative",
                }}
              >
                {/* Strek mellom prikkene, så rekkefølgen leses som en linje
                    og ikke som en liste. Ikke under den siste. */}
                {i < tidslinje.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 5,
                      top: 16,
                      bottom: 0,
                      width: 1,
                      background: "var(--linje)",
                    }}
                  />
                )}

                <span
                  aria-hidden="true"
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    background: h.farge,
                    flex: "none",
                    marginTop: 4,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: "var(--svak)",
                    }}
                  >
                    {new Intl.DateTimeFormat("nb-NO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(h.dato)}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {h.lenke ? (
                      <Link href={h.lenke} style={{ color: "var(--tekst)", textDecoration: "none" }}>
                        {h.tittel}
                      </Link>
                    ) : (
                      h.tittel
                    )}
                  </div>
                  {h.detalj && (
                    <div style={{ fontSize: 12.5, color: "var(--dempet)", lineHeight: 1.5 }}>
                      {h.detalj}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Kort>
      )}
    </>
  );
}
