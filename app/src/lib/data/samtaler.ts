/**
 * Samtalene fra Pocket, slik skjermen trenger dem.
 *
 * Her finnes ingen transkripsjon, og det er med vilje — se kommentaren i
 * skjemaet. Det vi viser er tidspunkt, sammendrag og forslagene til hva
 * som må følges opp. Det var også det du ba om.
 */
import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ansatte, kunder, samtaler } from "@/db/schema";
import type { Okt } from "../tilgang";

export type Samtalerad = {
  id: string;
  tittel: string | null;
  startet: Date;
  varighetSekunder: number | null;
  sammendrag: string | null;
  /** Forslagene som ennå ikke er tatt i bruk. De brukte er luket vekk. */
  forslag: string[];
  kundeId: string | null;
  kundeNavn: string | null;
  kundeTelefon: string | null;
  koblingBekreftet: boolean;
  ansattNavn: string | null;
};

/**
 * Forslagene som ennå står igjen.
 *
 * Et forslag som er gjort om til en oppfølging skal aldri tilbys igjen —
 * ellers ender samme telefonsamtale som tre like punkter i lista. Står
 * den egen funksjon fordi både lista og tellingen må være enige om hva
 * «igjen» betyr.
 */
export function apneForslag(
  oppgaver: string[] | null,
  brukt: string[] | null,
): string[] {
  const erBrukt = new Set(brukt ?? []);
  return (oppgaver ?? []).filter((o) => !erBrukt.has(o));
}

function tilRad(r: {
  id: string;
  tittel: string | null;
  startet: Date;
  varighetSekunder: number | null;
  sammendrag: string | null;
  oppgaver: string[] | null;
  oppgaverBrukt: string[] | null;
  kundeId: string | null;
  kundeNavn: string | null;
  kundeTelefon: string | null;
  koblingBekreftet: boolean;
  ansattNavn: string | null;
}): Samtalerad {
  return {
    id: r.id,
    tittel: r.tittel,
    startet: r.startet,
    varighetSekunder: r.varighetSekunder,
    sammendrag: r.sammendrag,
    forslag: apneForslag(r.oppgaver, r.oppgaverBrukt),
    kundeId: r.kundeId,
    kundeNavn: r.kundeNavn,
    kundeTelefon: r.kundeTelefon,
    koblingBekreftet: r.koblingBekreftet,
    ansattNavn: r.ansattNavn,
  };
}

const KOLONNER = {
  id: samtaler.id,
  tittel: samtaler.tittel,
  startet: samtaler.startet,
  varighetSekunder: samtaler.varighetSekunder,
  sammendrag: samtaler.sammendrag,
  oppgaver: samtaler.oppgaver,
  oppgaverBrukt: samtaler.oppgaverBrukt,
  kundeId: samtaler.kundeId,
  kundeNavn: kunder.navn,
  kundeTelefon: kunder.telefon,
  koblingBekreftet: samtaler.koblingBekreftet,
  ansattNavn: ansatte.navn,
};

/**
 * Samtalene, nyest først.
 *
 * `bareUkoblede` finnes fordi det er den ene lista som krever noe av deg:
 * en samtale uten kunde finner du aldri igjen når du leter etter den om
 * tre måneder.
 */
export async function hentSamtaler(
  okt: Okt,
  { bareUkoblede = false, grense = 60 } = {},
): Promise<Samtalerad[]> {
  const rader = await db
    .select(KOLONNER)
    .from(samtaler)
    .leftJoin(kunder, eq(kunder.id, samtaler.kundeId))
    .leftJoin(ansatte, eq(ansatte.id, samtaler.ansattId))
    .where(
      bareUkoblede
        ? and(eq(samtaler.tenantId, okt.tenantId), isNull(samtaler.kundeId))
        : eq(samtaler.tenantId, okt.tenantId),
    )
    .orderBy(desc(samtaler.startet))
    .limit(grense);

  return rader.map(tilRad);
}

/** Samtalene som handler om én kunde. */
export async function hentSamtalerForKunde(
  okt: Okt,
  kundeId: string,
): Promise<Samtalerad[]> {
  const rader = await db
    .select(KOLONNER)
    .from(samtaler)
    .leftJoin(kunder, eq(kunder.id, samtaler.kundeId))
    .leftJoin(ansatte, eq(ansatte.id, samtaler.ansattId))
    .where(and(eq(samtaler.tenantId, okt.tenantId), eq(samtaler.kundeId, kundeId)))
    .orderBy(desc(samtaler.startet));

  return rader.map(tilRad);
}

export type Samtaletall = {
  totalt: number;
  ukoblede: number;
  /** Forslag som verken er tatt i bruk eller avvist. Det er disse som haster. */
  apneForslag: number;
};

/** Tallene over lista, så du ser om noe venter uten å bla. */
export async function hentSamtaletall(okt: Okt): Promise<Samtaletall> {
  const rader = await db
    .select({
      kundeId: samtaler.kundeId,
      oppgaver: samtaler.oppgaver,
      oppgaverBrukt: samtaler.oppgaverBrukt,
    })
    .from(samtaler)
    .where(eq(samtaler.tenantId, okt.tenantId));

  let ukoblede = 0;
  let apne = 0;
  for (const r of rader) {
    if (!r.kundeId) ukoblede += 1;
    apne += apneForslag(r.oppgaver, r.oppgaverBrukt).length;
  }

  return { totalt: rader.length, ukoblede, apneForslag: apne };
}

/** Sekunder til «4 min», som er den eneste oppløsningen noen bryr seg om. */
export function varighet(sekunder: number | null): string | null {
  if (sekunder === null || sekunder <= 0) return null;
  if (sekunder < 60) return `${sekunder} sek`;
  return `${Math.round(sekunder / 60)} min`;
}
