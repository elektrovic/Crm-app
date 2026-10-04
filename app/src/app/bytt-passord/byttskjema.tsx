"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Feilmelding, feltstil, knappstil } from "@/components/crm-handling";
import { MINSTE_LENGDE } from "@/lib/passord";

/**
 * Skjemaet som bytter passordet.
 *
 * Det nye passordet skrives én gang, ikke to. Gjentakelsesfeltet finnes
 * for å fange skrivefeil, men det fanger dem ved å la folk lime inn det
 * samme to ganger — og på telefon gjør alle det. «Vis passord» løser det
 * samme problemet og er lettere å bruke.
 */
export function Byttskjema({ maa }: { maa: boolean }) {
  const router = useRouter();
  const [gammelt, settGammelt] = useState("");
  const [nytt, settNytt] = useState("");
  const [vis, settVis] = useState(false);
  const [jobber, settJobber] = useState(false);
  const [feil, settFeil] = useState<string | null>(null);
  const [ferdig, settFerdig] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    settJobber(true);
    settFeil(null);
    try {
      const svar = await fetch("/api/bytt-passord", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gammelt, nytt }),
      });
      if (!svar.ok) {
        const data = await svar.json().catch(() => null);
        settFeil(data?.detaljer?.[0]?.message ?? data?.feil ?? "Noe gikk galt.");
        return;
      }
      settFerdig(true);
      // Ny innlogging etterpå, ikke bare en omlasting.
      //
      // Økten er et signert token med «må bytte passord» bakt inn. Å endre
      // raden i basen gjør ikke tokenet nyere, så en omlasting sendte
      // brukeren rett tilbake hit — i ring. Dette er dessuten den vanlige
      // framgangsmåten etter et passordbytte: man logger inn på nytt, og
      // får samtidig bekreftet at det nye passordet virker.
      // redirect: false, og så en full omlasting.
      //
      // signOut() med redirectTo navigerer på klientsiden, og da blir den
      // gamle sida liggende i rutermellomlageret — brukeren fikk et glimt
      // av «Velg ditt eget passord» etter å ha logget inn på nytt. En hard
      // omlasting tømmer det.
      await signOut({ redirect: false });
      window.location.href = "/logg-inn?byttet=1";
    } catch {
      settFeil("Fikk ikke kontakt med serveren.");
    } finally {
      settJobber(false);
    }
  }

  const forKort = nytt.length > 0 && nytt.length < MINSTE_LENGDE;

  return (
    <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dempet)" }}>
          {maa ? "Passordet du fikk" : "Nåværende passord"}
        </span>
        <input
          type={vis ? "text" : "password"}
          value={gammelt}
          onChange={(e) => settGammelt(e.target.value)}
          required
          autoComplete="current-password"
          autoFocus
          style={{ ...feltstil, height: 46, fontSize: 15 }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dempet)" }}>
          Nytt passord
        </span>
        <input
          type={vis ? "text" : "password"}
          value={nytt}
          onChange={(e) => settNytt(e.target.value)}
          required
          minLength={MINSTE_LENGDE}
          autoComplete="new-password"
          style={{
            ...feltstil,
            height: 46,
            fontSize: 15,
            borderColor: forKort ? "var(--oransje)" : undefined,
          }}
        />
        <span style={{ fontSize: 11.5, color: forKort ? "var(--oransje)" : "var(--svak)" }}>
          {forKort
            ? `${MINSTE_LENGDE - nytt.length} tegn til`
            : `Minst ${MINSTE_LENGDE} tegn`}
        </span>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={vis}
          onChange={(e) => settVis(e.target.checked)}
          style={{ width: 17, height: 17, cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, color: "var(--dempet)" }}>Vis passordene</span>
      </label>

      <Feilmelding tekst={feil} />

      <button
        type="submit"
        disabled={jobber || ferdig}
        style={{ ...knappstil, height: 48, fontSize: 15 }}
      >
        {ferdig ? "Lagret — sender deg videre…" : jobber ? "Lagrer…" : "Lagre nytt passord"}
      </button>

      {!maa && (
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            color: "var(--svak)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Avbryt
        </button>
      )}
    </form>
  );
}
