"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Felt,
  Feilmelding,
  Utfoldbart,
  feltstil,
  knappstil,
  useHandling,
} from "@/components/crm-handling";
import { AVDELINGER, ROLLER, type Avdeling, type Rolle } from "@/db/schema";
import { ROLLEFORKLARING, ROLLENAVN } from "@/lib/roller";

/**
 * Det midlertidige passordet, vist én gang.
 *
 * Det kan ikke hentes fram igjen — vi lagrer bare hashen. Derfor står det
 * stort, i et skriftsnitt der null og O ikke ligner på hverandre, med en
 * kopierknapp. Det skal kunne leses opp over telefon til en som står i en
 * kjeller, uten at noen må gjette på tegnene.
 */
function Passordvisning({ navn, passord }: { navn: string; passord: string }) {
  const [kopiert, settKopiert] = useState(false);

  return (
    <div
      style={{
        marginTop: 12,
        padding: "15px 16px",
        borderRadius: 13,
        border: "1px solid var(--gronn)",
        background: "var(--gronn-bg, var(--flate))",
      }}
    >
      <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "var(--tekst)" }}>
        Midlertidig passord for {navn}
      </p>
      <p style={{ margin: "3px 0 10px", fontSize: 12, color: "var(--dempet)" }}>
        Gi det videre nå. Det vises ikke igjen, og må byttes ved første innlogging.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 21,
            fontWeight: 700,
            letterSpacing: "0.06em",
            userSelect: "all",
          }}
        >
          {passord}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(passord).then(() => settKopiert(true));
          }}
          style={{
            height: 34,
            padding: "0 13px",
            borderRadius: 9,
            border: "1px solid var(--linje)",
            background: "var(--kort)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {kopiert ? "Kopiert" : "Kopier"}
        </button>
      </div>
    </div>
  );
}

