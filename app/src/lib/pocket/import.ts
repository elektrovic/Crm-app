/**
 * Henter nye samtaler fra Pocket.
 *
 * Kjøres som del av synken — altså når noen er innom portalen, høyst én
 * gang i timen. Pocket er ikke noe vi venter på; samtalene er like
 * aktuelle om de kommer inn et kvarter senere.
 *
 * Trygg å kjøre om igjen: hver samtale har Pocket sin egen id, og en
 * samtale vi alt har hentes ikke på nytt.
 */
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { ansatte, kunder, samtaler } from "@/db/schema";
import { pocket, pocketErSattOpp } from "./klient";
import { velgKundeFraTekst } from "./kundetreff";

export type Samtaleresultat = {
  nye: number;
  hoppetOver: number;
  utenTidspunkt: number;
  /** Null når Pocket ikke er satt opp — da er det ingenting å rapportere. */
  avslatt: string | null;
};

/** Hvor langt tilbake vi ser første gang, før vi har noe å regne fra. */
const FORSTE_GANG_DAGER = 14;

function dato(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function hentNyeSamtaler(tenantId: string): Promise<Samtaleresultat> {
  const tomt = { nye: 0, hoppetOver: 0, utenTidspunkt: 0 };

  if (!pocketErSattOpp()) {
    return { ...tomt, avslatt: "POCKET_AI_API_KEY mangler." };
  }

  // Fra den nyeste vi har, ellers to uker tilbake. Vi trekker fra et døgn,
  // fordi en samtale kan bli ferdig behandlet hos Pocket etter at den ble
  // tatt opp — henter vi bare fra siste tidspunkt, går de tapt.
  const [nyeste] = await db
    .select({ startet: samtaler.startet })
    .from(samtaler)
    .where(eq(samtaler.tenantId, tenantId))
    .orderBy(desc(samtaler.startet))
    .limit(1);

  const fra = nyeste
    ? new Date(nyeste.startet.getTime() - 86_400_000)
    : new Date(Date.now() - FORSTE_GANG_DAGER * 86_400_000);
  const til = new Date(Date.now() + 86_400_000);

  const opptak = await pocket.opptak({ fra: dato(fra), til: dato(til), antall: 100 });
  if (opptak.length === 0) return { ...tomt, avslatt: null };

  // Hvilke har vi fra før? Ett oppslag, ikke ett per samtale.
  const finnes = await db
    .select({ pocketId: samtaler.pocketId })
    .from(samtaler)
    .where(
      and(
        eq(samtaler.tenantId, tenantId),
        inArray(
          samtaler.pocketId,
          opptak.map((o) => o.pocketId),
        ),
      ),
    );
  const kjente = new Set(finnes.map((f) => f.pocketId));
  const nye = opptak.filter((o) => !kjente.has(o.pocketId));

  if (nye.length === 0) {
    return { nye: 0, hoppetOver: opptak.length, utenTidspunkt: 0, avslatt: null };
  }

  const [folk, kundeliste] = await Promise.all([
    db
      .select({ id: ansatte.id, epost: ansatte.epost })
      .from(ansatte)
      .where(eq(ansatte.tenantId, tenantId)),
    db
      .select({ id: kunder.id, navn: kunder.navn })
      .from(kunder)
      .where(eq(kunder.tenantId, tenantId)),
  ]);
  const epostTilAnsatt = new Map(folk.map((f) => [f.epost.toLowerCase(), f.id]));

  let lagtInn = 0;
  for (const o of nye) {
    // Detaljene hentes per samtale fordi sammendraget ikke er med i lista.
    // Feiler én, skal ikke de andre falle med den.
    let innhold = { sammendrag: null as string | null, oppgaver: [] as string[] };
    try {
      innhold = await pocket.detaljer(o.pocketId);
    } catch (feil) {
      console.error("Pocket: fikk ikke detaljer", { id: o.pocketId, feil });
    }

    const leteTekst = [o.tittel, innhold.sammendrag].filter(Boolean).join(" ");

    await db
      .insert(samtaler)
      .values({
        tenantId,
        pocketId: o.pocketId,
        tittel: o.tittel,
        startet: o.startet,
        varighetSekunder: o.varighetSekunder,
        sprak: o.sprak,
        sammendrag: innhold.sammendrag,
        oppgaver: innhold.oppgaver.length ? innhold.oppgaver : null,
        ansattId: o.epost ? (epostTilAnsatt.get(o.epost.toLowerCase()) ?? null) : null,
        kundeId: velgKundeFraTekst(leteTekst, kundeliste),
      })
      .onConflictDoNothing();
    lagtInn += 1;
  }

  return {
    nye: lagtInn,
    hoppetOver: opptak.length - nye.length,
    utenTidspunkt: 0,
    avslatt: null,
  };
}
