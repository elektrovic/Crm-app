/**
 * Notater på kunden.
 *
 * «Ringte Bjørn, han kommer tilbake i uke 42.» Det er den billigste måten
 * å huske en samtale på, og den eneste som virker: alt annet i systemet
 * krever at samtalen først ble til en sak.
 *
 * Tabellen `kundehistorikk` fantes fra før, men ingenting skrev til den
 * utenom demodata. Nå gjør den det.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { kundehistorikk, kunder } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

const ISO_DATO = /^\d{4}-\d{2}-\d{2}$/;

const Ny = z.object({
  kundeId: z.uuid(),
  hendelse: z.string().trim().min(1, "Skriv hva som skjedde.").max(500),
  /** Når det skjedde. Tom betyr i dag — man noterer som oftest i etterkant. */
  dato: z.string().regex(ISO_DATO).nullish(),
});

const Fjerning = z.object({ id: z.uuid(), slett: z.literal(true) });

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const kunde = await db.query.kunder.findFirst({
    where: and(eq(kunder.id, data.kundeId), eq(kunder.tenantId, okt.tenantId)),
  });
  if (!kunde) return NextResponse.json({ feil: "Ukjent kunde." }, { status: 400 });

  const [rad] = await db
    .insert(kundehistorikk)
    .values({
      tenantId: okt.tenantId,
      kundeId: kunde.id,
      hendelse: data.hendelse,
      dato: data.dato ?? new Date().toISOString().slice(0, 10),
      ansattId: okt.id,
    })
    .returning({ id: kundehistorikk.id });

  await loggEndring(okt, {
    handling: "kundenotat.skrevet",
    tabell: "kundehistorikk",
    radId: rad?.id,
    for: null,
    etter: { kunde: kunde.navn, hendelse: data.hendelse },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});

export const DELETE = endepunkt(Fjerning, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.kundehistorikk.findFirst({
    where: and(eq(kundehistorikk.id, data.id), eq(kundehistorikk.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent notat." }, { status: 404 });

  await db.delete(kundehistorikk).where(eq(kundehistorikk.id, rad.id));
  await loggEndring(okt, {
    handling: "kundenotat.slettet",
    tabell: "kundehistorikk",
    radId: rad.id,
    for: { hendelse: rad.hendelse, dato: rad.dato },
    etter: null,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ slettet: true });
});
