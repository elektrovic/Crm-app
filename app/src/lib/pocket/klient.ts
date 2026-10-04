/**
 * Pocket AI — opptakeren som tar opp og transkriberer samtaler.
 *
 *   Base:   https://public.heypocketai.com/api/v1
 *   Auth:   Authorization: Bearer pk_…
 *   Liste:  GET /recordings?startDate=&endDate=&page=&limit=
 *   Detalj: GET /recordings/{id}?include_summarizations=true
 *
 * MERK OM FELTNAVN: Pocket sin egen dokumentasjon er ikke nåbar herfra,
 * og de to beskrivelsene jeg fant oppgir feltene i hver sin form —
 * `recording_at` mot `recordingAt`. Derfor leses begge. Det er billigere
 * enn å ta feil, og feilen ville vært stille: alle samtaler ville fått
 * dagens dato uten at noen oppdaget det.
 */
import "server-only";

const BASE = process.env.POCKET_AI_BASE_URL ?? "https://public.heypocketai.com/api/v1";

export class PocketFeil extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detaljer?: unknown,
  ) {
    super(message);
    this.name = "PocketFeil";
  }
}

export function pocketErSattOpp(): boolean {
  return Boolean(process.env.POCKET_AI_API_KEY?.trim());
}

/** Leser et felt uansett om det er skrevet med understrek eller stor bokstav. */
export function felt<T = unknown>(rad: unknown, ...navn: string[]): T | undefined {
  if (!rad || typeof rad !== "object") return undefined;
  const o = rad as Record<string, unknown>;
  for (const n of navn) {
    if (o[n] !== undefined && o[n] !== null) return o[n] as T;
  }
  return undefined;
}

export type Opptak = {
  pocketId: string;
  tittel: string | null;
  startet: Date;
  varighetSekunder: number | null;
  sprak: string | null;
  epost: string | null;
};

/**
 * Plukker et opptak ut av svaret.
 *
 * Mangler tidspunktet, forkastes raden. Et opptak uten tidspunkt kan ikke
 * plasseres i en tidslinje, og å sette dagens dato ville gjort det til en
 * løgn som ser riktig ut.
 */
export function lesOpptak(rad: unknown): Opptak | null {
  const id = felt<string>(rad, "id", "recording_id", "recordingId");
  if (!id) return null;

  const raaTid =
    felt<string>(rad, "recording_at", "recordingAt", "recorded_at", "created_at", "createdAt") ??
    null;
  const tid = raaTid ? new Date(raaTid) : null;
  if (!tid || Number.isNaN(tid.getTime())) return null;

  const tatt = felt<Record<string, unknown>>(rad, "recorded_by", "recordedBy");

  return {
    pocketId: String(id),
    tittel: felt<string>(rad, "title", "tittel") ?? null,
    startet: tid,
    varighetSekunder: tallEllerNull(felt(rad, "duration", "duration_seconds", "durationSeconds")),
    sprak: felt<string>(rad, "language", "sprak") ?? null,
    epost: felt<string>(tatt, "email", "epost") ?? null,
  };
}

function tallEllerNull(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

export type Innhold = { sammendrag: string | null; oppgaver: string[] };

/**
 * Sammendrag og oppgaver fra detaljsvaret.
 *
 * Pocket kaller dem «summarizations», og formen varierer: noen ganger en
 * tekst, noen ganger seksjoner med overskrift og innhold. Vi tar det vi
 * kjenner igjen og lar resten ligge, i stedet for å kreve én bestemt form.
 */
export function lesInnhold(rad: unknown): Innhold {
  const kilder = [
    felt(rad, "summarizations", "summaries"),
    felt(rad, "summary", "summarization"),
  ].filter(Boolean);

  let sammendrag: string | null = null;
  const oppgaver: string[] = [];

  for (const kilde of kilder) {
    for (const s of Array.isArray(kilde) ? kilde : [kilde]) {
      if (typeof s === "string") {
        sammendrag ??= s.trim() || null;
        continue;
      }

      const tekst =
        felt<string>(s, "content", "text", "summary", "body") ??
        seksjonstekst(felt(s, "sections"));
      if (tekst && !sammendrag) sammendrag = tekst.trim() || null;

      for (const o of lesOppgaver(s)) oppgaver.push(o);
    }
  }

  // Samme oppgave kan komme fra flere sammendrag av samme opptak.
  return { sammendrag, oppgaver: [...new Set(oppgaver)].slice(0, 20) };
}

function seksjonstekst(seksjoner: unknown): string | null {
  if (!Array.isArray(seksjoner)) return null;
  const biter = seksjoner
    .map((s) => {
      const h = felt<string>(s, "heading", "title");
      const i = felt<string>(s, "content", "text");
      return [h, i].filter(Boolean).join(": ");
    })
    .filter(Boolean);
  return biter.length ? biter.join("\n") : null;
}

function lesOppgaver(s: unknown): string[] {
  const raa = felt(s, "action_items", "actionItems", "actions", "tasks");
  if (!raa) return [];

  const liste = Array.isArray(raa) ? raa : [raa];
  return liste
    .map((o) => {
      if (typeof o === "string") return o.trim();
      return (felt<string>(o, "text", "content", "title", "task") ?? "").trim();
    })
    .filter((o) => o.length > 0 && o.length <= 300);
}

/* ------------------------------------------------------------- kallene */

async function kall<T>(sti: string, sok: Record<string, string | number> = {}): Promise<T> {
  const nokkel = process.env.POCKET_AI_API_KEY?.trim();
  if (!nokkel) {
    throw new PocketFeil("POCKET_AI_API_KEY mangler i miljøet.", 500);
  }

  const url = new URL(`${BASE}${sti}`);
  for (const [n, v] of Object.entries(sok)) url.searchParams.set(n, String(v));

  const svar = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${nokkel}`, Accept: "application/json" },
  });

  if (!svar.ok) {
    throw new PocketFeil(
      `Pocket GET ${sti} feilet (${svar.status}).`,
      svar.status,
      (await svar.text().catch(() => "")).slice(0, 400),
    );
  }
  return (await svar.json()) as T;
}

/** Rader ut av et listesvar, uansett hva listefeltet heter. */
export function lesListe(svar: unknown): unknown[] {
  if (Array.isArray(svar)) return svar;
  for (const n of ["data", "recordings", "items", "results", "values"]) {
    const v = felt(svar, n);
    if (Array.isArray(v)) return v;
  }
  return [];
}

export const pocket = {
  async opptak(params: { fra: string; til: string; side?: number; antall?: number }) {
    const svar = await kall<unknown>("/recordings", {
      startDate: params.fra,
      endDate: params.til,
      page: params.side ?? 1,
      limit: params.antall ?? 50,
    });
    return lesListe(svar)
      .map(lesOpptak)
      .filter((o): o is Opptak => o !== null);
  },

  async detaljer(id: string) {
    // Transkripsjonen bes det uttrykkelig om å slippe: vi lagrer den ikke,
    // og da er det ingen grunn til å hente den heller.
    const svar = await kall<unknown>(`/recordings/${id}`, {
      include_transcript: "false",
      include_summarizations: "true",
    });
    const rad = felt(svar, "data", "recording") ?? svar;
    return lesInnhold(rad);
  },
};
