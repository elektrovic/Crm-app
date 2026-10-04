"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Feilmelding, Felt, feltstil, knappstil, useHandling } from "@/components/crm-handling";
import { Etikett, Kort, Tomt } from "@/components/ui";
import { utenNummer } from "@/lib/prosjektnavn";
import type { Prosjektkort as Kortdata } from "@/lib/data/prosjekter";

type Montor = { id: string; navn: string; avdeling: string };

const sekundar = {
  ...knappstil,
  background: "transparent",
  color: "var(--dempet)",
  border: "1px solid var(--linje)",
} as const;

/**
 * Prosjektene som jobbkort.
 *
 * Søket er grunnen til at dette er et klientkomponent. Med 49 prosjekter
 * fra Tripletex — og flere i vente — er en liste uten søk en liste ingen
 * bruker. Det filtreres på nummer, navn, kunde og adresse, fordi det er
 * ulikt hva man husker: noen leter etter «20543», andre etter «Solheim».
 */
export function Prosjektkort({
  kort,
  montorer,
  avdelinger,
  idag,
  kanEndreAvdeling,
}: {
  kort: Kortdata[];
  montorer: Montor[];
  avdelinger: readonly string[];
  idag: string;
  kanEndreAvdeling: boolean;
}) {
  const [sok, setSok] = useState("");
  const [avdeling, setAvdeling] = useState("alle");

  const treff = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return kort.filter((p) => {
      if (avdeling !== "alle" && p.avdeling !== avdeling) return false;
      if (!q) return true;
      return [p.nummer, p.navn, p.kunde, p.adresse]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
  }, [kort, sok, avdeling]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <input
          value={sok}
          onChange={(e) => setSok(e.currentTarget.value)}
          placeholder="Søk på nummer, navn, kunde eller adresse"
          style={{ ...feltstil, flex: "1 1 260px" }}
        />
        <select
          value={avdeling}
          onChange={(e) => setAvdeling(e.currentTarget.value)}
          style={{ ...feltstil, flex: "0 1 190px" }}
        >
          <option value="alle">Alle avdelinger</option>
          {avdelinger.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <Etikett>
        {treff.length === kort.length
          ? `${kort.length} åpne prosjekter`
          : `${treff.length} av ${kort.length}`}
      </Etikett>

      {treff.length === 0 ? (
        <Tomt tekst="Ingen prosjekter passer søket." />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 12,
          }}
        >
          {treff.map((p) => (
            <Jobbkortet
              key={p.id}
              p={p}
              montorer={montorer}
              avdelinger={avdelinger}
              idag={idag}
              kanEndreAvdeling={kanEndreAvdeling}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Jobbkortet({
  p,
  montorer,
  avdelinger,
  idag,
  kanEndreAvdeling,
}: {
  p: Kortdata;
  montorer: Montor[];
  avdelinger: readonly string[];
  idag: string;
  kanEndreAvdeling: boolean;
}) {
  const { kjor, jobber, feil } = useHandling();
  const [apen, setApen] = useState(false);

  return (
    <Kort style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--svak)",
            letterSpacing: ".06em",
          }}
        >
          {p.nummer}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>
          {utenNummer(p.nummer, p.navn)}
        </div>
        {p.kunde && (
          <div style={{ fontSize: 12.5, color: "var(--dempet)" }}>{p.kunde}</div>
        )}
      </div>

      {p.adresse && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.adresse)}`}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12.5, color: "var(--bla)", textDecoration: "none" }}
        >
          {p.adresse}
        </a>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10.5 }}>
        <Merke tekst={p.avdeling} />
        {p.planlagt > 0 && <Merke tekst={`${p.planlagt} satt opp`} farge="var(--bla)" />}
        {p.mangler > 0 && <Merke tekst={`${p.mangler} mangler`} farge="var(--oransje)" />}
        {p.bilder > 0 && <Merke tekst={`${p.bilder} bilder`} />}
      </div>

      {kanEndreAvdeling && (
        <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 11, color: "var(--svak)" }}>Avdeling</span>
          <select
            defaultValue={p.avdeling}
            onChange={(e) =>
              void kjor("/api/prosjekt", "PATCH", {
                id: p.id,
                avdeling: e.currentTarget.value,
              })
            }
            style={{ ...feltstil, height: 32, fontSize: 12.5, flex: 1 }}
          >
            {avdelinger.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      )}

      {apen ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await kjor("/api/kalender/tildeling", "POST", {
              prosjektId: p.id,
              ansattId: f.get("ansattId"),
              dato: f.get("dato"),
              tilDato: String(f.get("tilDato") ?? "") || null,
              fraKl: String(f.get("fraKl") ?? "") || null,
              tilKl: String(f.get("tilKl") ?? "") || null,
              notat: String(f.get("notat") ?? "") || null,
            });
            if (ok) setApen(false);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 9,
            borderTop: "1px solid var(--linje)",
            paddingTop: 10,
          }}
        >
          <Felt merke="Montør">
            <select name="ansattId" required style={feltstil}>
              {montorer.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.navn}
                </option>
              ))}
            </select>
          </Felt>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Felt merke="Dato">
              <input type="date" name="dato" required defaultValue={idag} style={feltstil} />
            </Felt>
            <Felt merke="Til og med">
              <input type="date" name="tilDato" style={feltstil} />
            </Felt>
            <Felt merke="Fra kl.">
              <input type="time" name="fraKl" style={feltstil} />
            </Felt>
            <Felt merke="Til kl.">
              <input type="time" name="tilKl" style={feltstil} />
            </Felt>
          </div>
          <Felt merke="Beskjed">
            <textarea
              name="notat"
              rows={2}
              style={{ ...feltstil, height: "auto", padding: "8px 11px", resize: "vertical" }}
            />
          </Felt>

          <Feilmelding tekst={feil} />

          <div style={{ display: "flex", gap: 7 }}>
            <button type="submit" disabled={jobber} style={knappstil}>
              {jobber ? "Setter opp…" : "Sett opp"}
            </button>
            <button type="button" onClick={() => setApen(false)} style={sekundar}>
              Avbryt
            </button>
          </div>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setApen(true)} style={knappstil}>
            Sett i kalenderen
          </button>
          <Link
            href={`/prosjekt/${p.nummer}`}
            style={{ fontSize: 12.5, color: "var(--bla)", textDecoration: "none" }}
          >
            Åpne ›
          </Link>
          <Feilmelding tekst={feil} />
        </div>
      )}
    </Kort>
  );
}

function Merke({ tekst, farge = "var(--svak)" }: { tekst: string; farge?: string }) {
  return (
    <span
      style={{
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid var(--linje)`,
        color: farge,
        fontFamily: "var(--font-mono)",
        letterSpacing: ".04em",
        whiteSpace: "nowrap",
      }}
    >
      {tekst}
    </span>
  );
}
