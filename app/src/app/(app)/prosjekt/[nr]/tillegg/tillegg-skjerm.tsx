"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Etikett, Knapp, Kort, Pille, Sidetittel } from "@/components/ui";
import { Signatur } from "@/components/signatur";
import { komprimerBilde, visStorrelse, type KomprimertBilde } from "@/lib/bilde";
import { lagKlientNokkel } from "@/lib/offline/ko";

type Prislinje = { id: string; navn: string; enhet: string | null; pris: number };

const kroner = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

/**
 * Tillegg med prisliste, bilde og signatur.
 *
 * Flyten følger prototypen: velg linje fra prislista, ta bilde, la kunden
 * signere. Signaturen er ikke valgfri — uten den er tillegget en påstand,
 * og da er det ikke verdt å registrere.
 */
export function TilleggSkjerm({
  prosjektId,
  prosjektNummer,
  prosjektNavn,
  prisliste,
  avdeling,
}: {
  prosjektId: string;
  prosjektNummer: string;
  prosjektNavn: string;
  prisliste: Prislinje[];
  avdeling: string;
}) {
  const router = useRouter();
  const filvelger = useRef<HTMLInputElement>(null);

  const [valgt, setValgt] = useState<Prislinje | null>(null);
  const [antall, setAntall] = useState(1);
  const [kommentar, setKommentar] = useState("");
  const [bilde, setBilde] = useState<KomprimertBilde | null>(null);
  const [signatur, setSignatur] = useState<string | null>(null);
  const [signertAv, setSignertAv] = useState("");

  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [advarsel, setAdvarsel] = useState<string | null>(null);
  const [kvittering, setKvittering] = useState<string | null>(null);

  const sum = valgt ? valgt.pris * antall : 0;
  const kanSende = Boolean(valgt && signatur && signertAv.trim() && antall > 0);

  async function velgBilde(fil: File | undefined) {
    if (!fil) return;
    setFeil(null);
    try {
      setBilde(await komprimerBilde(fil));
    } catch {
      setFeil("Fikk ikke lest bildet. Prøv å ta det på nytt.");
    }
  }

  async function send() {
    if (!valgt || !signatur) return;
    setJobber(true);
    setFeil(null);

    try {
      const svar = await fetch("/api/tillegg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klientNokkel: lagKlientNokkel(),
          prosjektId,
          navn: valgt.navn,
          enhet: valgt.enhet,
          antall,
          enhetspris: valgt.pris,
          kommentar: kommentar.trim() || null,
          bilde: bilde ? { mimetype: bilde.mimetype, base64: bilde.base64 } : null,
          signatur: { mimetype: "image/png" as const, base64: signatur },
          signertAv: signertAv.trim(),
        }),
      });

      const kropp = (await svar.json().catch(() => ({}))) as {
        feil?: string;
        advarsel?: string;
        vedleggOpplastet?: number;
      };

      if (!svar.ok) {
        setFeil(kropp.feil ?? "Fikk ikke registrert tillegget.");
        return;
      }

      const vedleggTekst =
        kropp.vedleggOpplastet && kropp.vedleggOpplastet > 0
          ? ` Bilde og signatur ligger på prosjektet i Tripletex.`
          : "";

      setKvittering(
        `${valgt.navn} · ${kroner.format(sum)} er registrert på prosjekt ${prosjektNummer}, signert av ${signertAv.trim()}.${vedleggTekst}`,
      );
      setAdvarsel(kropp.advarsel ?? null);
      setValgt(null);
      setAntall(1);
      setKommentar("");
      setBilde(null);
      setSignatur(null);
      setSignertAv("");
      router.refresh();
    } catch {
      // Tillegg krever nett fordi bildet er for stort for sendekøen slik
      // den er bygget i dag. Det sier vi rett ut i stedet for å late som.
      setFeil("Ingen forbindelse. Tillegg med bilde krever nett — prøv igjen når du har dekning.");
    } finally {
      setJobber(false);
    }
  }

  return (
    <>
      <Sidetittel tittel="Tillegg" under={`${prosjektNummer} · ${prosjektNavn}`} />

      {kvittering && (
        <Kort style={{ background: "var(--gronn-bg)", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <Pille farge="gronn">Registrert</Pille>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--gronn-tekst)", lineHeight: 1.5 }}>
            {kvittering}
          </p>
        </Kort>
      )}

      {advarsel && (
        <Kort style={{ background: "var(--oransje-bg)", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <Pille farge="oransje">Ikke i Tripletex ennå</Pille>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--oransje-tekst)", lineHeight: 1.5 }}>
            {advarsel}
          </p>
        </Kort>
      )}

      {/* Steg 1 — prisliste */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Etikett style={{ padding: "0 4px" }}>Prisliste · {avdeling}</Etikett>

        {prisliste.length === 0 && (
          <Kort>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>
              Ingen prisliste lagt inn for {avdeling} ennå. Kontoret legger den
              inn under Admin.
            </p>
          </Kort>
        )}

        {prisliste.map((p) => {
          const erValgt = valgt?.id === p.id;
          return (
            <Kort key={p.id} style={{ padding: "13px 15px" }} loft={erValgt}>
              <button
                onClick={() => setValgt(erValgt ? null : p)}
                aria-pressed={erValgt}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  background: "none",
                  border: "none",
                  padding: 0,
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${erValgt ? "var(--bla)" : "var(--linje)"}`,
                    background: erValgt ? "var(--bla)" : "transparent",
                    flex: "none",
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--tekst)",
                    }}
                  >
                    {p.navn}
                  </span>
                  {p.enhet && (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--svak)" }}>
                      {p.enhet}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, flex: "none" }}>
                  {kroner.format(p.pris)}
                </span>
              </button>
            </Kort>
          );
        })}
      </div>

      {valgt && (
        <>
          {/* Steg 2 — antall og kommentar */}
          <Kort>
            <Etikett>Antall og notat</Etikett>
            <div style={{ display: "flex", gap: 8, marginTop: 11, alignItems: "center" }}>
              <button
                onClick={() => setAntall((a) => Math.max(1, a - 1))}
                aria-label="Færre"
                style={teller}
              >
                −
              </button>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={antall}
                onChange={(e) => setAntall(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Antall"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--linje)",
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: "center",
                  fontFamily: "var(--font)",
                }}
              />
              <button onClick={() => setAntall((a) => a + 1)} aria-label="Flere" style={teller}>
                +
              </button>
            </div>

            <textarea
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              placeholder="Notat til kontoret (valgfritt)"
              rows={2}
              style={{
                width: "100%",
                marginTop: 9,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--linje)",
                fontSize: 15,
                fontFamily: "var(--font)",
                resize: "vertical",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 13,
                paddingTop: 11,
                borderTop: "1px solid var(--linje-svak)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--dempet)" }}>Sum</span>
              <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.02em" }}>
                {kroner.format(sum)}
              </span>
            </div>
          </Kort>

          {/* Steg 3 — bilde */}
          <Kort>
            <Etikett>Bilde</Etikett>
            <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "var(--dempet)" }}>
              Valgfritt, men gjør saken mye enklere hvis kunden spør senere.
            </p>

            <input
              ref={filvelger}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void velgBilde(e.target.files?.[0])}
              style={{ display: "none" }}
            />

            {bilde ? (
              <div style={{ marginTop: 11 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${bilde.mimetype};base64,${bilde.base64}`}
                  alt="Bilde av tillegget"
                  style={{ width: "100%", borderRadius: 12, display: "block" }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 8,
                  }}
                >
                  <span style={{ fontSize: 11.5, color: "var(--svak)" }}>
                    {bilde.bredde}×{bilde.hoyde} · {visStorrelse(bilde.storrelse)}
                  </span>
                  <button
                    onClick={() => setBilde(null)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--bla)",
                      padding: 0,
                    }}
                  >
                    Ta nytt
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 11 }}>
                <Knapp variant="sekundar" bred onClick={() => filvelger.current?.click()}>
                  Ta bilde
                </Knapp>
              </div>
            )}
          </Kort>

          {/* Steg 4 — signatur */}
          <Kort>
            <Etikett>Kundens signatur</Etikett>
            <p style={{ margin: "7px 0 11px", fontSize: 12.5, color: "var(--dempet)" }}>
              La kunden signere på skjermen. Dette er dokumentasjonen på at
              tillegget er godkjent.
            </p>

            <Signatur onEndret={setSignatur} />

            <input
              value={signertAv}
              onChange={(e) => setSignertAv(e.target.value)}
              placeholder="Navnet til den som signerte"
              style={{
                width: "100%",
                marginTop: 10,
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid var(--linje)",
                fontSize: 16,
                fontFamily: "var(--font)",
              }}
            />
          </Kort>

          {feil && (
            <Kort style={{ background: "var(--rod-bg)", boxShadow: "none" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--rod-tekst)", fontWeight: 600 }}>
                {feil}
              </p>
            </Kort>
          )}

          <div style={{ position: "sticky", bottom: 16 }}>
            <Knapp bred variant="mork" disabled={!kanSende || jobber} onClick={() => void send()}>
              {jobber
                ? "Registrerer…"
                : !signatur
                  ? "Mangler signatur"
                  : !signertAv.trim()
                    ? "Mangler navn på den som signerte"
                    : `Registrer tillegg · ${kroner.format(sum)}`}
            </Knapp>
          </div>
        </>
      )}
    </>
  );
}

const teller: React.CSSProperties = {
  width: 46,
  height: 42,
  borderRadius: 10,
  border: "1px solid var(--linje)",
  background: "var(--kort-2)",
  fontSize: 19,
  fontWeight: 700,
  color: "var(--tekst)",
  flex: "none",
};
