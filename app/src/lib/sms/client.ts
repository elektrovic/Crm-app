/**
 * SMS-utsending.
 *
 * Leverandøren ligger bak et grensesnitt, slik at bytte fra Sveve til LINK
 * Mobility (eller motsatt) er én ny funksjon her og ingenting annet i
 * kodebasen. Valget står i `SMS_LEVERANDOR`.
 *
 * To ting er bevisst strenge:
 *
 * 1. Er ikke leverandøren satt opp i miljøet, sender vi ingenting og sier
 *    tydelig fra. Vi later aldri som om en melding gikk ut.
 * 2. Meldinger sendes bare når en montør har trykket på knappen. Det finnes
 *    ingen automatisk utsending her — en feil i en løkke skal ikke kunne
 *    ringe opp to hundre kunder.
 */
import "server-only";
import { normaliserNummer } from "./telefon";

export class SmsFeil extends Error {
  constructor(
    message: string,
    readonly kanProvesIgjen: boolean,
  ) {
    super(message);
    this.name = "SmsFeil";
  }
}

export type SendResultat = {
  levertTilLeverandor: boolean;
  leverandorId: string | null;
};

type Leverandor = {
  navn: string;
  send(til: string, melding: string, avsender: string): Promise<SendResultat>;
};

/**
 * Sveve. Enkelt HTTP-API og norsk leverandør.
 * Se sveve.no/sms-gateway for parameterne.
 */
function sveve(): Leverandor {
  const bruker = process.env.SVEVE_BRUKER;
  const passord = process.env.SVEVE_PASSORD;
  const base = process.env.SVEVE_URL ?? "https://sveve.no/SMS/SendMessage";

  if (!bruker || !passord) {
    throw new SmsFeil("SVEVE_BRUKER eller SVEVE_PASSORD mangler i miljøet.", false);
  }

  return {
    navn: "sveve",
    async send(til, melding, avsender) {
      const url = new URL(base);
      url.searchParams.set("user", bruker);
      url.searchParams.set("passwd", passord);
      url.searchParams.set("to", til);
      url.searchParams.set("msg", melding);
      url.searchParams.set("from", avsender);
      url.searchParams.set("f", "json");

      const svar = await fetch(url, { method: "POST", cache: "no-store" });

      if (!svar.ok) {
        // 5xx er verdt et nytt forsøk; 4xx er noe vi har gjort feil.
        throw new SmsFeil(`Sveve svarte ${svar.status}.`, svar.status >= 500);
      }

      const data = (await svar.json()) as {
        response?: { msgOkCount?: number; stdSMSCount?: number; errors?: unknown[]; ids?: number[] };
      };
      const r = data.response;

      if (!r || (r.msgOkCount ?? 0) < 1) {
        const detalj = r?.errors?.length ? ` (${JSON.stringify(r.errors)})` : "";
        throw new SmsFeil(`Sveve tok ikke imot meldingen${detalj}.`, false);
      }

      return {
        levertTilLeverandor: true,
        leverandorId: r.ids?.[0] !== undefined ? String(r.ids[0]) : null,
      };
    },
  };
}

/**
 * LINK Mobility settes opp her når avtalen er på plass.
 * Grensesnittet er det samme, så resten av koden merker ingenting.
 */
function linkMobility(): Leverandor {
  throw new SmsFeil(
    "LINK Mobility er ikke satt opp ennå. Sett SMS_LEVERANDOR=sveve, eller " +
      "implementer linkMobility() i src/lib/sms/client.ts.",
    false,
  );
}

function velgLeverandor(): Leverandor {
  switch (process.env.SMS_LEVERANDOR) {
    case "sveve":
      return sveve();
    case "link":
      return linkMobility();
    default:
      throw new SmsFeil(
        "SMS er ikke satt opp. Sett SMS_LEVERANDOR i miljøet for å slå det på.",
        false,
      );
  }
}

/** Sant når SMS faktisk kan sendes. Brukes til å skjule knappen i appen. */
export function smsErSattOpp(): boolean {
  try {
    velgLeverandor();
    return true;
  } catch {
    return false;
  }
}

/**
 * Sender én melding. Nummeret normaliseres først — et nummer på feil format
 * blir enten avvist av operatøren eller, verre, levert til feil person.
 */
export async function sendSms(input: {
  til: string;
  melding: string;
}): Promise<SendResultat> {
  const leverandor = velgLeverandor();
  const avsender = process.env.SMS_AVSENDER ?? "Halland";
  const nummer = normaliserNummer(input.til);

  if (input.melding.trim().length === 0) {
    throw new SmsFeil("Tom melding.", false);
  }

  return leverandor.send(nummer, input.melding, avsender);
}
