import Link from "next/link";
import { krevOkt } from "@/lib/tilgang";
import { iDag as dagensDato } from "@/lib/data/dagen";
import { hentMinDag, hentNesteJobbdag, type Dagsjobb } from "@/lib/data/kalender";
import { IkonFlis, Kort, Tomt } from "@/components/ui";
import { Pakkeliste } from "@/components/pakkeliste";
import { RingKnapp, VeiKnapp } from "@/components/snarveier";
import { Dagsvelger } from "./dagsvelger";

export const metadata = { title: "I dag · Montørappen" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function flyttDag(dato: string, dager: number): string {
  const d = new Date(`${dato}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

function langDato(dato: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dato}T00:00:00Z`));
}

/**
 * Dagen, slik den ser ut fra bilen klokka sju.
 *
 * Alt som trengs for å kjøre ut står her: klokkeslettet stort, adressen
 * som en knapp som starter ruta, nummeret til den som åpner døra, og
 * pakkelista med avkryssing. Ingenting av det ligger bak et trykk.
 *
 * Det var hele poenget med å bygge den om. Ukelista som sto her før var
 * riktig nok, men hver jobb var en lenke — og et skjermbilde som ikke
 * svarer på spørsmålet med en gang, blir byttet ut med en telefon til
 * formannen.
 */
export default async function MinDag({
  searchParams,
}: {
  searchParams: Promise<{ dag?: string }>;
}) {
  const okt = await krevOkt();
  const { dag } = await searchParams;
  const idag = dagensDato();
  const dato = dag && ISO.test(dag) ? dag : idag;

  const jobber = await hentMinDag(okt, dato);
  const neste = jobber.length === 0 ? await hentNesteJobbdag(okt, dato) : null;

  const samletMedbring = jobber.reduce((a, j) => a + j.medbring.length, 0);
  const samletPakket = jobber.reduce(
    (a, j) => a + j.medbring.filter((m) => m.pakket).length,
    0,
  );

  return (
    <>
      <div>
        <h1 style={{ margin: 0, fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {dato === idag ? "I dag" : langDato(dato)}
        </h1>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--dempet)" }}>
          {dato === idag && `${langDato(dato)} · `}
          {jobber.length === 0
            ? "ingen jobber"
            : `${jobber.length} ${jobber.length === 1 ? "jobb" : "jobber"}`}
          {samletMedbring > 0 && ` · ${samletPakket}/${samletMedbring} pakket`}
        </p>
      </div>

      <Dagsvelger
        dato={dato}
        iDag={idag}
        forrige={flyttDag(dato, -1)}
        neste={flyttDag(dato, 1)}
      />

      {jobber.length === 0 ? (
        <Tomt
          tekst={
            neste
              ? `Ingenting satt opp. Neste jobb er ${langDato(neste)}.`
              : "Ingenting satt opp på deg, og ingenting framover heller."
          }
        />
      ) : (
        jobber.map((j) => <Dagskort key={j.tildelingId} jobb={j} />)
      )}

      {neste && (
        <Link
          href={`/kalender?dag=${neste}`}
          style={{
            alignSelf: "flex-start",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--bla)",
            textDecoration: "none",
          }}
        >
          Hopp til {langDato(neste)} ›
        </Link>
      )}
    </>
  );
}

/**
 * Én jobb, i den rekkefølgen man trenger den.
 *
 * Når → hvor → hvem åpner → hva skal med. Rekkefølgen er den samme hver
 * gang, slik at man etter en uke slutter å lese og bare ser.
 */
function Dagskort({ jobb }: { jobb: Dagsjobb }) {
  const klokke =
    jobb.fraKl && jobb.tilKl
      ? `${jobb.fraKl}–${jobb.tilKl}`
      : jobb.fraKl
        ? `fra ${jobb.fraKl}`
        : "Hele dagen";

  const ekstra = [
    jobb.adkomst?.nokkelkode && `Kode ${jobb.adkomst.nokkelkode}`,
    jobb.adkomst?.parkering,
  ].filter(Boolean) as string[];

  return (
    <Kort style={{ borderLeft: `4px solid ${jobb.farge}`, padding: "15px 16px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {/* Når */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 21,
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
            }}
          >
            {klokke}
          </span>
          {jobb.kolleger.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11.5, color: "var(--svak)" }}>med</span>
              {jobb.kolleger.map((k) => (
                <span key={k.id} title={k.navn}>
                  <IkonFlis farge={k.farge} storrelse={21}>
                    {k.initialer}
                  </IkonFlis>
                </span>
              ))}
            </span>
          )}
        </div>

        {/* Hvor */}
        <div>
          <Link
            href={`/jobb/${jobb.tildelingId}`}
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              color: "var(--tekst)",
              textDecoration: "none",
            }}
          >
            {jobb.nummer} {jobb.navn}
          </Link>
          {jobb.adresse && (
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--dempet)" }}>
              {jobb.adresse}
            </p>
          )}
          {jobb.kunde && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--svak)" }}>{jobb.kunde}</p>
          )}
        </div>

        {/* De to knappene */}
        {(jobb.adresse || jobb.adkomst?.kontakttelefon) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <VeiKnapp adresse={jobb.adresse} />
            <RingKnapp
              nummer={jobb.adkomst?.kontakttelefon ?? null}
              navn={jobb.adkomst?.kontaktperson}
            />
          </div>
        )}

        {ekstra.length > 0 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {ekstra.map((e) => (
              <span
                key={e}
                style={{
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "var(--flate)",
                  fontSize: 12,
                  color: "var(--tekst-2)",
                }}
              >
                {e}
              </span>
            ))}
          </div>
        )}

        {jobb.notat && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--flate)",
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {jobb.notat}
          </div>
        )}

        {/* Hva skal med */}
        {jobb.medbring.length > 0 && (
          <Pakkeliste linjer={jobb.medbring} kanFjerne={false} tildelingId={jobb.tildelingId} />
        )}

        <Link
          href={`/jobb/${jobb.tildelingId}`}
          style={{ fontSize: 12.5, color: "var(--bla)", textDecoration: "none" }}
        >
          Bilder, mangler og resten ›
        </Link>
      </div>
    </Kort>
  );
}
