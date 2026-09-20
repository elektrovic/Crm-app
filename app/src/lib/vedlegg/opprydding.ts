/**
 * Opprydding av lokale bildekopier.
 *
 * Bilder og signaturer lagres i databasen så appen er rask mens jobben er
 * fersk. Men en database er bygget for rader man søker i, ikke for filer:
 * filer der gjør sikkerhetskopiene tunge, fyller minnet med bytes i stedet
 * for data man faktisk spør etter, og koster mangedobbelt per gigabyte.
 *
 * Siden bildene nå lastes automatisk opp til Tripletex, finnes de allerede
 * et sted som ER et arkiv. Kopien vår er en arbeidskopi. Derfor: behold den
 * mens jobben er fersk, rydd den bort etterpå.
 *
 * To regler som ikke skal rikkes:
 *
 * 1. Vi rydder ALDRI bort noe Tripletex ikke har bekreftet at de har.
 *    En fil som bare finnes hos oss er den eneste kopien som finnes.
 * 2. Raden blir stående. Appen skal fortsatt vite at bildet finnes, hvem
 *    som tok det og når — bare ikke bære bytene.
 */
import "server-only";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { vedlegg } from "@/db/schema";

/** Hvor lenge vi beholder den lokale kopien. */
export const STANDARD_OPPBEVARING_DAGER = 90;

export type Oppryddingsresultat = {
  ryddet: number;
  frigjortByte: number;
  /** Filer som er gamle nok, men som Tripletex ikke har bekreftet. */
  venterPaaTripletex: number;
};

/**
 * Rydder bort lokale kopier eldre enn oppbevaringstiden.
 * Kjøres som del av synken, som allerede går på en plan.
 */
export async function ryddGamleVedlegg(
  tenantId: string,
  dagerAaBeholde = STANDARD_OPPBEVARING_DAGER,
): Promise<Oppryddingsresultat> {
  const grense = new Date(Date.now() - dagerAaBeholde * 86_400_000);

  // Bare filer Tripletex har bekreftet. Alt annet står urørt.
  const kandidater = await db
    .select({ id: vedlegg.id, storrelse: vedlegg.storrelse })
    .from(vedlegg)
    .where(
      and(
        eq(vedlegg.tenantId, tenantId),
        isNotNull(vedlegg.data),
        isNotNull(vedlegg.tripletexLastetOpp),
        lt(vedlegg.opprettet, grense),
      ),
    );

  let frigjortByte = 0;

  for (const k of kandidater) {
    await db
      .update(vedlegg)
      .set({ data: null, dataSlettet: new Date() })
      .where(eq(vedlegg.id, k.id));
    frigjortByte += k.storrelse;
  }

  // Filer som er gamle nok, men som aldri nådde Tripletex. De blir stående,
  // og tallet er verdt å se på: det betyr at noe har feilet i stillhet.
  const [venter] = await db
    .select({ antall: sql<number>`count(*)`.mapWith(Number) })
    .from(vedlegg)
    .where(
      and(
        eq(vedlegg.tenantId, tenantId),
        isNotNull(vedlegg.data),
        isNull(vedlegg.tripletexLastetOpp),
        lt(vedlegg.opprettet, grense),
      ),
    );

  return {
    ryddet: kandidater.length,
    frigjortByte,
    venterPaaTripletex: venter?.antall ?? 0,
  };
}

/** «1,4 MB» — til synkrapporten. */
export function visFrigjort(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} kB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}
