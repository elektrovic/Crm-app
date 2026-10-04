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
import {
  AVDELINGER,
  KANAL,
  KUNDESTATUS,
  PIPELINE,
  REKLAMASJONSSTATUS,
  type Avdeling,
  type Kanal,
  type Kundestatus,
  type PipelineTrinn,
  type Reklamasjonsstatus,
} from "@/db/schema";

export type Valg = { id: string; navn: string };

const TRINNAVN: Record<PipelineTrinn, string> = {
  ny: "Ny",
  kontaktet: "Kontaktet",
  befaring_avtalt: "Befaring avtalt",
  tilbud_sendt: "Tilbud sendt",
  vunnet: "Vunnet",
  tapt: "Tapt",
};

const KANALNAVN: Record<Kanal, string> = {
  telefon: "Telefon",
  epost: "E-post",
  nettskjema: "Nettskjema",
  anbefaling: "Anbefaling",
};

const STATUSNAVN: Record<Kundestatus, string> = {
  prospekt: "Prospekt",
  kunde: "Kunde",
  tapt: "Tapt",
  inaktiv: "Inaktiv",
};

const REKSTATUS: Record<Reklamasjonsstatus, string> = {
  ny: "Ny",
  under_behandling: "Under behandling",
  venter_kunde: "Venter på kunde",
  lukket: "Lukket",
};

/* ───────────────────────── Henvendelser ───────────────────────── */

/** Flytt en henvendelse videre i pipelinen, rett fra kortet. */
/** Trinn der saken fortsatt lever, og altså trenger en frist. */
const AKTIVE_TRINN: PipelineTrinn[] = ["ny", "kontaktet", "befaring_avtalt", "tilbud_sendt"];

/** En uke fram. Nær nok til å være ekte, langt nok til å rekke noe. */
function omEnUke(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Trinnvelgeren, som også passer på at saken har et neste steg.
 *
 * Står saken i et trinn der den fortsatt lever, og ingen har satt en frist,
 * spør den om en. Det er forskjellen på å oppdage glemte saker og å ikke få
 * lov til å glemme dem — den første lista må ryddes, den andre holder seg
 * kort av seg selv.
 *
 * Spørsmålet utledes av dataene, ikke av at du nettopp klikket. Første
 * forsøk satte en tilstand etter trinnbyttet, men `kjor()` oppdaterer sida,
 * komponenten bygges på nytt, og tilstanden var borte før den rakk å vises.
 * Nå står spørsmålet der så lenge saken mangler et neste steg — også når du
 * kommer tilbake i morgen.
 *
 * Du kan skjule det. Et system som nekter deg å gå videre blir omgått, og da
 * er man tilbake til notater på gule lapper.
 */
export function Trinnvelger({
  id,
  trinn,
  harNesteSteg,
  kundeId,
  hvem,
  prosjekter = [],
  prosjektId,
}: {
  id: string;
  trinn: PipelineTrinn;
  harNesteSteg: boolean;
  kundeId: string | null;
  /** Navnet som foreslås i oppfølgingsteksten. */
  hvem: string | null;
  /** Prosjektene saken kan ha blitt til. */
  prosjekter?: { id: string; nummer: string; navn: string }[];
  prosjektId: string | null;
}) {
  const { kjor, jobber, feil } = useHandling();
  const [skjult, setSkjult] = useState(false);

  // Vunnet uten prosjekt er et spor som stopper: man vet at jobben ble
  // solgt, men ikke hvilken jobb det ble.
  const trengerProsjekt = trinn === "vunnet" && !prosjektId && prosjekter.length > 0;
  const trengerFrist = !harNesteSteg && AKTIVE_TRINN.includes(trinn);

  const sporProsjekt = trengerProsjekt && !skjult;
  const spor = !trengerProsjekt && trengerFrist && !skjult;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        value={trinn}
        disabled={jobber}
        aria-label="Trinn"
        onChange={(e) =>
          void kjor("/api/crm/henvendelser", "PATCH", { id, trinn: e.target.value })
        }
        style={{ ...feltstil, height: 32, fontSize: 12.5 }}
      >
        {PIPELINE.map((t) => (
          <option key={t} value={t}>
            {TRINNAVN[t]}
          </option>
        ))}
      </select>

      {sporProsjekt && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await kjor("/api/crm/henvendelser", "PATCH", {
              id,
              prosjektId: f.get("prosjektId"),
            });
            if (!ok) return;
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 9,
            borderRadius: 10,
            background: "var(--flate)",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>Hvilket prosjekt ble det?</span>
          <select name="prosjektId" required style={{ ...feltstil, height: 32, fontSize: 12.5 }}>
            {prosjekter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nummer} {p.navn}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="submit"
              disabled={jobber}
              style={{ ...knappstil, height: 30, padding: "0 11px", fontSize: 12 }}
            >
              Koble
            </button>
            <button
              type="button"
              onClick={() => setSkjult(true)}
              style={{
                ...knappstil,
                height: 30,
                padding: "0 11px",
                fontSize: 12,
                background: "transparent",
                color: "var(--dempet)",
                border: "1px solid var(--linje)",
              }}
            >
              Senere
            </button>
          </div>
        </form>
      )}

      {spor && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await kjor("/api/crm/oppfolginger", "POST", {
              hva: f.get("hva"),
              frist: f.get("frist"),
              henvendelseId: id,
              kundeId,
            });
            if (!ok) return;
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            padding: 9,
            borderRadius: 10,
            background: "var(--flate)",
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>Når følger du opp?</span>
          <input
            name="hva"
            required
            maxLength={300}
            defaultValue={hvem ? `Følg opp ${hvem}` : "Følg opp saken"}
            style={{ ...feltstil, height: 32, fontSize: 12.5 }}
          />
          <input
            type="date"
            name="frist"
            required
            defaultValue={omEnUke()}
            style={{ ...feltstil, height: 32, fontSize: 12.5 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="submit"
              disabled={jobber}
              style={{ ...knappstil, height: 30, padding: "0 11px", fontSize: 12 }}
            >
              Sett frist
            </button>
            <button
              type="button"
              onClick={() => setSkjult(true)}
              style={{
                ...knappstil,
                height: 30,
                padding: "0 11px",
                fontSize: 12,
                background: "transparent",
                color: "var(--dempet)",
                border: "1px solid var(--linje)",
              }}
            >
              Senere
            </button>
          </div>
        </form>
      )}

      <Feilmelding tekst={feil} />
    </div>
  );
}

