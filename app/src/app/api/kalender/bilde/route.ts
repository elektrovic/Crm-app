/**
 * Bilder lagt på et prosjekt fra planleggingen.
 *
 * Montørenes egne bilder kommer inn via tilleggsregistreringen og havner i
 * samme tabell. Dette er den andre veien: lederen legger på en skisse, et
 * bilde av tavla, et utsnitt av en tegning — før noen har vært der.
 *
 * Én ting å være klar over: oppryddingen i `lib/vedlegg/opprydding.ts`
 * sletter bare lokale kopier Tripletex har bekreftet at de har. Disse
 * bildene lastes ikke opp dit, så de blir stående. Det er riktig oppførsel
 * (regel 1: vi rydder aldri bort den eneste kopien som finnes), men det
 * betyr at de ligger i databasen til noen fjerner dem. Derfor taket under.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prosjekter, vedlegg } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

/** Slaget som skiller planleggingsbilder fra montørenes egne. */
export const PLANLEGGING = "planlegging";

/** Databasen er ikke et bildearkiv. Taket holder den fra å bli det. */
const MAKS_BYTE = 1_500_000;
const MAKS_PER_PROSJEKT = 8;

const Ny = z.object({
  prosjektId: z.uuid(),
  mimetype: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(1),
});

const Fjerning = z.object({ id: z.uuid(), slett: z.literal(true) });

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });

  const storrelse = Math.floor((data.base64.length * 3) / 4);
  if (storrelse > MAKS_BYTE) {
    return NextResponse.json(
      { feil: `Bildet er for stort (${Math.round(storrelse / 1000)} kB av maks 1500 kB).` },
      { status: 413 },
    );
  }

  const fraFor = await db
    .select({ id: vedlegg.id })
    .from(vedlegg)
    .where(
      and(
        eq(vedlegg.tenantId, okt.tenantId),
        eq(vedlegg.prosjektId, prosjekt.id),
        eq(vedlegg.slag, PLANLEGGING),
      ),
    );
  if (fraFor.length >= MAKS_PER_PROSJEKT) {
    return NextResponse.json(
      { feil: `Maks ${MAKS_PER_PROSJEKT} planleggingsbilder per prosjekt. Fjern ett først.` },
      { status: 409 },
    );
  }

  const [rad] = await db
    .insert(vedlegg)
    .values({
      tenantId: okt.tenantId,
      prosjektId: prosjekt.id,
      slag: PLANLEGGING,
      mimetype: data.mimetype,
      data: data.base64,
      storrelse,
      lastetOppAv: okt.id,
    })
    .returning({ id: vedlegg.id });

  await loggEndring(okt, {
    handling: "planleggingsbilde.lastet_opp",
    tabell: "vedlegg",
    radId: rad?.id,
    for: null,
    etter: { prosjekt: `${prosjekt.nummer} ${prosjekt.navn}`, storrelse },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id, storrelse });
});

export const DELETE = endepunkt(Fjerning, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.vedlegg.findFirst({
    where: and(eq(vedlegg.id, data.id), eq(vedlegg.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent bilde." }, { status: 404 });

  // Bare planleggingsbilder. Montørens dokumentasjon fra en ferdig jobb
  // slettes ikke herfra — den kan være eneste kopi før Tripletex har den.
  if (rad.slag !== PLANLEGGING) {
    return NextResponse.json(
      { feil: "Dette er ikke et planleggingsbilde." },
      { status: 403 },
    );
  }

  await db.delete(vedlegg).where(eq(vedlegg.id, rad.id));
  await loggEndring(okt, {
    handling: "planleggingsbilde.fjernet",
    tabell: "vedlegg",
    radId: rad.id,
    for: { slag: rad.slag, storrelse: rad.storrelse },
    etter: null,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ slettet: true });
});
