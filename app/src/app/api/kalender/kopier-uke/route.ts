/**
 * Kopierer en hel uke med tildelinger til en annen uke.
 *
 * Finnes fordi ukene ligner hverandre. Et lag står på samme bygg i tre
 * uker, og å sette opp det samme rutenettet på nytt hver fredag er
 * tjue klikk som ikke gir noen ny opplysning.
 *
 * Pakkelistene følger ikke med. De handler om hva som manglet akkurat
 * den uka, og en kopi av dem ville sagt at noe er pakket når det ikke er
 * det — verre enn ingen liste.
 */
import { NextResponse } from "next/server";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte, prosjekter, tildelinger } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

const Dato = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Kopi = z.object({
  /** Mandagen i uka det kopieres FRA. */
  fraMandag: Dato,
  /** Mandagen i uka det kopieres TIL. */
  tilMandag: Dato,
});

function leggTilDager(dato: string, dager: number): string {
  const d = new Date(`${dato}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

export const POST = endepunkt(Kopi, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const fraSondag = leggTilDager(data.fraMandag, 6);
  const tilSondag = leggTilDager(data.tilMandag, 6);

  const kilde = await db
    .select({
      ansattId: tildelinger.ansattId,
      prosjektId: tildelinger.prosjektId,
      dato: tildelinger.dato,
      fraKl: tildelinger.fraKl,
      tilKl: tildelinger.tilKl,
      notat: tildelinger.notat,
      avdeling: prosjekter.avdeling,
    })
    .from(tildelinger)
    .innerJoin(prosjekter, eq(prosjekter.id, tildelinger.prosjektId))
    .where(
      and(
        eq(tildelinger.tenantId, okt.tenantId),
        gte(tildelinger.dato, data.fraMandag),
        lte(tildelinger.dato, fraSondag),
        // En leder kopierer sin egen avdeling, ikke de andres.
        ...(okt.rolle === "admin" ? [] : [eq(prosjekter.avdeling, okt.avdeling)]),
      ),
    );

  if (kilde.length === 0) {
    return NextResponse.json({ feil: "Uka du kopierer fra er tom." }, { status: 400 });
  }

  // Bare aktive montører. Har noen sluttet i mellomtiden, skal ikke
  // jobbene deres dukke opp igjen på en rad som ikke finnes.
  const aktive = await db
    .select({ id: ansatte.id })
    .from(ansatte)
    .where(
      and(
        eq(ansatte.tenantId, okt.tenantId),
        eq(ansatte.aktiv, true),
        inArray(ansatte.id, [...new Set(kilde.map((k) => k.ansattId))]),
      ),
    );
  const kanTildeles = new Set(aktive.map((a) => a.id));

  // Hva står der fra før? Kopieringen skal legge til, ikke overskrive —
  // og den skal kunne kjøres to ganger uten å doble alt.
  const finnes = await db
    .select({
      ansattId: tildelinger.ansattId,
      prosjektId: tildelinger.prosjektId,
      dato: tildelinger.dato,
    })
    .from(tildelinger)
    .where(
      and(
        eq(tildelinger.tenantId, okt.tenantId),
        gte(tildelinger.dato, data.tilMandag),
        lte(tildelinger.dato, tilSondag),
      ),
    );
  const alt = new Set(finnes.map((f) => `${f.ansattId}|${f.prosjektId}|${f.dato}`));

  const forskyvning = Math.round(
    (new Date(`${data.tilMandag}T00:00:00Z`).getTime() -
      new Date(`${data.fraMandag}T00:00:00Z`).getTime()) /
      86_400_000,
  );

  const nye = kilde
    .filter((k) => kanTildeles.has(k.ansattId))
    .map((k) => ({
      tenantId: okt.tenantId,
      ansattId: k.ansattId,
      prosjektId: k.prosjektId,
      dato: leggTilDager(k.dato, forskyvning),
      fraKl: k.fraKl,
      tilKl: k.tilKl,
      notat: k.notat,
    }))
    .filter((n) => !alt.has(`${n.ansattId}|${n.prosjektId}|${n.dato}`));

  if (nye.length === 0) {
    return NextResponse.json({ opprettet: 0, hoppetOver: kilde.length });
  }

  await db.insert(tildelinger).values(nye);

  await loggEndring(okt, {
    handling: "kalender.uke_kopiert",
    tabell: "tildelinger",
    etter: {
      fraMandag: data.fraMandag,
      tilMandag: data.tilMandag,
      opprettet: nye.length,
      hoppetOver: kilde.length - nye.length,
    },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({
    opprettet: nye.length,
    hoppetOver: kilde.length - nye.length,
  });
});
