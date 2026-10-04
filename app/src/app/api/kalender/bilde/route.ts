/**
 * Bilder på en jobb.
 *
 * To slag, med hver sin eier:
 *
 * - «planlegging»: lederen legger på en skisse, et bilde av tavla, et
 *   utsnitt av en tegning — før noen har vært der.
 * - «jobb»: montøren tar bilde på stedet. Dokumentasjon av det han fant.
 *
 * Begge havner i dokumentarkivet på prosjektet i Tripletex. Ikke herfra —
 * telefonen står gjerne med én strek dekning når bildet tas, og en
 * opplasting til en tredjepart midt i den forespørselen ville gjort at
 * bildet gikk tapt hvis Tripletex var treg. Bildet lagres først hos oss,
 * og den planlagte synken sender det videre. Se lib/tripletex/vedleggsko.
 *
 * Forespørselen peker på en tildeling, ikke på et prosjekt. Da arver
 * bildet tilgangen til jobben, og ingen kan laste opp til et prosjekt de
 * ikke har noe med å gjøre ved å gjette en ID.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prosjekter, tildelinger, vedlegg } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";

export const PLANLEGGING = "planlegging";
export const FRA_JOBBEN = "jobb";

/** Databasen er ikke et bildearkiv. Tripletex er. Takene holder den fra det. */
const MAKS_BYTE = 1_500_000;
const MAKS_PLANLEGGING_PER_PROSJEKT = 8;
const MAKS_JOBBBILDER_PER_TILDELING = 20;

const Ny = z.object({
  tildelingId: z.uuid(),
  slag: z.enum([PLANLEGGING, FRA_JOBBEN]),
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1),
});

const Fjerning = z.object({ id: z.uuid(), slett: z.literal(true) });

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  const [jobb] = await db
    .select({
      tildelingId: tildelinger.id,
      ansattId: tildelinger.ansattId,
      prosjektId: prosjekter.id,
      nummer: prosjekter.nummer,
      navn: prosjekter.navn,
      avdeling: prosjekter.avdeling,
    })
    .from(tildelinger)
    .innerJoin(prosjekter, eq(tildelinger.prosjektId, prosjekter.id))
    .where(and(eq(tildelinger.id, data.tildelingId), eq(tildelinger.tenantId, okt.tenantId)));

  if (!jobb) return NextResponse.json({ feil: "Ukjent jobb." }, { status: 404 });

  const erLedelse = okt.rolle !== "montor";
  const erMin = jobb.ansattId === okt.id;

  // Planlegging er ledelsens. Bilder fra jobben kan tas av den som faktisk
  // er satt opp på den — eller av ledelsen, for den som ringer inn.
  if (data.slag === PLANLEGGING && !erLedelse) {
    return NextResponse.json({ feil: "Bare ledelsen legger på planleggingsbilder." }, { status: 403 });
  }
  if (!erLedelse && !erMin) {
    return NextResponse.json({ feil: "Dette er ikke din jobb." }, { status: 403 });
  }
  // En leder skal ikke kunne laste opp til en annen avdelings prosjekt.
  if (erLedelse && okt.rolle !== "admin" && jobb.avdeling !== okt.avdeling) {
    return NextResponse.json({ feil: "Jobben hører til en annen avdeling." }, { status: 403 });
  }

  const storrelse = Math.floor((data.base64.length * 3) / 4);
  if (storrelse > MAKS_BYTE) {
    return NextResponse.json(
      { feil: `Bildet er for stort (${Math.round(storrelse / 1000)} kB av maks 1500 kB).` },
      { status: 413 },
    );
  }

  // Taket telles på prosjektet for planlegging, og på jobben for
  // dokumentasjon: ett prosjekt skal ha få skisser, men en lang jobb kan
  // godt ha mange bilder fra flere dager.
  const fraFor = await db
    .select({ id: vedlegg.id })
    .from(vedlegg)
    .where(
      and(
        eq(vedlegg.tenantId, okt.tenantId),
        eq(vedlegg.prosjektId, jobb.prosjektId),
        eq(vedlegg.slag, data.slag),
      ),
    );
  const tak =
    data.slag === PLANLEGGING ? MAKS_PLANLEGGING_PER_PROSJEKT : MAKS_JOBBBILDER_PER_TILDELING;
  if (fraFor.length >= tak) {
    return NextResponse.json(
      { feil: `Maks ${tak} bilder av dette slaget på prosjektet. Fjern ett først.` },
      { status: 409 },
    );
  }

  const [rad] = await db
    .insert(vedlegg)
    .values({
      tenantId: okt.tenantId,
      prosjektId: jobb.prosjektId,
      slag: data.slag,
      mimetype: data.mimetype,
      data: data.base64,
      storrelse,
      lastetOppAv: okt.id,
    })
    .returning({ id: vedlegg.id });

  await loggEndring(okt, {
    handling: data.slag === PLANLEGGING ? "planleggingsbilde.lastet_opp" : "jobbbilde.lastet_opp",
    tabell: "vedlegg",
    radId: rad?.id,
    for: null,
    etter: { prosjekt: `${jobb.nummer} ${jobb.navn}`, storrelse },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({
    id: rad?.id,
    storrelse,
    // Sies høyt, så ingen tror bildet alt ligger i Tripletex.
    tilTripletex: "ved neste synk",
  });
});

export const DELETE = endepunkt(Fjerning, async ({ okt, data, request }) => {
  const rad = await db.query.vedlegg.findFirst({
    where: and(eq(vedlegg.id, data.id), eq(vedlegg.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent bilde." }, { status: 404 });

  if (okt.rolle === "montor") {
    return NextResponse.json({ feil: "Bilder fjernes av ledelsen." }, { status: 403 });
  }

  // Et bilde Tripletex har, er dokumentasjon. Å slette vår kopi endrer
  // ingenting der — men å slette et bilde som ennå ikke er sendt, fjerner
  // den eneste kopien som finnes. Derfor sperren.
  if (!rad.tripletexLastetOpp && rad.slag !== PLANLEGGING) {
    return NextResponse.json(
      { feil: "Bildet er ikke kommet til Tripletex ennå. Vent til synken har tatt det." },
      { status: 409 },
    );
  }

  await db.delete(vedlegg).where(eq(vedlegg.id, rad.id));
  await loggEndring(okt, {
    handling: "bilde.fjernet",
    tabell: "vedlegg",
    radId: rad.id,
    for: { slag: rad.slag, storrelse: rad.storrelse, iTripletex: rad.tripletexLastetOpp !== null },
    etter: null,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ slettet: true });
});
