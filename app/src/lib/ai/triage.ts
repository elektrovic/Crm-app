/**
 * AI-triagering av henvendelser.
 *
 * Leverandøren ligger bak et grensesnitt, av to grunner. Den ene er
 * praktisk: dere nevnte Pocket AI, og den plassen står klar i
 * `pocketAi()` nedenfor så snart vi har endepunkt, modellnavn og et
 * eksempel på svarformatet. Den andre er prinsipiell: forslagene fra en
 * modell skal kunne byttes ut uten at resten av CRM-en merker det.
 *
 * Alt som kommer ut herfra er FORSLAG. Det lagres i egne ai-kolonner,
 * atskilt fra det saksbehandleren selv har bestemt, og et menneske kan
 * alltid overstyre. En modell skal ikke stille en henvendelse videre i
 * pipelinen på egen hånd.
 *
 * Kjører alltid på server — API-nøkkelen skal aldri nå en nettleser.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Kanal } from "@/db/schema";

export const HASTEGRADER = ["lav", "normal", "hoy", "akutt"] as const;
export type Hastegrad = (typeof HASTEGRADER)[number];

export const KATEGORIER = [
  "nytt_oppdrag",
  "service",
  "reklamasjon",
  "tilbudsforesporsel",
  "faktura",
  "annet",
] as const;
export type Kategori = (typeof KATEGORIER)[number];

/** Det modellen får lov til å svare. Alt annet avvises av skjemaet. */
const Vurdering = z.object({
  sammendrag: z
    .string()
    .describe("Én til to setninger om hva henvendelsen gjelder. Norsk bokmål."),
  kategori: z.enum(KATEGORIER),
  hastegrad: z.enum(HASTEGRADER),
  begrunnelse: z
    .string()
    .describe("Kort begrunnelse for hastegraden, så saksbehandler kan overprøve den."),
});

export type Triagevurdering = z.infer<typeof Vurdering> & { modell: string };

export type TriageInput = {
  kanal: Kanal;
  innhold: string;
  avsenderNavn?: string | null;
};

type Triagerer = {
  navn: string;
  vurder(input: TriageInput): Promise<Triagevurdering>;
};

export class TriageFeil extends Error {
  constructor(
    message: string,
    readonly kanProvesIgjen: boolean,
  ) {
    super(message);
    this.name = "TriageFeil";
  }
}

const SYSTEM = `Du sorterer innkommende henvendelser for et norsk håndverkerfirma \
med tre avdelinger: elektro, lås og sikkerhet, og eiendomspleie.

Oppgaven er å lese henvendelsen og gi et kort sammendrag, en kategori og en \
hastegrad. Svar på norsk bokmål.

Retningslinjer for hastegrad:
- akutt: fare for liv, helse eller verdier — strømbrudd, vanninntrenging, \
dør som ikke lar seg låse på et bygg med beboere.
- hoy: kunden står fast eller mister inntekt, men det haster ikke i timer.
- normal: vanlig oppdrag eller forespørsel uten tidspress.
- lav: generell forespørsel, informasjon, eller noe som kan vente.

Du foreslår kun. Et menneske avgjør. Er henvendelsen uklar, si det i \
sammendraget framfor å gjette.`;

const MODELL = process.env.ANTHROPIC_MODELL ?? "claude-opus-5";

function claude(): Triagerer {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TriageFeil("ANTHROPIC_API_KEY mangler i miljøet.", false);
  }

  const klient = new Anthropic({ apiKey });

  return {
    navn: MODELL,
    async vurder(input) {
      const svar = await klient.messages.parse({
        model: MODELL,
        max_tokens: 2000,
        // Triagering er en kort klassifiseringsoppgave. Lav effort holder,
        // og holder kostnaden nede når det kommer mange henvendelser.
        output_config: {
          effort: "low",
          format: zodOutputFormat(Vurdering),
        },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              `Kanal: ${input.kanal}`,
              input.avsenderNavn ? `Fra: ${input.avsenderNavn}` : null,
              "",
              "Henvendelse:",
              input.innhold,
            ]
              .filter((l): l is string => l !== null)
              .join("\n"),
          },
        ],
      });

      // Refusal er ikke en teknisk feil, men vi skal ikke lagre et tomt svar.
      if (svar.stop_reason === "refusal") {
        throw new TriageFeil(
          "Modellen ville ikke vurdere denne henvendelsen. Ta den manuelt.",
          false,
        );
      }

      const vurdering = svar.parsed_output;
      if (!vurdering) {
        throw new TriageFeil("Fikk ikke et gyldig svar fra modellen.", true);
      }

      return { ...vurdering, modell: MODELL };
    },
  };
}

/**
 * Pocket AI.
 *
 * Plassen står klar. For å koble den på trenger vi tre ting fra dere:
 * endepunktet, modellnavnet, og et eksempel på hvordan svaret ser ut —
 * så mapper vi feltene rett inn i `Vurdering`-skjemaet over.
 */
function pocketAi(): Triagerer {
  throw new TriageFeil(
    "Pocket AI er ikke koblet på ennå. Sett AI_LEVERANDOR=claude, eller " +
      "skaff endepunkt, modellnavn og et eksempelsvar så mapper vi feltene.",
    false,
  );
}

function velgLeverandor(): Triagerer {
  switch (process.env.AI_LEVERANDOR) {
    case "claude":
      return claude();
    case "pocket":
      return pocketAi();
    default:
      throw new TriageFeil(
        "AI-triagering er ikke satt opp. Sett AI_LEVERANDOR i miljøet for å slå det på.",
        false,
      );
  }
}

/** Sant når triagering kan kjøres. Brukes til å skjule knappen i admin. */
export function triageErSattOpp(): boolean {
  try {
    velgLeverandor();
    return true;
  } catch {
    return false;
  }
}

export async function vurderHenvendelse(input: TriageInput): Promise<Triagevurdering> {
  if (input.innhold.trim().length < 10) {
    throw new TriageFeil("Henvendelsen er for kort til å vurderes.", false);
  }
  return velgLeverandor().vurder(input);
}
