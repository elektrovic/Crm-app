"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Etikett, Knapp, Kort, Pille, Sidetittel } from "@/components/ui";
import { lagKlientNokkel } from "@/lib/offline/ko";
import { lyttEtterTale, taleStottes, type TaleLytter } from "@/lib/tale";

export type Linje = {
  id: string;
  tekst: string;
  antall: string | null;
  efoNummer: string | null;
  enhet: string;
  taltInn: boolean;
  bestilt: boolean;
  lagtInnAvNavn: string;
  opprettet: string;
};

/**
 * Mangler på prosjektet.
 *
 * Lista ligger på prosjektet, ikke hos den enkelte — den som er der neste
 * gang ser hva som mangler, uten å måtte spørre.
 *
 * Dikteringen bruker nettleserens egen taledgjenkjenning der den finnes.
 * Gjør den ikke det, skjules mikrofonknappen — tastaturet har uansett
 * diktering på både iOS og Android, så montøren kan snakke inn linja der.
 */
export function ManglerSkjerm({
  prosjektId,
  prosjektNummer,
  prosjektNavn,
  linjer,
  kanSendeBestilling,
}: {
  prosjektId: string;
  prosjektNummer: string;
  prosjektNavn: string;
  linjer: Linje[];
  kanSendeBestilling: boolean;
}) {
  const router = useRouter();
  const [tekst, setTekst] = useState("");
  const [antall, setAntall] = useState("");
  const [efoNummer, setEfoNummer] = useState("");
  const [lytter, setLytter] = useState(false);
  const [taltInn, setTaltInn] = useState(false);
  const [jobber, setJobber] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [kvittering, setKvittering] = useState<string | null>(null);
  const [harTale, setHarTale] = useState(false);

  const lytter_ref = useRef<TaleLytter | null>(null);

  useEffect(() => {
    setHarTale(taleStottes());
    return () => lytter_ref.current?.avbryt();
  }, []);

  const apne = linjer.filter((l) => !l.bestilt);

  function startDiktering() {
    const lytterInstans = lyttEtterTale({
      onTekst: (ord) => {
        setTekst((t) => (t ? `${t} ${ord}` : ord));
        setTaltInn(true);
      },
      onFeil: () => {
        setFeil("Fikk ikke tak i mikrofonen. Skriv linja i stedet.");
        setLytter(false);
      },
      onSlutt: () => setLytter(false),
    });
    if (!lytterInstans) return;

    lytter_ref.current = lytterInstans;
    setFeil(null);
    setLytter(true);
    lytterInstans.start();
  }

  async function leggTil() {
    const rensket = tekst.trim();
    if (!rensket) return;

    setJobber(true);
    setFeil(null);
    try {
      const svar = await fetch("/api/mangler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klientNokkel: lagKlientNokkel(),
          prosjektId,
          tekst: rensket,
          antall: antall.trim() || null,
          efoNummer: efoNummer.trim() || null,
          taltInn,
        }),
      });
      if (!svar.ok) {
        const k = (await svar.json().catch(() => ({}))) as { feil?: string };
        setFeil(k.feil ?? "Fikk ikke lagt til linja.");
        return;
      }
      setTekst("");
      setAntall("");
      setEfoNummer("");
      setTaltInn(false);
      router.refresh();
    } catch {
      setFeil("Ingen forbindelse. Prøv igjen når du har dekning.");
    } finally {
      setJobber(false);
    }
  }

  async function kryssAv(id: string, bestilt: boolean) {
    try {
      await fetch("/api/mangler", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, bestilt }),
      });
      router.refresh();
    } catch {
      setFeil("Fikk ikke lagret avkryssingen.");
    }
  }

  async function sendBestilling() {
    setJobber(true);
    setFeil(null);
    setKvittering(null);
    try {
      const svar = await fetch("/api/mangler/bestill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prosjektId }),
      });
      const k = (await svar.json().catch(() => ({}))) as {
        feil?: string;
        antall?: number;
        bestillingsnummer?: string;
        utenVarenummer?: number;
      };

      if (!svar.ok) {
        setFeil(k.feil ?? "Fikk ikke sendt lista.");
        return;
      }

      const uten =
        k.utenVarenummer && k.utenVarenummer > 0
          ? ` ${k.utenVarenummer} ${k.utenVarenummer === 1 ? "linje" : "linjer"} mangler varenummer og må slås opp hos grossisten.`
          : "";

      setKvittering(
        `Bestilling ${k.bestillingsnummer} er sendt — ${k.antall} ${
          k.antall === 1 ? "vare" : "varer"
        } merket med prosjekt ${prosjektNummer}.${uten}`,
      );
      router.refresh();
    } catch {
      setFeil("Ingen forbindelse. Prøv igjen når du har dekning.");
    } finally {
      setJobber(false);
    }
  }

  return (
    <>
      <Sidetittel
        tittel="Mangler"
        under={`${prosjektNummer} · ${prosjektNavn}`}
      />

      <Kort>
        <Etikett>Legg til vare</Etikett>
        <div style={{ display: "flex", gap: 8, marginTop: 11 }}>
          <input
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder="Hva mangler?"
            style={{
              flex: 1,
              minWidth: 0,
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid var(--linje)",
              fontSize: 16,
              fontFamily: "var(--font)",
            }}
          />
          {harTale && (
            <button
              type="button"
              onClick={startDiktering}
              disabled={lytter}
              aria-label="Snakk inn vare"
              className={lytter ? "puls" : undefined}
              style={{
                width: 46,
                borderRadius: 10,
                border: "1px solid var(--linje)",
                background: lytter ? "var(--rod-bg)" : "var(--kort-2)",
                color: lytter ? "var(--rod-tekst)" : "var(--tekst)",
                fontSize: 17,
                flex: "none",
              }}
            >
              ●
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
          <input
            value={antall}
            onChange={(e) => setAntall(e.target.value)}
            placeholder="Antall"
            aria-label="Antall"
            style={{
              width: 92,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--linje)",
              fontSize: 15,
              fontFamily: "var(--font)",
            }}
          />
          <input
            value={efoNummer}
            onChange={(e) => setEfoNummer(e.target.value)}
            placeholder="EFO-nr"
            aria-label="EFO-nummer"
            inputMode="numeric"
            style={{
              width: 110,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--linje)",
              fontSize: 15,
              fontFamily: "var(--font-mono)",
            }}
          />
          <Knapp onClick={() => void leggTil()} disabled={jobber || !tekst.trim()}>
            Legg til
          </Knapp>
        </div>

        <p style={{ margin: "9px 0 0", fontSize: 11.5, color: "var(--svak)", lineHeight: 1.5 }}>
          Har du EFO-nummeret fra esken, blir bestillingen entydig og
          grossisten slipper å slå opp varen.
        </p>

        {lytter && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--rod-tekst)" }}>
            Hører etter… snakk nå.
          </p>
        )}
        {taltInn && !lytter && tekst && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--dempet)" }}>
            Talt inn. Sjekk at det ble riktig før du legger til.
          </p>
        )}
      </Kort>

      {feil && (
        <Kort style={{ background: "var(--rod-bg)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--rod-tekst)", fontWeight: 600 }}>
            {feil}
          </p>
        </Kort>
      )}

      {kvittering && (
        <Kort style={{ background: "var(--gronn-bg)", boxShadow: "none" }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--gronn-tekst)", fontWeight: 600 }}>
            {kvittering}
          </p>
        </Kort>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0 4px",
          }}
        >
          <Etikett>På lista</Etikett>
          <span style={{ fontSize: 12, color: "var(--svak)" }}>
            {apne.length} å hente
          </span>
        </div>

        {linjer.length === 0 && (
          <Kort>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--dempet)" }}>
              Ingenting registrert. Legger du inn det som mangler nå, står det
              her neste gang noen skal inn på jobben.
            </p>
          </Kort>
        )}

        {linjer.map((l) => (
          <Kort key={l.id} style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
              <input
                type="checkbox"
                checked={l.bestilt}
                onChange={(e) => void kryssAv(l.id, e.target.checked)}
                aria-label={`Marker ${l.tekst} som bestilt`}
                style={{ width: 20, height: 20, marginTop: 1, flex: "none", accentColor: "#2563EB" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: l.bestilt ? "var(--svak)" : "var(--tekst)",
                    textDecoration: l.bestilt ? "line-through" : "none",
                  }}
                >
                  {l.antall ? `${l.antall} ` : ""}
                  {l.tekst}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--svak)", marginTop: 2 }}>
                  {l.efoNummer && (
                    <span style={{ fontFamily: "var(--font-mono)" }}>EFO {l.efoNummer} · </span>
                  )}
                  {l.lagtInnAvNavn} ·{" "}
                  {new Intl.DateTimeFormat("nb-NO", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(l.opprettet))}
                </div>
              </div>
              {l.taltInn && <Pille farge="noytral">Talt inn</Pille>}
            </div>
          </Kort>
        ))}
      </div>

      {kanSendeBestilling ? (
        <Knapp
          bred
          variant="mork"
          disabled={jobber || apne.length === 0}
          onClick={() => void sendBestilling()}
        >
          {apne.length === 0
            ? "Ingenting å bestille på dette prosjektet"
            : `Send lista til daglig leder · ${apne.length} ${apne.length === 1 ? "vare" : "varer"}`}
        </Knapp>
      ) : (
        <p style={{ margin: "0 4px", fontSize: 12.5, color: "var(--svak)", lineHeight: 1.55 }}>
          Sending til daglig leder er ikke satt opp ennå. Lista ligger trygt på
          prosjektet i mellomtiden.
        </p>
      )}
    </>
  );
}
