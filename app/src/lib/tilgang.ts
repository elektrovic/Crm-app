/**
 * Tilgangskontroll.
 *
 * Regelen om at en montør bare ser sine egne jobber håndheves HER, i
 * backend — ikke ved å skjule noe i grensesnittet. Et skjult kort er ikke
 * en tilgangsregel; en spørring som aldri returnerer andres rader, er det.
 */
import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import type { Rolle } from "@/db/schema";

/** Den innloggede brukeren, slik resten av backend ser den. */
export type Okt = Session["user"];

export class IkkeInnloggetFeil extends Error {
  constructor() {
    super("Ikke innlogget");
    this.name = "IkkeInnloggetFeil";
  }
}

export class IngenTilgangFeil extends Error {
  constructor(hva: string) {
    super(`Mangler tilgang: ${hva}`);
    this.name = "IngenTilgangFeil";
  }
}

/** Henter økten, eller kaster. Brukes øverst i hver server action. */
export async function krevOkt(): Promise<Okt> {
  const okt = await auth();
  if (!okt?.user?.id) throw new IkkeInnloggetFeil();
  return okt.user;
}

const RANGERING: Record<Rolle, number> = { montor: 0, leder: 1, admin: 2 };

/** Krever minst denne rollen. Leder og admin arver montørens tilganger. */
export async function krevRolle(minst: Rolle): Promise<Okt> {
  const okt = await krevOkt();
  if (RANGERING[okt.rolle] < RANGERING[minst]) {
    throw new IngenTilgangFeil(`krever rollen ${minst}`);
  }
  return okt;
}

/**
 * Hvilke ansattes data økten har lov til å lese.
 *
 * Montør: bare seg selv. Leder og admin: hele avdelingen sin.
 * Returnerer null når det ikke skal filtreres på ansatt i det hele tatt.
 */
export function synligAnsattId(okt: Okt): string | null {
  return okt.rolle === "montor" ? okt.id : null;
}

/**
 * Sjekker at økten faktisk har lov til å røre denne ansattes data.
 * Kalles før enhver skriving som peker på en ansattId fra klienten —
 * ellers kunne en montør ført timer i en kollegas navn.
 */
export function krevTilgangTilAnsatt(okt: Okt, ansattId: string): void {
  if (okt.rolle === "montor" && ansattId !== okt.id) {
    throw new IngenTilgangFeil("kan bare føre på egen bruker");
  }
}
