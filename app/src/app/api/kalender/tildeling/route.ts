/**
 * Tildelinger: hvem skal hvor, hvilken dag.
 *
 * Bare ledelsen setter opp folk. En montør kan krysse av på pakkelista si
 * (se medbring), men ikke flytte seg selv til en annen jobb.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte, prosjekter, tildelinger } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

const Dato = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være på formen ÅÅÅÅ-MM-DD");
const Klokke = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Klokkeslett må være på formen TT:MM")
  .nullish();

const Ny = z.object({
  ansattId: z.uuid(),
  prosjektId: z.uuid(),
  dato: Dato,
  /** Siste dag, når jobben går over flere dager. Tom = bare «dato». */
  tilDato: Dato.nullish(),
  fraKl: Klokke,
  tilKl: Klokke,
  notat: z.string().max(2000).nullish(),
});

const Endring = z.object({
  id: z.uuid(),
  fraKl: Klokke,
  tilKl: Klokke,
  notat: z.string().max(2000).nullish(),
  /**
   * Flytting i rutenettet: ny dag, ny montør, eller begge.
   *
   * Står de tomme, blir jobben der den er. Da kan samme kall brukes til
   * å bare rette klokkeslettet, uten at den flytter seg utilsiktet.
   */
  dato: Dato.optional(),
  ansattId: z.uuid().optional(),
  /** Sann sletter tildelingen. Pakkelista følger med. */
  slett: z.boolean().optional(),
});

/** Ukedagene mellom to datoer. Helg tas med — beredskap går på søndag òg. */
function dagerMellom(fra: string, til: string): string[] {
  const ut: string[] = [];
  const d = new Date(`${fra}T00:00:00Z`);
  const slutt = new Date(`${til}T00:00:00Z`);
  // 60 dager er rikelig for en planlegging, og hindrer at en skrivefeil i
  // årstallet lager titusen rader.
  for (let i = 0; i <= 60 && d <= slutt; i += 1) {
    ut.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return ut;
}

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const [montor, prosjekt] = await Promise.all([
    db.query.ansatte.findFirst({
      where: and(
        eq(ansatte.id, data.ansattId),
        eq(ansatte.tenantId, okt.tenantId),
        eq(ansatte.aktiv, true),
      ),
    }),
    db.query.prosjekter.findFirst({
      where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
    }),
  ]);
  if (!montor) return NextResponse.json({ feil: "Ukjent eller sluttet ansatt." }, { status: 400 });
  if (!prosjekt) return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });

  const datoer =
    data.tilDato && data.tilDato > data.dato
      ? dagerMellom(data.dato, data.tilDato)
      : [data.dato];

  const rader = await db
    .insert(tildelinger)
    .values(
      datoer.map((dato) => ({
        tenantId: okt.tenantId,
        prosjektId: prosjekt.id,
        ansattId: montor.id,
        dato,
        fraKl: data.fraKl ?? null,
        tilKl: data.tilKl ?? null,
        notat: data.notat ?? null,
      })),
    )
    .returning({ id: tildelinger.id, dato: tildelinger.dato });

  await loggEndring(okt, {
    handling: "tildeling.opprettet",
    tabell: "tildelinger",
    radId: rader[0]?.id,
    for: null,
    etter: {
      ansatt: montor.navn,
      prosjekt: `${prosjekt.nummer} ${prosjekt.navn}`,
      datoer: datoer.join(", "),
      fraKl: data.fraKl ?? null,
      tilKl: data.tilKl ?? null,
    },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ opprettet: rader.length, ider: rader.map((r) => r.id) });
});

export const PATCH = endepunkt(Endring, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const fraFor = await db.query.tildelinger.findFirst({
    where: and(eq(tildelinger.id, data.id), eq(tildelinger.tenantId, okt.tenantId)),
  });
  if (!fraFor) return NextResponse.json({ feil: "Ukjent tildeling." }, { status: 404 });

  if (data.slett) {
    // Pakkelista henger på tildelingen med cascade, så den forsvinner med.
    // Det er riktig: en liste for en jobb som ikke skal skje er støy.
    await db.delete(tildelinger).where(eq(tildelinger.id, fraFor.id));
    await loggEndring(okt, {
      handling: "tildeling.slettet",
      tabell: "tildelinger",
      radId: fraFor.id,
      for: { dato: fraFor.dato, fraKl: fraFor.fraKl, tilKl: fraFor.tilKl },
      etter: null,
      ipAdresse: ipFra(request),
    });
    return NextResponse.json({ slettet: true });
  }

  // Flyttes jobben til en annen montør, må den montøren finnes, være
  // aktiv og høre til oss. En ID fra nettleseren er ikke et bevis.
  if (data.ansattId && data.ansattId !== fraFor.ansattId) {
    const montor = await db.query.ansatte.findFirst({
      where: and(
        eq(ansatte.id, data.ansattId),
        eq(ansatte.tenantId, okt.tenantId),
        eq(ansatte.aktiv, true),
      ),
      columns: { id: true },
    });
    if (!montor) return NextResponse.json({ feil: "Ukjent montør." }, { status: 400 });
  }

  const endringer = {
    fraKl: data.fraKl ?? null,
    tilKl: data.tilKl ?? null,
    notat: data.notat ?? null,
    ...(data.dato ? { dato: data.dato } : {}),
    ...(data.ansattId ? { ansattId: data.ansattId } : {}),
  };
  await db.update(tildelinger).set(endringer).where(eq(tildelinger.id, fraFor.id));

  await loggEndring(okt, {
    handling: "tildeling.endret",
    tabell: "tildelinger",
    radId: fraFor.id,
    for: {
      fraKl: fraFor.fraKl,
      tilKl: fraFor.tilKl,
      notat: fraFor.notat,
      dato: fraFor.dato,
      ansattId: fraFor.ansattId,
    },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: fraFor.id });
});
