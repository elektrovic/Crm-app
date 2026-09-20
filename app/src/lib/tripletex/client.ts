/**
 * Tripletex-klient.
 *
 * Autentisering skjer i to trinn, slik Tripletex krever:
 *
 *   1. PUT /token/session/:create med consumerToken + employeeToken gir en
 *      session token med utløpsdato.
 *   2. Alle videre kall sender `Authorization: Basic base64("0:<sessionToken>")`.
 *      Brukernavnet er companyId; 0 (eller blank) betyr selskapet som eier
 *      employee token-en.
 *
 * Session token-en caches i minnet til den nærmer seg utløp, slik at vi ikke
 * lager en ny for hvert eneste API-kall.
 *
 * MERK: Kjøres alltid på server. Tokenene skal aldri nå en telefon.
 */
import "server-only";

const BASE = process.env.TRIPLETEX_BASE_URL ?? "https://api.tripletex.io/v2";

export class TripletexFeil extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detaljer?: unknown,
  ) {
    super(message);
    this.name = "TripletexFeil";
  }
}

/** Kastes når montøren fører på en periode som er godkjent/låst i Tripletex. */
export class LaastPeriodeFeil extends TripletexFeil {
  constructor(readonly dato: string) {
    super(`Perioden rundt ${dato} er låst i Tripletex`, 403);
    this.name = "LaastPeriodeFeil";
  }
}

type Sesjon = { token: string; utloper: number };
let bufretSesjon: Sesjon | null = null;

/** Marginen gjør at vi fornyer før tokenet faktisk går ut. */
const FORNY_FOR_MS = 60 * 60 * 1000; // 1 time

async function hentSessionToken(): Promise<string> {
  const naa = Date.now();
  if (bufretSesjon && bufretSesjon.utloper - FORNY_FOR_MS > naa) {
    return bufretSesjon.token;
  }

  const consumerToken = process.env.TRIPLETEX_CONSUMER_TOKEN;
  const employeeToken = process.env.TRIPLETEX_EMPLOYEE_TOKEN;
  if (!consumerToken || !employeeToken) {
    throw new TripletexFeil(
      "TRIPLETEX_CONSUMER_TOKEN eller TRIPLETEX_EMPLOYEE_TOKEN mangler i miljøet.",
      500,
    );
  }

  // Tripletex krever en utløpsdato. Vi ber om ett døgn av gangen — kort nok
  // til at et lekket token har begrenset verdi, langt nok til å slippe
  // fornying midt i en arbeidsdag.
  const utloper = new Date(naa + 24 * 60 * 60 * 1000);
  const expirationDate = utloper.toISOString().slice(0, 10);

  const url = new URL(`${BASE}/token/session/:create`);
  url.searchParams.set("consumerToken", consumerToken);
  url.searchParams.set("employeeToken", employeeToken);
  url.searchParams.set("expirationDate", expirationDate);

  const svar = await fetch(url, { method: "PUT", cache: "no-store" });
  if (!svar.ok) {
    throw new TripletexFeil(
      `Klarte ikke å opprette Tripletex-sesjon (${svar.status}).`,
      svar.status,
      await svar.text().catch(() => undefined),
    );
  }

  const data = (await svar.json()) as { value?: { token?: string } };
  const token = data.value?.token;
  if (!token) {
    throw new TripletexFeil("Tripletex svarte uten session token.", 502, data);
  }

  bufretSesjon = { token, utloper: utloper.getTime() };
  return token;
}

/** Nullstiller den bufrede sesjonen, brukt når Tripletex svarer 401. */
export function glemSesjon() {
  bufretSesjon = null;
}

