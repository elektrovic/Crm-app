import Link from "next/link";
import type { Jobbkort as Kort_ } from "@/lib/data/kalender";
import { Etikett, IkonFlis, Kort, RadVerdi, Sidetittel } from "@/components/ui";
import { Pakkeliste } from "./pakkeliste";

/**
 * Alt om én jobb, på én skjerm.
 *
 * Rekkefølgen er ikke tilfeldig. Den følger hva montøren trenger når:
 * først hvor han skal og når, så hvordan han kommer inn, så hva han skal
 * ha med — den krysser han av før han kjører — og til slutt bildene og
 * manglene han kan slå opp i når han står der.
 */
export function Jobbkort({
  jobb,
  kanRedigere,
}: {
  jobb: Kort_;
  /** Ledelsen kan fjerne pakkelinjer; montøren krysser bare av. */
  kanRedigere: boolean;
}) {
  const dato = new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${jobb.dato}T00:00:00Z`));

  const klokke =
    jobb.fraKl && jobb.tilKl
      ? `${jobb.fraKl}–${jobb.tilKl}`
      : jobb.fraKl
        ? `Fra ${jobb.fraKl}`
        : "Hele dagen";

  const kart = jobb.adresse
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(jobb.adresse)}`
    : null;

  return (
    <>
      <Sidetittel tittel={`${jobb.nummer} ${jobb.navn}`} under={`${dato} · ${klokke}`} />

      {/* Hvor, og hvem */}
      <Kort>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <IkonFlis farge={jobb.farge} storrelse={30}>
              {jobb.initialer}
            </IkonFlis>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{jobb.ansattNavn}</div>
              <div style={{ fontSize: 11.5, color: "var(--dempet)" }}>{jobb.avdeling}</div>
            </div>
          </div>

          {jobb.kolleger.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--dempet)" }}>Sammen med</span>
              {jobb.kolleger.map((k) => (
                <span
                  key={k.id}
                  style={{ display: "flex", alignItems: "center", gap: 5 }}
                  title={k.navn}
                >
                  <IkonFlis farge={k.farge} storrelse={22}>
                    {k.initialer}
                  </IkonFlis>
                  <span style={{ fontSize: 12.5 }}>{k.navn}</span>
                </span>
              ))}
            </div>
          )}

          {jobb.kunde && <RadVerdi k="Kunde" v={jobb.kunde} />}
          {jobb.adresse && (
            <RadVerdi
              k="Adresse"
              v={
                kart ? (
                  <a href={kart} target="_blank" rel="noreferrer" style={{ color: "var(--bla)" }}>
                    {jobb.adresse}
                  </a>
                ) : (
                  jobb.adresse
                )
              }
            />
          )}

          {jobb.notat && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--flate)",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {jobb.notat}
            </div>
          )}
        </div>
      </Kort>

      {/* Hvordan komme inn */}
      {jobb.adkomst && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Etikett>Adkomst</Etikett>
          <Kort>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {jobb.adkomst.kontaktperson && (
                <RadVerdi k="Kontakt" v={jobb.adkomst.kontaktperson} />
              )}
              {jobb.adkomst.kontakttelefon && (
                <RadVerdi
                  k="Telefon"
                  v={
                    <a href={`tel:${jobb.adkomst.kontakttelefon.replace(/\s/g, "")}`}
                       style={{ color: "var(--bla)" }}>
                      {jobb.adkomst.kontakttelefon}
                    </a>
                  }
                />
              )}
              {jobb.adkomst.nokkelkode && (
                <RadVerdi
                  k="Nøkkelkode"
                  v={
                    <span style={{ fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>
                      {jobb.adkomst.nokkelkode}
                    </span>
                  }
                />
              )}
              {jobb.adkomst.parkering && <RadVerdi k="Parkering" v={jobb.adkomst.parkering} />}
              {jobb.adkomst.merknad && (
                <div style={{ fontSize: 12.5, color: "var(--dempet)", whiteSpace: "pre-wrap" }}>
                  {jobb.adkomst.merknad}
                </div>
              )}
            </div>
          </Kort>
        </div>
      )}

      {/* Hva som skal med */}
      <Pakkeliste
        linjer={jobb.medbring}
        kanFjerne={kanRedigere}
        tildelingId={jobb.tildelingId}
      />

      {/* Bilder */}
      {jobb.bilder.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <Etikett>Bilder</Etikett>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))",
              gap: 8,
            }}
          >
            {jobb.bilder.map((b) => (
              <figure key={b.id} style={{ margin: 0 }}>
                {b.tilgjengelig ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/vedlegg/${b.id}`}
                    alt={b.slag === "planlegging" ? "Lagt på fra planleggingen" : "Fra jobben"}
                    loading="lazy"
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 3",
                      objectFit: "cover",
                      borderRadius: 10,
                      background: "var(--flate)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "4 / 3",
                      borderRadius: 10,
                      background: "var(--flate)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "var(--svak)",
                      textAlign: "center",
                      padding: 8,
                    }}
                  >
                    Arkivert i Tripletex
                  </div>
                )}
                <figcaption style={{ fontSize: 10.5, color: "var(--svak)", marginTop: 3 }}>
                  {b.slag === "planlegging" ? "Fra planleggingen" : "Fra jobben"}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* Meldt manglende tidligere */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Etikett>Meldt manglende på prosjektet</Etikett>
        {jobb.mangler.length === 0 ? (
          <Kort>
            <p style={{ margin: 0, fontSize: 13, color: "var(--dempet)" }}>
              Ingen har meldt inn manglende materiell på denne jobben.
            </p>
          </Kort>
        ) : (
          <Kort>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {jobb.mangler.map((m) => (
                <div
                  key={m.id}
                  style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 13 }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{m.tekst}</span>
                  {m.antall && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                      {m.antall} {m.enhet}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono)",
                      color: m.bestilt ? "var(--gronn)" : "var(--oransje)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.bestilt ? "bestilt" : "ikke bestilt"}
                  </span>
                </div>
              ))}
            </div>
          </Kort>
        )}
      </div>

      <Link
        href={`/prosjekt/${jobb.nummer}`}
        style={{ fontSize: 13, fontWeight: 600, color: "var(--bla)", textDecoration: "none" }}
      >
        Åpne prosjektet ›
      </Link>
    </>
  );
}
