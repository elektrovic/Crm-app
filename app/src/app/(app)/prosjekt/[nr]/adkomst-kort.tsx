"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Etikett, Knapp, Kort, RadVerdi } from "@/components/ui";

type Adkomst = {
  nokkelkode: string | null;
  kontaktperson: string | null;
  kontakttelefon: string | null;
  parkering: string | null;
  merknad: string | null;
  oppdatertAvNavn: string | null;
  oppdatert: Date | null;
};

/**
 * Nøkkelkode, kontaktperson og parkering.
 *
 * Oppdateres av den som var der sist. Derfor står «Sist oppdatert av»
 * nederst — den som leser skal vite hvor ferskt det er, og hvem han kan
 * spørre hvis koden ikke virker.
 */
export function AdkomstKort({
  prosjektId,
  adkomst,
}: {
  prosjektId: string;
  adkomst: Adkomst | null;
}) {
  const router = useRouter();
  const [redigerer, setRedigerer] = useState(false);
  const [lagrer, setLagrer] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const [felt, setFelt] = useState({
    nokkelkode: adkomst?.nokkelkode ?? "",
    kontaktperson: adkomst?.kontaktperson ?? "",
    kontakttelefon: adkomst?.kontakttelefon ?? "",
    parkering: adkomst?.parkering ?? "",
    merknad: adkomst?.merknad ?? "",
  });

  const harNoe =
    adkomst &&
    (adkomst.nokkelkode || adkomst.kontaktperson || adkomst.parkering || adkomst.merknad);

  async function lagre() {
    setLagrer(true);
    setFeil(null);
    try {
      const svar = await fetch("/api/adkomst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prosjektId, ...felt }),
      });
      if (!svar.ok) {
        const k = (await svar.json().catch(() => ({}))) as { feil?: string };
        setFeil(k.feil ?? "Fikk ikke lagret. Prøv igjen.");
        return;
      }
      setRedigerer(false);
      router.refresh();
    } catch {
      setFeil("Ingen forbindelse. Adkomstinfo krever nett — prøv igjen når du har dekning.");
    } finally {
      setLagrer(false);
    }
  }

  if (redigerer) {
    return (
      <Kort>
        <Etikett>Adkomst</Etikett>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {(
            [
              ["nokkelkode", "Nøkkelkode", "F.eks. 1975*"],
              ["kontaktperson", "Kontaktperson", "Navn og rolle"],
              ["kontakttelefon", "Telefon", "922 41 088"],
              ["parkering", "Parkering", "Hvor setter man bilen?"],
              ["merknad", "Merknad", "Noe den neste bør vite"],
            ] as const
          ).map(([navn, ledetekst, hint]) => (
            <label key={navn} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "var(--dempet)", fontWeight: 600 }}>
                {ledetekst}
              </span>
              <input
                value={felt[navn]}
                onChange={(e) => setFelt((f) => ({ ...f, [navn]: e.target.value }))}
                placeholder={hint}
                inputMode={navn === "kontakttelefon" ? "tel" : undefined}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--linje)",
                  fontSize: 16,
                  fontFamily: "var(--font)",
                  color: "var(--tekst)",
                }}
              />
            </label>
          ))}
        </div>

        {feil && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--rod-tekst)" }}>{feil}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Knapp onClick={() => void lagre()} disabled={lagrer}>
            {lagrer ? "Lagrer…" : "Lagre"}
          </Knapp>
          <Knapp variant="sekundar" onClick={() => setRedigerer(false)} disabled={lagrer}>
            Avbryt
          </Knapp>
        </div>
      </Kort>
    );
  }

  return (
    <Kort>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Etikett>Adkomst</Etikett>
        <button
          onClick={() => setRedigerer(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--bla)",
          }}
        >
          {harNoe ? "Oppdater" : "Legg inn"}
        </button>
      </div>

      {!harNoe ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--dempet)", lineHeight: 1.55 }}>
          Ingen adkomstinfo lagt inn ennå. Legger du inn nøkkelkode og
          kontaktperson nå, slipper den neste å ringe rundt.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
            {adkomst.nokkelkode && (
              <RadVerdi
                k="Nøkkelkode"
                v={<span style={{ fontFamily: "var(--font-mono)" }}>{adkomst.nokkelkode}</span>}
              />
            )}
            {adkomst.kontaktperson && (
              <RadVerdi
                k="Kontakt"
                v={
                  adkomst.kontakttelefon ? (
                    <a href={`tel:${adkomst.kontakttelefon.replace(/\s/g, "")}`}>
                      {adkomst.kontaktperson} · {adkomst.kontakttelefon}
                    </a>
                  ) : (
                    adkomst.kontaktperson
                  )
                }
              />
            )}
            {adkomst.parkering && <RadVerdi k="Parkering" v={adkomst.parkering} />}
            {adkomst.merknad && <RadVerdi k="Merknad" v={adkomst.merknad} />}
          </div>

          {adkomst.oppdatertAvNavn && adkomst.oppdatert && (
            <p
              style={{
                margin: "12px 0 0",
                paddingTop: 10,
                borderTop: "1px solid var(--linje-svak)",
                fontSize: 11.5,
                color: "var(--svak)",
              }}
            >
              Sist oppdatert av {adkomst.oppdatertAvNavn}{" "}
              {new Intl.DateTimeFormat("nb-NO", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(adkomst.oppdatert))}
            </p>
          )}
        </>
      )}
    </Kort>
  );
}