async function kall<T>(
  sti: string,
  init: RequestInit & { sokeparametre?: Record<string, string | number | undefined> } = {},
  harProvdPaaNytt = false,
): Promise<T> {
  const { sokeparametre, ...rest } = init;
  const token = await hentSessionToken();

  const url = new URL(`${BASE}${sti}`);
  for (const [n, v] of Object.entries(sokeparametre ?? {})) {
    if (v !== undefined) url.searchParams.set(n, String(v));
  }

  const svar = await fetch(url, {
    ...rest,
    cache: "no-store",
    headers: {
      Authorization: `Basic ${Buffer.from(`0:${token}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...rest.headers,
    },
  });

  // Et utgått token gir 401. Vi kaster sesjonen og prøver nøyaktig én gang til.
  if (svar.status === 401 && !harProvdPaaNytt) {
    glemSesjon();
    return kall<T>(sti, init, true);
  }

  if (!svar.ok) {
    const tekst = await svar.text().catch(() => "");
    throw new TripletexFeil(
      `Tripletex ${rest.method ?? "GET"} ${sti} feilet (${svar.status}).`,
      svar.status,
      tekst,
    );
  }

  if (svar.status === 204) return undefined as T;
  return (await svar.json()) as T;
}

/* ---------------------------------------------------------------- typer */

type Innpakket<T> = { value: T };
type Liste<T> = { values: T[]; fullResultSize?: number };

export type TripletexProsjekt = {
  id: number;
  number: string;
  name: string;
  displayName?: string;
  customer?: { id: number; name?: string };
  isClosed?: boolean;
  deliveryAddress?: { addressLine1?: string; postalCode?: string; city?: string };
  /** Satt på underprosjekter — tilleggsarbeid henger under hovedprosjektet. */
  parentProject?: { id: number } | null;
};

export type TripletexAktivitet = {
  id: number;
  name: string;
  number?: string;
  isChargeable?: boolean;
};

export type TripletexAnsatt = {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  employeeNumber?: string;
};

export type TripletexTimeforing = {
  id: number;
  date: string;
  hours: number;
  comment?: string;
  project?: { id: number };
  activity?: { id: number };
  employee?: { id: number };
};

/* --------------------------------------------------------------- kallene */

