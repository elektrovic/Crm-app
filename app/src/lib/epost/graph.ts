/**
 * E-post via Microsoft Graph.
 *
 * Bruker den samme app-registreringen som innloggingen, så det er ingen ny
 * leverandør å betale for eller vedlikeholde. Kravet er at appen får
 * applikasjonstillatelsen `Mail.Send` med administratorsamtykke, og at
 * `GRAPH_AVSENDER` er en postboks i leietakeren.
 *
 * Er ikke dette satt opp, sender vi ingenting og sier fra — vi later aldri
 * som om en e-post gikk ut.
 */
import "server-only";

const GRAPH = "https://graph.microsoft.com/v1.0";

export class EpostFeil extends Error {
  constructor(
    message: string,
    readonly kanProvesIgjen: boolean,
  ) {
    super(message);
    this.name = "EpostFeil";
  }
}

type Token = { verdi: string; utloper: number };
let bufretToken: Token | null = null;

/** Tenant-ID-en trekkes ut av issuer-URL-en innloggingen allerede bruker. */
function tenantId(): string | null {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
  if (!issuer) return null;
  const m = /login\.microsoftonline\.com\/([^/]+)/.exec(issuer);
  return m?.[1] ?? null;
}

export function epostErSattOpp(): boolean {
  return Boolean(
    tenantId() &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
      process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
      process.env.GRAPH_AVSENDER,
  );
}

async function hentToken(): Promise<string> {
  const naa = Date.now();
  if (bufretToken && bufretToken.utloper - 60_000 > naa) return bufretToken.verdi;

  const tenant = tenantId();
  const id = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const secret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!tenant || !id || !secret) {
    throw new EpostFeil(
      "E-post er ikke satt opp. Mangler Entra-oppsett eller GRAPH_AVSENDER.",
      false,
    );
  }

  const svar = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!svar.ok) {
    throw new EpostFeil(
      `Fikk ikke token fra Entra (${svar.status}).`,
      svar.status >= 500,
    );
  }

  const data = (await svar.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new EpostFeil("Entra svarte uten access_token.", false);

  bufretToken = { verdi: data.access_token, utloper: naa + (data.expires_in ?? 3600) * 1000 };
  return bufretToken.verdi;
}

export async function sendEpost(input: {
  til: string[];
  emne: string;
  tekst: string;
}): Promise<void> {
  const avsender = process.env.GRAPH_AVSENDER;
  if (!avsender) throw new EpostFeil("GRAPH_AVSENDER mangler i miljøet.", false);
  if (input.til.length === 0) throw new EpostFeil("Ingen mottakere.", false);

  const token = await hentToken();

  const svar = await fetch(`${GRAPH}/users/${encodeURIComponent(avsender)}/sendMail`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.emne,
        body: { contentType: "Text", content: input.tekst },
        toRecipients: input.til.map((a) => ({ emailAddress: { address: a } })),
      },
      saveToSentItems: true,
    }),
  });

  // Graph svarer 202 uten innhold når meldingen er tatt imot.
  if (svar.status !== 202 && !svar.ok) {
    const detalj = await svar.text().catch(() => "");
    throw new EpostFeil(
      `Graph avviste e-posten (${svar.status}). ${detalj.slice(0, 300)}`,
      svar.status >= 500,
    );
  }
}
