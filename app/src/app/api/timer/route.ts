/**
 * Mottar timeføringer fra sendekøen.
 *
 * Rekkefølgen er viktig: vi lagrer lokalt FØR vi sender til Tripletex.
 * Da har vi raden hvis Tripletex er nede, og montøren har fått kvittering
 * på at timene er registrert selv om de ennå ikke er kommet fram.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prosjekter, timeforinger } from "@/db/schema";
import { krevOkt, krevTilgangTilAnsatt, IkkeInnloggetFeil, IngenTilgangFeil } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";
import { LaastPeriodeFeil, tripletex } from "@/lib/tripletex/client";

const Skjema = z.object({
  klientNokkel: z.string().min(8).max(64),
  prosjektId: z.uuid(),
  dato: z.iso.date(),
  timer: z.number().positive().max(24),
  aktivitetId: z.number().int().positive(),
  kommentar: z.string().max(2000).optional(),
  fraKjorebok: z.boolean().default(false),
  /** Ledere kan føre på vegne av andre; montører kan ikke. */
  ansattId: z.uuid().optional(),
});

export async function POST(request: Request) {
  let okt;
  try {
    okt = await krevOkt();
  } catch (e) {
    if (e instanceof IkkeInnloggetFeil) {
      return NextResponse.json({ feil: "Ikke innlogget." }, { status: 401 });
    }
    throw e;
  }

  const kropp = await request.json().catch(() => null);
  const lest = Skjema.safeParse(kropp);
  if (!lest.success) {
    return NextResponse.json(
      { feil: "Ugyldig innhold i forespørselen.", detaljer: lest.error.issues },
      { status: 400 },
    );
  }
  const input = lest.data;
  const ansattId = input.ansattId ?? okt.id;

  try {
    krevTilgangTilAnsatt(okt, ansattId);
  } catch (e) {
    if (e instanceof IngenTilgangFeil) {
      return NextResponse.json({ feil: e.message }, { status: 403 });
    }
    throw e;
  }

  // Idempotens: har vi sett denne nøkkelen før, svarer vi som om det gikk bra.
  // Uten dette ville et gjensendt kall fra køen ført de samme timene to ganger.
  const fraFor = await db.query.timeforinger.findFirst({
    where: and(
      eq(timeforinger.tenantId, okt.tenantId),
      eq(timeforinger.klientNokkel, input.klientNokkel),
    ),
  });
  if (fraFor) {
    return NextResponse.json({ id: fraFor.id, status: fraFor.status, gjentakelse: true });
  }

  // Prosjektet må tilhøre samme kunde. Ellers kunne en klient ført timer
  // på et prosjekt den ikke har noe med å gjøre.
  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, input.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  const [rad] = await db
    .insert(timeforinger)
    .values({
      tenantId: okt.tenantId,
      ansattId,
      prosjektId: prosjekt.id,
      dato: input.dato,
      timer: String(input.timer),
      aktivitetId: input.aktivitetId,
      kommentar: input.kommentar,
      fraKjorebok: input.fraKjorebok,
      klientNokkel: input.klientNokkel,
      status: "sender",
    })
    .returning();

  if (!rad) {
    return NextResponse.json({ feil: "Klarte ikke å lagre timeføringen." }, { status: 500 });
  }

  await loggEndring(okt, {
    handling: "timeforing.opprettet",
    tabell: "timeforinger",
    radId: rad.id,
    etter: { dato: input.dato, timer: input.timer, prosjekt: prosjekt.nummer },
    ipAdresse: request.headers.get("x-forwarded-for") ?? undefined,
  });

  if (!okt.tripletexEmployeeId) {
    await db
      .update(timeforinger)
      .set({ status: "feilet", feilmelding: "Brukeren mangler kobling til Tripletex-ansatt." })
      .where(eq(timeforinger.id, rad.id));
    return NextResponse.json(
      { feil: "Brukeren din mangler kobling til Tripletex. Si fra til leder." },
      { status: 400 },
    );
  }

  try {
    const svar = await tripletex.fortimer({
      ansattId: okt.tripletexEmployeeId,
      prosjektId: prosjekt.tripletexProjectId,
      aktivitetId: input.aktivitetId,
      dato: input.dato,
      timer: input.timer,
      kommentar: input.kommentar,
    });

    await db
      .update(timeforinger)
      .set({ status: "sendt", tripletexEntryId: svar.id, sendt: new Date(), feilmelding: null })
      .where(eq(timeforinger.id, rad.id));

    return NextResponse.json({ id: rad.id, status: "sendt", tripletexEntryId: svar.id });
  } catch (feil) {
    // Låst periode er ikke en teknisk feil — montøren skal få vite hvorfor,
    // og linja skal ikke prøves på nytt automatisk.
    if (feil instanceof LaastPeriodeFeil) {
      await db
        .update(timeforinger)
        .set({ status: "laast", feilmelding: feil.message })
        .where(eq(timeforinger.id, rad.id));
      return NextResponse.json(
        { feil: `Perioden er låst i Tripletex. Ta kontakt med leder.` },
        { status: 409 },
      );
    }

    const melding = feil instanceof Error ? feil.message : "Ukjent feil mot Tripletex.";
    await db
      .update(timeforinger)
      .set({ status: "feilet", feilmelding: melding, forsok: rad.forsok + 1 })
      .where(eq(timeforinger.id, rad.id));

    console.error("Timeføring feilet mot Tripletex", { radId: rad.id, feil });

    // 502 signaliserer til køen at dette er verdt å prøve på nytt.
    return NextResponse.json(
      { feil: "Tripletex svarte ikke. Timene ligger lagret og sendes på nytt." },
      { status: 502 },
    );
  }
}