export const tripletex = {
  /** Aktive prosjekter. `count` er satt høyt nok til en normal portefølje. */
  async prosjekter(params: { count?: number; isClosed?: boolean } = {}) {
    const svar = await kall<Liste<TripletexProsjekt>>("/project", {
      sokeparametre: {
        count: params.count ?? 200,
        isClosed: params.isClosed === undefined ? "false" : String(params.isClosed),
        fields: "id,number,name,displayName,isClosed,customer(id,name),deliveryAddress",
      },
    });
    return svar.values;
  },

  async prosjekt(id: number) {
    const svar = await kall<Innpakket<TripletexProsjekt>>(`/project/${id}`);
    return svar.value;
  },

  async aktiviteter() {
    const svar = await kall<Liste<TripletexAktivitet>>("/activity", {
      sokeparametre: { count: 200, fields: "id,name,number,isChargeable" },
    });
    return svar.values;
  },

  async ansatte() {
    const svar = await kall<Liste<TripletexAnsatt>>("/employee", {
      sokeparametre: { count: 500, fields: "id,firstName,lastName,email,employeeNumber" },
    });
    return svar.values;
  },

  /** Timeføringer for én ansatt i et datointervall. */
  async timeforinger(params: { ansattId: number; fra: string; til: string }) {
    const svar = await kall<Liste<TripletexTimeforing>>("/timesheet/entry", {
      sokeparametre: {
        employeeId: params.ansattId,
        dateFrom: params.fra,
        dateTo: params.til,
        count: 500,
        fields: "id,date,hours,comment,project(id),activity(id),employee(id)",
      },
    });
    return svar.values;
  },

  /**
   * Underprosjektene som henger under et hovedprosjekt.
   *
   * «Underprosjekt» er Tripletex' eget begrep for tilleggsarbeid, så det er
   * dit tilleggene hører hjemme.
   */
  async underprosjekter(hovedprosjektId: number) {
    const svar = await kall<Liste<TripletexProsjekt>>("/project", {
      sokeparametre: {
        parentProjectId: hovedprosjektId,
        count: 100,
        fields: "id,number,name,displayName,parentProject(id)",
      },
    });
    return svar.values;
  },

  /** Oppretter et underprosjekt under hovedprosjektet. */
  async opprettUnderprosjekt(input: {
    hovedprosjektId: number;
    navn: string;
    nummer: string;
    kundeId?: number | null;
  }): Promise<TripletexProsjekt> {
    const svar = await kall<Innpakket<TripletexProsjekt>>("/project", {
      method: "POST",
      body: JSON.stringify({
        name: input.navn,
        number: input.nummer,
        parentProject: { id: input.hovedprosjektId },
        ...(input.kundeId ? { customer: { id: input.kundeId } } : {}),
        isClosed: false,
      }),
    });
    return svar.value;
  },

  /**
   * Legger en fil i dokumentarkivet på et objekt i Tripletex.
   *
   * `POST /documentArchive/{objectType}/{id}`, sendt som multipart.
   * Tripletex tar imot PDF, PNG, JPEG, TIFF og EHF — bildene våre er
   * komprimert til JPEG og signaturene er PNG, så begge går rett inn.
   *
   * Dette er grunnen til at kontoret slipper å lete i appen: dokumentasjonen
   * havner der de allerede jobber.
   */
  async lastOppVedlegg(input: {
    objekttype: "PROJECT" | "ORDER" | "INVOICE";
    objektId: number;
    filnavn: string;
    mimetype: string;
    innhold: Buffer;
  }): Promise<void> {
    const token = await hentSessionToken();

    const skjema = new FormData();
    const blob = new Blob([new Uint8Array(input.innhold)], { type: input.mimetype });
    skjema.append("file", blob, input.filnavn);

    const url = `${BASE}/documentArchive/${input.objekttype}/${input.objektId}`;
    const svar = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Basic ${Buffer.from(`0:${token}`).toString("base64")}`,
        // Content-Type settes ikke her — fetch legger på grensen selv.
      },
      body: skjema,
    });

    if (!svar.ok) {
      throw new TripletexFeil(
        `Klarte ikke å laste opp vedlegg til ${input.objekttype} ${input.objektId} (${svar.status}).`,
        svar.status,
        await svar.text().catch(() => undefined),
      );
    }
  },

  /**
   * Fører timer. Kaster LaastPeriodeFeil hvis Tripletex avviser fordi
   * perioden er godkjent — da skal montøren få beskjed om det, ikke en
   * generisk feilmelding.
   */
  async fortimer(input: {
    ansattId: number;
    prosjektId: number;
    aktivitetId: number;
    dato: string;
    timer: number;
    kommentar?: string;
  }): Promise<TripletexTimeforing> {
    try {
      const svar = await kall<Innpakket<TripletexTimeforing>>("/timesheet/entry", {
        method: "POST",
        body: JSON.stringify({
          employee: { id: input.ansattId },
          project: { id: input.prosjektId },
          activity: { id: input.aktivitetId },
          date: input.dato,
          hours: input.timer,
          comment: input.kommentar,
        }),
      });
      return svar.value;
    } catch (e) {
      if (e instanceof TripletexFeil && erLaastPeriode(e)) {
        throw new LaastPeriodeFeil(input.dato);
      }
      throw e;
    }
  },
};

/**
 * Tripletex signaliserer låst periode med 400/403 og en tekst om at
 * timelisten er godkjent eller lukket. Vi kjenner igjen begge språkene,
 * siden feilteksten følger språket på integrasjonsbrukeren.
 */
function erLaastPeriode(feil: TripletexFeil): boolean {
  if (feil.status !== 400 && feil.status !== 403) return false;
  const tekst = String(feil.detaljer ?? "").toLowerCase();
  return (
    tekst.includes("approved") ||
    tekst.includes("locked") ||
    tekst.includes("closed period") ||
    tekst.includes("godkjent") ||
    tekst.includes("låst")
  );
}
