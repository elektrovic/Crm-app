/**
 * Pakkelista.
 *
 * To veier inn, og de har hver sin eier:
 *
 * - POST: ledelsen setter opp hva som skal med. Linjene kan hakes av fra
 *   manglene prosjektet alt har, eller skrives fritt.
 * - PATCH: montøren krysser av at den ligger i bilen. Det er den ene
 *   skrivingen en montør får gjøre her, og bare på sin egen jobb.
 *
 * Teksten kopieres fra mangelen i stedet for å slås opp hver gang. Retter
 * noen mangelteksten neste uke, skal ikke gårsdagens pakkeliste endre seg
 * under føttene på den som brukte den.
 */
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mangler, medbring, tildelinger } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

const Ny = z.object({
  tildelingId: z.uuid(),
  /** Mangler som skal med, valgt fra prosjektets egen liste. */
  mangelIder: z.array(z.uuid()).max(100).default([]),
  /** Linjer skrevet fritt — stige, skjøteledning, en bestemt nøkkel. */
  fritekst: z
    .array(
      z.object({
        tekst: z.string().min(1).max(300),
        antall: z.string().max(40).nullish(),
        enhet: z.string().max(20).default("STK"),
      }),
    )
    .max(50)
    .default([]),
});

const Avkryssing = z.object({
  id: z.uuid(),
  pakket: z.boolean(),
});

const Fjerning = z.object({ id: z.uuid(), slett: z.literal(true) });

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const tildeling = await db.query.tildelinger.findFirst({
    where: and(eq(tildelinger.id, data.tildelingId), eq(tildelinger.tenantId, okt.tenantId)),
  });
  if (!tildeling) return NextResponse.json({ feil: "Ukjent tildeling." }, { status: 404 });

  // Manglene må høre til samme prosjekt som jobben. Uten den sjekken kunne
  // en ID fra et annet prosjekt snike seg inn via forespørselen.
  const valgte = data.mangelIder.length
    ? await db
        .select({
          id: mangler.id,
          tekst: mangler.tekst,
          antall: mangler.antall,
          enhet: mangler.enhet,
        })
        .from(mangler)
        .where(
          and(
            eq(mangler.tenantId, okt.tenantId),
            eq(mangler.prosjektId, tildeling.prosjektId),
            inArray(mangler.id, data.mangelIder),
          ),
        )
    : [];

  if (valgte.length !== data.mangelIder.length) {
    return NextResponse.json(
      { feil: "Minst én mangel hører ikke til dette prosjektet." },
      { status: 400 },
    );
  }

  const fraFor = await db
    .select({ n: medbring.id })
    .from(medbring)
    .where(eq(medbring.tildelingId, tildeling.id));

  const linjer = [
    ...valgte.map((m, i) => ({
      tenantId: okt.tenantId,
      tildelingId: tildeling.id,
      mangelId: m.id,
      tekst: m.tekst,
      antall: m.antall,
      enhet: m.enhet,
      sortering: fraFor.length + i,
    })),
    ...data.fritekst.map((f, i) => ({
      tenantId: okt.tenantId,
      tildelingId: tildeling.id,
      mangelId: null,
      tekst: f.tekst,
      antall: f.antall ?? null,
      enhet: f.enhet,
      sortering: fraFor.length + valgte.length + i,
    })),
  ];

  if (linjer.length === 0) {
    return NextResponse.json({ feil: "Ingenting å legge til." }, { status: 400 });
  }

  const rader = await db.insert(medbring).values(linjer).returning({ id: medbring.id });

  await loggEndring(okt, {
    handling: "medbring.lagt_til",
    tabell: "medbring",
    radId: rader[0]?.id,
    for: null,
    etter: { antallLinjer: rader.length, tekster: linjer.map((l) => l.tekst) },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ lagtTil: rader.length });
});

/**
 * Avkryssing. Montøren eier denne på sin egen jobb; ledelsen kan også
 * krysse av, for den som ringer inn fra bilen.
 */
export const PATCH = endepunkt(Avkryssing, async ({ okt, data, request }) => {
  const [rad] = await db
    .select({
      id: medbring.id,
      pakket: medbring.pakket,
      tekst: medbring.tekst,
      ansattId: tildelinger.ansattId,
    })
    .from(medbring)
    .innerJoin(tildelinger, eq(medbring.tildelingId, tildelinger.id))
    .where(and(eq(medbring.id, data.id), eq(medbring.tenantId, okt.tenantId)));

  if (!rad) return NextResponse.json({ feil: "Ukjent linje." }, { status: 404 });
  if (okt.rolle === "montor" && rad.ansattId !== okt.id) {
    return NextResponse.json({ feil: "Dette er ikke din jobb." }, { status: 403 });
  }

  // Flagg og tidspunkt holdes i takt, så de aldri sier hver sin ting.
  await db
    .update(medbring)
    .set({ pakket: data.pakket, pakketTidspunkt: data.pakket ? new Date() : null })
    .where(eq(medbring.id, rad.id));

  await loggEndring(okt, {
    handling: data.pakket ? "medbring.pakket" : "medbring.angret",
    tabell: "medbring",
    radId: rad.id,
    for: { pakket: rad.pakket },
    etter: { pakket: data.pakket, tekst: rad.tekst },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id, pakket: data.pakket });
});

export const DELETE = endepunkt(Fjerning, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.medbring.findFirst({
    where: and(eq(medbring.id, data.id), eq(medbring.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent linje." }, { status: 404 });

  await db.delete(medbring).where(eq(medbring.id, rad.id));
  await loggEndring(okt, {
    handling: "medbring.fjernet",
    tabell: "medbring",
    radId: rad.id,
    for: { tekst: rad.tekst },
    etter: null,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ slettet: true });
});