export function NyHenvendelse({ kunder }: { kunder: Valg[] }) {
  const [apen, settApen] = useState(false);
  const [kanal, settKanal] = useState<Kanal>("telefon");
  const [innhold, settInnhold] = useState("");
  const [navn, settNavn] = useState("");
  const [telefon, settTelefon] = useState("");
  const [epost, settEpost] = useState("");
  const [kundeId, settKundeId] = useState("");
  const [avdeling, settAvdeling] = useState<Avdeling | "">("");
  const [sum, settSum] = useState("");
  const { kjor, jobber, feil } = useHandling();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const ok = await kjor("/api/crm/henvendelser", "POST", {
      kanal,
      innhold,
      avsenderNavn: navn || null,
      avsenderTelefon: telefon || null,
      avsenderEpost: epost || null,
      kundeId: kundeId || null,
      avdeling: avdeling || null,
      sum: sum ? Number(sum) : null,
    });
    if (ok) {
      settInnhold("");
      settNavn("");
      settTelefon("");
      settEpost("");
      settSum("");
      settApen(false);
    }
  }

  return (
    <Utfoldbart
      knappetekst="+ Ny henvendelse"
      tittel="Ny henvendelse"
      apen={apen}
      settApen={settApen}
    >
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Kanal" bredde="0 0 150px">
            <select
              value={kanal}
              onChange={(e) => settKanal(e.target.value as Kanal)}
              style={feltstil}
            >
              {KANAL.map((k) => (
                <option key={k} value={k}>
                  {KANALNAVN[k]}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Avsender">
            <input
              value={navn}
              onChange={(e) => settNavn(e.target.value)}
              placeholder="Anne Lie"
              style={feltstil}
            />
          </Felt>
          <Felt merke="Telefon" bredde="0 0 150px">
            <input
              value={telefon}
              onChange={(e) => settTelefon(e.target.value)}
              placeholder="915 22 340"
              style={feltstil}
            />
          </Felt>
        </div>

        <Felt merke="Hva gjelder det" bredde="1 1 100%">
          <textarea
            value={innhold}
            onChange={(e) => settInnhold(e.target.value)}
            required
            rows={3}
            maxLength={4000}
            placeholder="Sikringsskapet slår ut med jevne mellomrom."
            style={{ ...feltstil, height: "auto", padding: "10px 11px", lineHeight: 1.5 }}
          />
        </Felt>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Kunde">
            <select value={kundeId} onChange={(e) => settKundeId(e.target.value)} style={feltstil}>
              <option value="">Ingen</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Avdeling">
            <select
              value={avdeling}
              onChange={(e) => settAvdeling(e.target.value as Avdeling | "")}
              style={feltstil}
            >
              <option value="">Ikke satt</option>
              {AVDELINGER.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Sum eks. mva" bredde="0 0 150px">
            <input
              type="number"
              min="0"
              step="100"
              value={sum}
              onChange={(e) => settSum(e.target.value)}
              placeholder="42000"
              style={feltstil}
            />
          </Felt>
        </div>

        <Feilmelding tekst={feil} />

        <button type="submit" disabled={jobber} style={{ ...knappstil, alignSelf: "flex-start" }}>
          {jobber ? "Lagrer…" : "Registrer"}
        </button>
      </form>
    </Utfoldbart>
  );
}

/* ───────────────────────── Kunder ───────────────────────── */

export type Kundefelter = {
  id?: string;
  navn: string;
  type: string | null;
  orgnummer: string | null;
  kontaktperson: string | null;
  telefon: string | null;
  epost: string | null;
  adresse: string | null;
  avdeling: Avdeling | null;
  status: Kundestatus;
};

export function KundeSkjema({ kunde }: { kunde?: Kundefelter }) {
  const redigerer = Boolean(kunde?.id);
  const [apen, settApen] = useState(false);
  const [f, settF] = useState<Kundefelter>(
    kunde ?? {
      navn: "",
      type: "",
      orgnummer: "",
      kontaktperson: "",
      telefon: "",
      epost: "",
      adresse: "",
      avdeling: null,
      status: "prospekt",
    },
  );
  const { kjor, jobber, feil } = useHandling();

  function sett<K extends keyof Kundefelter>(felt: K, verdi: Kundefelter[K]) {
    settF((f) => ({ ...f, [felt]: verdi }));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const kropp = {
      ...(kunde?.id ? { id: kunde.id } : {}),
      navn: f.navn,
      type: f.type || null,
      orgnummer: f.orgnummer || null,
      kontaktperson: f.kontaktperson || null,
      telefon: f.telefon || null,
      epost: f.epost || null,
      adresse: f.adresse || null,
      avdeling: f.avdeling,
      status: f.status,
    };
    const ok = await kjor("/api/crm/kunder", redigerer ? "PATCH" : "POST", kropp);
    if (ok) {
      if (!redigerer) {
        settF({
          navn: "",
          type: "",
          orgnummer: "",
          kontaktperson: "",
          telefon: "",
          epost: "",
          adresse: "",
          avdeling: null,
          status: "prospekt",
        });
      }
      settApen(false);
    }
  }

  return (
    <Utfoldbart
      knappetekst={redigerer ? "Rediger" : "+ Ny kunde"}
      tittel={redigerer ? `Rediger ${kunde?.navn}` : "Ny kunde"}
      apen={apen}
      settApen={settApen}
    >
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Navn" bredde="2 1 240px">
            <input
              value={f.navn}
              onChange={(e) => sett("navn", e.target.value)}
              required
              maxLength={200}
              placeholder="Sameiet Ullevålsveien 71"
              style={feltstil}
            />
          </Felt>
          <Felt merke="Type" bredde="0 0 160px">
            <input
              value={f.type ?? ""}
              onChange={(e) => sett("type", e.target.value)}
              placeholder="Sameie"
              style={feltstil}
            />
          </Felt>
          <Felt merke="Orgnummer" bredde="0 0 150px">
            <input
              value={f.orgnummer ?? ""}
              onChange={(e) => sett("orgnummer", e.target.value)}
              inputMode="numeric"
              placeholder="912345678"
              style={feltstil}
            />
          </Felt>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Kontaktperson">
            <input
              value={f.kontaktperson ?? ""}
              onChange={(e) => sett("kontaktperson", e.target.value)}
              placeholder="Bjørn Sæther, styreleder"
              style={feltstil}
            />
          </Felt>
          <Felt merke="Telefon" bredde="0 0 150px">
            <input
              value={f.telefon ?? ""}
              onChange={(e) => sett("telefon", e.target.value)}
              placeholder="922 41 088"
              style={feltstil}
            />
          </Felt>
          <Felt merke="E-post">
            <input
              type="email"
              value={f.epost ?? ""}
              onChange={(e) => sett("epost", e.target.value)}
              placeholder="styret@eksempel.no"
              style={feltstil}
            />
          </Felt>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Adresse" bredde="2 1 240px">
            <input
              value={f.adresse ?? ""}
              onChange={(e) => sett("adresse", e.target.value)}
              placeholder="Ullevålsveien 71, 0454 Oslo"
              style={feltstil}
            />
          </Felt>
          <Felt merke="Avdeling">
            <select
              value={f.avdeling ?? ""}
              onChange={(e) => sett("avdeling", (e.target.value || null) as Avdeling | null)}
              style={feltstil}
            >
              <option value="">Ikke satt</option>
              {AVDELINGER.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Status" bredde="0 0 150px">
            <select
              value={f.status}
              onChange={(e) => sett("status", e.target.value as Kundestatus)}
              style={feltstil}
            >
              {KUNDESTATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUSNAVN[s]}
                </option>
              ))}
            </select>
          </Felt>
        </div>

        <p style={{ margin: 0, fontSize: 12.5, color: "var(--svak)", lineHeight: 1.5 }}>
          Omsetning settes ikke her. Den hentes fra Tripletex, så det finnes
          bare ett tall.
        </p>

        <Feilmelding tekst={feil} />

        <button type="submit" disabled={jobber} style={{ ...knappstil, alignSelf: "flex-start" }}>
          {jobber ? "Lagrer…" : redigerer ? "Lagre" : "Opprett"}
        </button>
      </form>
    </Utfoldbart>
  );
}

/* ───────────────────────── Reklamasjoner ───────────────────────── */

export function Reklamasjonsstatusvelger({
  id,
  status,
}: {
  id: string;
  status: Reklamasjonsstatus;
}) {
  const { kjor, jobber, feil } = useHandling();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        value={status}
        disabled={jobber}
        aria-label="Status"
        onChange={(e) => kjor("/api/crm/reklamasjoner", "PATCH", { id, status: e.target.value })}
        style={{ ...feltstil, height: 32, fontSize: 12.5, minWidth: 150 }}
      >
        {REKLAMASJONSSTATUS.map((s) => (
          <option key={s} value={s}>
            {REKSTATUS[s]}
          </option>
        ))}
      </select>
      <Feilmelding tekst={feil} />
    </div>
  );
}