/** Ny bruker. Passordet lages av systemet — ingen velger «Sommer2026». */
export function NyBruker() {
  const router = useRouter();
  const [apen, settApen] = useState(false);
  const [navn, settNavn] = useState("");
  const [epost, settEpost] = useState("");
  const [rolle, settRolle] = useState<Rolle>("montor");
  const [avdeling, settAvdeling] = useState<Avdeling>(AVDELINGER[0]);
  const [laget, settLaget] = useState<{ navn: string; passord: string } | null>(null);
  const [jobber, settJobber] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    settJobber(true);
    settFeil(null);
    try {
      const svar = await fetch("/api/brukere", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ navn, epost, rolle, avdeling }),
      });
      const data = await svar.json().catch(() => null);
      if (!svar.ok) {
        settFeil(data?.detaljer?.[0]?.message ?? data?.feil ?? "Noe gikk galt.");
        return;
      }
      settLaget({ navn, passord: data.passord });
      settNavn("");
      settEpost("");
      // router.refresh(), ikke location.reload().
      //
      // Første utgave lastet sida på nytt for å få den nye raden inn i
      // tabellen. Den tok med seg passordet i fallet — det vises én gang
      // og kan ikke hentes fram igjen, så lederen satt igjen med en
      // bruker ingen kunne logge inn som. refresh() henter serverdelen
      // på nytt og lar tilstanden i skjemaet stå.
      router.refresh();
    } catch {
      settFeil("Fikk ikke kontakt med serveren.");
    } finally {
      settJobber(false);
    }
  }

  return (
    <Utfoldbart knappetekst="+ Ny bruker" tittel="Ny bruker" apen={apen} settApen={settApen}>
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Navn" bredde="1 1 200px">
            <input
              value={navn}
              onChange={(e) => settNavn(e.target.value)}
              required
              maxLength={120}
              placeholder="Tore Eriksen"
              style={feltstil}
            />
          </Felt>
          <Felt merke="E-post (brukernavnet)" bredde="1 1 230px">
            <input
              type="email"
              value={epost}
              onChange={(e) => settEpost(e.target.value)}
              required
              maxLength={200}
              autoCapitalize="off"
              placeholder="tore@hallandgruppen.no"
              style={feltstil}
            />
          </Felt>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Rolle">
            <select
              value={rolle}
              onChange={(e) => settRolle(e.target.value as Rolle)}
              style={feltstil}
            >
              {ROLLER.map((r) => (
                <option key={r} value={r}>
                  {ROLLENAVN[r]}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Avdeling">
            <select
              value={avdeling}
              onChange={(e) => settAvdeling(e.target.value as Avdeling)}
              style={feltstil}
            >
              {AVDELINGER.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Felt>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: "var(--svak)", lineHeight: 1.5 }}>
          {ROLLEFORKLARING[rolle]}.
        </p>

        <Feilmelding tekst={feil} />

        <button type="submit" disabled={jobber} style={{ ...knappstil, alignSelf: "flex-start" }}>
          {jobber ? "Oppretter…" : "Opprett bruker"}
        </button>
      </form>

      {laget && <Passordvisning navn={laget.navn} passord={laget.passord} />}
    </Utfoldbart>
  );
}

/** Rolle, avdeling, nytt passord og sperring — rett i raden. */
export function Brukerrad({
  id,
  navn,
  rolle,
  avdeling,
  aktiv,
  erMeg,
}: {
  id: string;
  navn: string;
  rolle: Rolle;
  avdeling: Avdeling;
  aktiv: boolean;
  erMeg: boolean;
}) {
  const { kjor, jobber, feil } = useHandling();
  const [passord, settPassord] = useState<string | null>(null);
  const [egenFeil, settEgenFeil] = useState<string | null>(null);

  async function nyttPassord() {
    settEgenFeil(null);
    const svar = await fetch("/api/brukere", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, nyttPassord: true }),
    });
    const data = await svar.json().catch(() => null);
    if (!svar.ok) {
      settEgenFeil(data?.feil ?? "Gikk ikke.");
      return;
    }
    settPassord(data.passord);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={rolle}
          disabled={jobber || !aktiv}
          aria-label={`Rolle for ${navn}`}
          onChange={(e) => kjor("/api/brukere", "PATCH", { id, rolle: e.target.value })}
          style={{ ...feltstil, height: 34, fontSize: 12.5, width: "auto", minWidth: 130 }}
        >
          {ROLLER.map((r) => (
            <option key={r} value={r}>
              {ROLLENAVN[r]}
            </option>
          ))}
        </select>

        <select
          value={avdeling}
          disabled={jobber || !aktiv}
          aria-label={`Avdeling for ${navn}`}
          onChange={(e) => kjor("/api/brukere", "PATCH", { id, avdeling: e.target.value })}
          style={{ ...feltstil, height: 34, fontSize: 12.5, width: "auto", minWidth: 150 }}
        >
          {AVDELINGER.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={nyttPassord}
          disabled={jobber}
          style={{
            height: 34,
            padding: "0 12px",
            borderRadius: 9,
            border: "1px solid var(--linje)",
            background: "var(--kort)",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Nytt passord
        </button>

        {/* Seg selv kan man ikke sperre ute. Serveren nekter uansett, men
            en knapp som alltid feiler er en knapp som ikke skal stå der. */}
        {!erMeg && (
          <button
            type="button"
            disabled={jobber}
            onClick={() => kjor("/api/brukere", "PATCH", { id, aktiv: !aktiv })}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 9,
              border: "1px solid var(--linje)",
              background: "var(--kort)",
              color: aktiv ? "var(--rod-tekst)" : "var(--gronn)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {aktiv ? "Sperr" : "Åpne igjen"}
          </button>
        )}
      </div>

      {passord && <Passordvisning navn={navn} passord={passord} />}
      <Feilmelding tekst={feil ?? egenFeil} />
    </div>
  );
}
