/**
 * ABAX-klient.
 *
 * ABAX Open API bruker OAuth2 client credentials: vi bytter client id og
 * secret mot et bearer-token, og bruker det til å lese kjøretøy, posisjoner
 * og turer på vegne av organisasjonen.
 *
 * PERSONVERN — les dette før funksjonene utvides:
 * Posisjon og kjørebok fra ansattes biler er personopplysninger, og
 * Datatilsynet har egne regler for GPS i arbeidsbiler. Formålet her er
 * avgrenset til to ting: å finne nærmeste ledige bil ved akuttoppdrag, og
 * å foreslå timer montøren selv bekrefter. Dataene skal ikke brukes til å
 * vurdere den enkeltes arbeidsinnsats, og skal ikke lagres lenger enn
 * arbeidsdagen krever. Utvides bruken, må formålet drøftes med de ansatte
 * på nytt og dokumenteres før funksjonen settes i drift.
 */
import "server-only";
import type { AbaxKjoretoy, AbaxTur } from "./typer";

const API_BASE = process.env.ABAX_BASE_URL ?? "https://api.abax.cloud";
const IDENTITY_BASE = process.env.ABAX_IDENTITY_URL ?? "https://identity.abax.cloud";

export class AbaxFeil extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detaljer?: unknown,
  ) {
    super(message);
    this.name = "AbaxFeil";
  }
}

type Token = { verdi: string; utloper: number };
let bufretToken: Token | null = null;

async function hentToken(): Promise<string> {
  const naa = Date.now();
  if (bufretToken && bufretToken.utloper - 60_000 > naa) return bufretToken.verdi;

  const id = process.env.ABAX_CLIENT_ID;
  const secret = process.env.ABAX_CLIENT_SECRET;
  if (!id || !secret) {
    throw new AbaxFeil("ABAX_CLIENT_ID eller ABAX_CLIENT_SECRET mangler i miljøet.", 500);
  }

  const svar = await fetch(`${IDENTITY_BASE}/connect/token`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope: process.env.ABAX_SCOPE ?? "open_api open_api.vehicles open_api.trips",
    }),
  });

  if (!svar.ok) {
    throw new AbaxFeil(
      `Klarte ikke å hente ABAX-token (${svar.status}).`,
      svar.status,
      await svar.text().catch(() => undefined),
    );
  }

  const data = (await svar.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new AbaxFeil("ABAX svarte uten access_token.", 502, data);

  bufretToken = {
    verdi: data.access_token,
    utloper: naa + (data.expires_in ?? 3600) * 1000,
  };
  return bufretToken.verdi;
}

async function kall<T>(sti: string, sokeparametre: Record<string, string | number> = {}) {
  const token = await hentToken();
  const url = new URL(`${API_BASE}${sti}`);
  for (const [n, v] of Object.entries(sokeparametre)) url.searchParams.set(n, String(v));

  const svar = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (svar.status === 401) {
    bufretToken = null;
    throw new AbaxFeil("ABAX avviste tokenet.", 401);
  }
  if (!svar.ok) {
    throw new AbaxFeil(
      `ABAX GET ${sti} feilet (${svar.status}).`,
      svar.status,
      await svar.text().catch(() => undefined),
    );
  }
  return (await svar.json()) as T;
}

export type { AbaxKjoretoy, AbaxTur } from "./typer";
export { avstandMeter } from "./geo";

/* ---------------------------------------------------------------- kallene */

export const abax = {
  /** Alle kjøretøy med siste kjente posisjon — grunnlaget for bilkartet. */
  async kjoretoy(): Promise<AbaxKjoretoy[]> {
    const svar = await kall<{ items?: AbaxKjoretoy[] }>("/v1/vehicles", { page_size: 200 });
    return svar.items ?? [];
  },

  /** Turer i et tidsrom. Brukes til kjøreboka og timeforslagene. */
  async turer(params: { fra: Date; til: Date; kjoretoyId?: string }): Promise<AbaxTur[]> {
    const sok: Record<string, string | number> = {
      page_size: 500,
      date_from: params.fra.toISOString(),
      date_to: params.til.toISOString(),
    };
    if (params.kjoretoyId) sok.vehicle_id = params.kjoretoyId;
    const svar = await kall<{ items?: AbaxTur[] }>("/v1/trips", sok);
    return svar.items ?? [];
  },
};
