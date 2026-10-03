"use client";

import { useState } from "react";
import {
  Felt,
  Feilmelding,
  Utfoldbart,
  feltstil,
  knappstil,
  useHandling,
} from "@/components/crm-handling";

export type Ansattvalg = { id: string; navn: string };

/**
 * Avkryssing og fordeling, rett i raden.
 *
 * Begge deler skjer dusinvis av ganger om dagen. Må man åpne en sak for å
 * krysse den av, blir den ikke krysset av.
 */
export function Oppfolgingsrad({
  id,
  fullfort,
  ansvarlig,
  ansatte,
}: {
  id: string;
  fullfort: boolean;
  ansvarlig: string | null;
  ansatte: Ansattvalg[];
}) {
  const { kjor, jobber, feil } = useHandling();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={fullfort}
          disabled={jobber}
          onChange={(e) =>
            kjor("/api/crm/oppfolginger", "PATCH", { id, fullfort: e.target.checked })
          }
          style={{ width: 17, height: 17, accentColor: "var(--gronn)", cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, color: "var(--dempet)" }}>
          {fullfort ? "Gjort" : "Marker gjort"}
        </span>
      </label>

      <select
        value={ansvarlig ?? ""}
        disabled={jobber}
        aria-label="Ansvarlig"
        onChange={(e) =>
          kjor("/api/crm/oppfolginger", "PATCH", { id, ansvarlig: e.target.value || null })
        }
        style={{ ...feltstil, height: 34, fontSize: 13, width: "auto", minWidth: 140 }}
      >
        <option value="">Ufordelt</option>
        {ansatte.map((a) => (
          <option key={a.id} value={a.id}>
            {a.navn}
          </option>
        ))}
      </select>

      {feil && <Feilmelding tekst={feil} />}
    </div>
  );
}

export type Kundevalg = { id: string; navn: string };

/** Ny oppfølging. Frist og tekst er det eneste som må fylles ut. */
export function NyOppfolging({
  ansatte,
  kunder,
  iDag,
}: {
  ansatte: Ansattvalg[];
  kunder: Kundevalg[];
  iDag: string;
}) {
  const [apen, settApen] = useState(false);
  const [hva, settHva] = useState("");
  const [frist, settFrist] = useState(iDag);
  const [kundeId, settKundeId] = useState("");
  const [ansvarlig, settAnsvarlig] = useState("");
  const { kjor, jobber, feil } = useHandling();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const ok = await kjor("/api/crm/oppfolginger", "POST", {
      hva,
      frist,
      kundeId: kundeId || null,
      ansvarlig: ansvarlig || null,
    });
    if (ok) {
      settHva("");
      settKundeId("");
      settAnsvarlig("");
      settApen(false);
    }
  }

  return (
    <Utfoldbart
      knappetekst="+ Ny oppfølging"
      tittel="Ny oppfølging"
      apen={apen}
      settApen={settApen}
    >
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Hva skal gjøres" bredde="2 1 260px">
            <input
              value={hva}
              onChange={(e) => settHva(e.target.value)}
              required
              maxLength={300}
              placeholder="Ring om impregnering av tak"
              style={feltstil}
            />
          </Felt>
          <Felt merke="Frist" bredde="0 0 150px">
            <input
              type="date"
              value={frist}
              onChange={(e) => settFrist(e.target.value)}
              required
              style={feltstil}
            />
          </Felt>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Kunde">
            <select
              value={kundeId}
              onChange={(e) => settKundeId(e.target.value)}
              style={feltstil}
            >
              <option value="">Ingen</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Ansvarlig">
            <select
              value={ansvarlig}
              onChange={(e) => settAnsvarlig(e.target.value)}
              style={feltstil}
            >
              <option value="">Ufordelt</option>
              {ansatte.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.navn}
                </option>
              ))}
            </select>
          </Felt>
        </div>

        <Feilmelding tekst={feil} />

        <button type="submit" disabled={jobber} style={{ ...knappstil, alignSelf: "flex-start" }}>
          {jobber ? "Lagrer…" : "Legg til"}
        </button>
      </form>
    </Utfoldbart>
  );
}
