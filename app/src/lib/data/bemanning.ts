/**
 * Bemanning: hvem som er satt opp hvor, og hvilken farge de har.
 *
 * Fargekoden er ikke pynt — den er det montøren ser i kalenderen sin, og
 * det lederen kjenner igjen i uke-rutenettet. Derfor settes den ett sted.
 */
import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { ansatte, prosjekter, tildelinger } from "@/db/schema";
import { ukedager } from "../uke";
import type { Okt } from "../tilgang";

export { mandagen, ukedager, type Ukedag } from "../uke";

export async function hentAnsatte(okt: Okt) {
  return db
    .select({
      id: ansatte.id,
      navn: ansatte.navn,
      epost: ansatte.epost,
      rolle: ansatte.rolle,
      avdeling: ansatte.avdeling,
      farge: ansatte.farge,
      initialer: ansatte.initialer,
      abaxVehicleId: ansatte.abaxVehicleId,
      tripletexEmployeeId: ansatte.tripletexEmployeeId,
      aktiv: ansatte.aktiv,
    })
    .from(ansatte)
    .where(and(eq(ansatte.tenantId, okt.tenantId), eq(ansatte.aktiv, true)))
    .orderBy(asc(ansatte.navn));
}

export type Ukeoppsett = {
  ansattId: string;
  dato: string;
  prosjektNummer: string;
  prosjektNavn: string;
  fraKl: string | null;
  tilKl: string | null;
};

export async function hentUke(okt: Okt, mandag: string): Promise<Ukeoppsett[]> {
  const dager = ukedager(mandag);
  const forste = dager[0]!.iso;
  const siste = dager[dager.length - 1]!.iso;

  const rader = await db
    .select({
      ansattId: tildelinger.ansattId,
      dato: tildelinger.dato,
      prosjektNummer: prosjekter.nummer,
      prosjektNavn: prosjekter.navn,
      fraKl: tildelinger.fraKl,
      tilKl: tildelinger.tilKl,
    })
    .from(tildelinger)
    .innerJoin(prosjekter, eq(tildelinger.prosjektId, prosjekter.id))
    .where(
      and(
        eq(tildelinger.tenantId, okt.tenantId),
        gte(tildelinger.dato, forste),
        lte(tildelinger.dato, siste),
      ),
    )
    .orderBy(asc(tildelinger.fraKl));

  return rader;
}
