/**
 * Samtalene fra Pocket.
 *
 * To ting kan gjøres med dem: koble en samtale til riktig kunde, og gjøre
 * et av Pocket sine forslag om til en ekte oppfølging med frist.
 *
 * Forslagene blir aldri oppfølginger av seg selv. Oppfølgingslista er den
 * ene lista som må kunne stoles på, og en AI som fyller den med gjetninger
 * ødelegger nettopp det.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { kunder, oppfolginger, samtaler } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

const ISO_DATO = /^\d{4}-\d{2}-\d{2}$/;

const Kobling = z.object({
  id: z.uuid(),
  kundeId: z.uuid().nullable(),
});

const Forslag = z.object({
  id: z.uuid(),
  /** Teksten slik den sto i forslaget. Den er nøkkelen vi merker brukt. */
  oppgave: z.string().trim().min(1).max(300),
  frist: z.string().regex(ISO_DATO),
});

/** Kobler samtalen til en kunde — eller løsner den igjen. */
export const PATCH = endepunkt(Kobling, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.samtaler.findFirst({
    where: and(eq(samtaler.id, data.id), eq(samtaler.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent samtale." }, { status: 404 });

  if (data.kundeId) {
    const k = await db.query.kunder.findFirst({
      where: and(eq(kunder.id, data.kundeId), eq(kunder.tenantId, okt.tenantId)),
    });
    if (!k) return NextResponse.json({ feil: "Ukjent kunde." }, { status: 400 });
  }

  await db
    .update(samtaler)
    // Bekreftet når et menneske satte den. Da skal ingen senere gjetning
    // overskrive valget.
    .set({ kundeId: data.kundeId, koblingBekreftet: data.kundeId !== null })
    .where(eq(samtaler.id, rad.id));

  await loggEndring(okt, {
    handling: "samtale.koblet",
    tabell: "samtaler",
    radId: rad.id,
    for: { kundeId: rad.kundeId },
    etter: { kundeId: data.kundeId },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id, kundeId: data.kundeId });
});

/** Gjør et forslag om til en oppfølging. */
export const POST = endepunkt(Forslag, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.samtaler.findFirst({
    where: and(eq(samtaler.id, data.id), eq(samtaler.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent samtale." }, { status: 404 });

  // Forslaget må finnes på samtalen. En tekst fra forespørselen er ikke et
  // bevis på at Pocket faktisk foreslo noe.
  if (!(rad.oppgaver ?? []).includes(data.oppgave)) {
    return NextResponse.json(
      { feil: "Dette forslaget hører ikke til samtalen." },
      { status: 400 },
    );
  }

  const [o] = await db
    .insert(oppfolginger)
    .values({
      tenantId: okt.tenantId,
      kundeId: rad.kundeId,
      hva: data.oppgave,
      frist: data.frist,
      ansvarlig: okt.id,
    })
    .returning({ id: oppfolginger.id });

  const brukt = [...new Set([...(rad.oppgaverBrukt ?? []), data.oppgave])];
  await db.update(samtaler).set({ oppgaverBrukt: brukt }).where(eq(samtaler.id, rad.id));

  await loggEndring(okt, {
    handling: "samtale.forslag_tatt_i_bruk",
    tabell: "oppfolginger",
    radId: o?.id,
    for: null,
    etter: { hva: data.oppgave, frist: data.frist, fraSamtale: rad.pocketId },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ oppfolgingId: o?.id });
});