export function NyReklamasjon({ kunder, iDag }: { kunder: Valg[]; iDag: string }) {
  const [apen, settApen] = useState(false);
  const [kundeId, settKundeId] = useState("");
  const [beskrivelse, settBeskrivelse] = useState("");
  const [mottatt, settMottatt] = useState(iDag);
  const [frist, settFrist] = useState("");
  const [kostnad, settKostnad] = useState("");
  const { kjor, jobber, feil } = useHandling();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const ok = await kjor("/api/crm/reklamasjoner", "POST", {
      kundeId,
      beskrivelse,
      mottatt,
      frist: frist || null,
      kostnad: kostnad ? Number(kostnad) : null,
    });
    if (ok) {
      settBeskrivelse("");
      settFrist("");
      settKostnad("");
      settApen(false);
    }
  }

  return (
    <Utfoldbart
      knappetekst="+ Ny reklamasjon"
      tittel="Ny reklamasjon"
      apen={apen}
      settApen={settApen}
    >
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Kunde" bredde="2 1 220px">
            <select
              value={kundeId}
              onChange={(e) => settKundeId(e.target.value)}
              required
              style={feltstil}
            >
              <option value="">Velg kunde</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Mottatt" bredde="0 0 150px">
            <input
              type="date"
              value={mottatt}
              onChange={(e) => settMottatt(e.target.value)}
              required
              style={feltstil}
            />
          </Felt>
          <Felt merke="Frist" bredde="0 0 150px">
            <input
              type="date"
              value={frist}
              onChange={(e) => settFrist(e.target.value)}
              style={feltstil}
            />
          </Felt>
        </div>

        <Felt merke="Hva gjelder saken" bredde="1 1 100%">
          <textarea
            value={beskrivelse}
            onChange={(e) => settBeskrivelse(e.target.value)}
            required
            rows={3}
            maxLength={2000}
            placeholder="Misfarging på nordre takflate etter vask."
            style={{ ...feltstil, height: "auto", padding: "10px 11px", lineHeight: 1.5 }}
          />
        </Felt>

        <Felt merke="Anslått kostnad" bredde="0 0 170px">
          <input
            type="number"
            min="0"
            step="100"
            value={kostnad}
            onChange={(e) => settKostnad(e.target.value)}
            placeholder="4200"
            style={feltstil}
          />
        </Felt>

        <p style={{ margin: 0, fontSize: 12.5, color: "var(--svak)", lineHeight: 1.5 }}>
          Saksnummeret lages automatisk. To saker med samme nummer er verre
          enn et nummer ingen liker.
        </p>

        <Feilmelding tekst={feil} />

        <button type="submit" disabled={jobber} style={{ ...knappstil, alignSelf: "flex-start" }}>
          {jobber ? "Lagrer…" : "Opprett"}
        </button>
      </form>
    </Utfoldbart>
  );
}

