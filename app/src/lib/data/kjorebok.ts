/**
 * Henter kjørebok fra ABAX og gjør den om til timeforslag for én ansatt.
 *
 * Feiler ABAX, skal montøren fortsatt kunne føre timer manuelt. Derfor
 * returnerer vi en tom liste i stedet for å kaste — et forslag som mangler
 * er en ulempe, en skjerm som ikke laster er en stopper.
 */
import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { prosjekter } from "@/db/schema";
import { abax } from "../abax/client";
import { lagTimeforslag, type ProsjektPunkt, type Timeforslag } from "../abax/timeforslag";
import type { Okt } from "../tilgang";

export async function hentTimeforslag(okt: Okt, dato: string): Promise<Timeforslag[]> {
  if (!okt.abaxVehicleId) return [];

  try {
    // Hele arbeidsdagen i norsk tid, med god margin i begge ender.
    const fra = new Date(`${dato}T00:00:00+01:00`);
    const til = new Date(`${dato}T23:59:59+01:00`);

    const turer = await abax.turer({ fra, til, kjoretoyId: okt.abaxVehicleId });
    if (turer.length === 0) return [];

    const rader = await db
      .select({
        id: prosjekter.id,
        nummer: prosjekter.nummer,
        navn: prosjekter.navn,
        lat: prosjekter.lat,
        lon: prosjekter.lon,
        farge: prosjekter.farge,
      })
      .from(prosjekter)
      .where(
        and(
          eq(prosjekter.tenantId, okt.tenantId),
          eq(prosjekter.aktiv, true),
          isNotNull(prosjekter.lat),
          isNotNull(prosjekter.lon),
        ),
      );

    const punkter: ProsjektPunkt[] = rader.flatMap((r) => {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      return [{ id: r.id, nummer: r.nummer, navn: r.navn, lat, lon, farge: r.farge }];
    });

    if (punkter.length === 0) return [];
    return lagTimeforslag(turer, punkter);
  } catch (feil) {
    console.error("Klarte ikke å hente kjørebok fra ABAX", feil);
    return [];
  }
}