/* ───────────────────────── Garanti og gjenkjøp ───────────────────────── */

export function Kontaktetkryss({ id, kontaktet }: { id: string; kontaktet: boolean }) {
  const { kjor, jobber, feil } = useHandling();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={kontaktet}
          disabled={jobber}
          onChange={(e) =>
            kjor("/api/crm/garantier", "PATCH", { id, kontaktet: e.target.checked })
          }
          style={{ width: 17, height: 17, accentColor: "var(--gronn)", cursor: "pointer" }}
        />
        <span style={{ fontSize: 13, color: "var(--dempet)" }}>
          {kontaktet ? "Ringt" : "Marker ringt"}
        </span>
      </label>
      <Feilmelding tekst={feil} />
    </div>
  );
}

export function NyGaranti({ kunder, iDag }: { kunder: Valg[]; iDag: string }) {
  const [apen, settApen] = useState(false);
  const [kundeId, settKundeId] = useState("");
  const [utfort, settUtfort] = useState("");
  const [utfortDato, settUtfortDato] = useState(iDag);
  const [utloper, settUtloper] = useState("");
  const [kontaktesEtter, settKontaktesEtter] = useState("");
  const [anbefaling, settAnbefaling] = useState("");
  const { kjor, jobber, feil } = useHandling();

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const ok = await kjor("/api/crm/garantier", "POST", {
      kundeId,
      utfort,
      utfortDato,
      garantiUtloper: utloper || null,
      kontaktesEtter: kontaktesEtter || null,
      anbefaling: anbefaling || null,
    });
    if (ok) {
      settUtfort("");
      settUtloper("");
      settKontaktesEtter("");
      settAnbefaling("");
      settApen(false);
    }
  }

  return (
    <Utfoldbart knappetekst="+ Nytt gjenkjøp" tittel="Nytt gjenkjøp" apen={apen} settApen={settApen}>
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Kunde" bredde="2 1 220px">
            <select
              value={kundeId}
              onChange={(e) => settKundeId(e.target.value)}
              required
              style={feltstil}
            >
              <option value="">Velg kunde</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.navn}
                </option>
              ))}
            </select>
          </Felt>
          <Felt merke="Hva ble utført" bredde="2 1 220px">
            <input
              value={utfort}
              onChange={(e) => settUtfort(e.target.value)}
              required
              maxLength={300}
              placeholder="Takvask og impregnering"
              style={feltstil}
            />
          </Felt>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Felt merke="Utført" bredde="0 0 150px">
            <input
              type="date"
              value={utfortDato}
              onChange={(e) => settUtfortDato(e.target.value)}
              required
              style={feltstil}
            />
          </Felt>
          <Felt merke="Garanti utløper" bredde="0 0 150px">
            <input
              type="date"
              value={utloper}
              onChange={(e) => settUtloper(e.target.value)}
              style={feltstil}
            />
          </Felt>
          <Felt merke="Kontaktes etter" bredde="0 0 150px">
            <input
              type="date"
              value={kontaktesEtter}
              onChange={(e) => settKontaktesEtter(e.target.value)}
              style={feltstil}
            />
          </Felt>
        </div>

        <Felt merke="Anbefaling neste gang" bredde="1 1 100%">
          <input
            value={anbefaling}
            onChange={(e) => settAnbefaling(e.target.value)}
            maxLength={500}
            placeholder="Algebehandling ved neste besøk"
            style={feltstil}
          />
        </Felt>

        <Feilmelding tekst={feil} />

        <button type="submit" disabled={jobber} style={{ ...knappstil, alignSelf: "flex-start" }}>
          {jobber ? "Lagrer…" : "Opprett"}
        </button>
      </form>
    </Utfoldbart>
  );
}
