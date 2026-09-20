/**
 * SMS til kunde, før eller etter et oppdrag.
 *
 * Sendes bare når en montør har trykket på knappen, og alltid til ett
 * nummer av gangen. Alt som går ut logges med hvem som sendte, hva som sto
 * der og hva leverandøren svarte.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { prosjekter, smsLogg, SMS_ANLEDNING } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { sendSms, SmsFeil } from "@/lib/sms/client";
import { normaliserNummer, UgyldigNummerFeil } from "@/lib/sms/telefon";

const Skjema = z.object({
  klientNokkel: z.string().min(8).max(64),
  prosjektId: z.uuid(),
  anledning: z.enum(SMS_ANLEDNING),
  mottaker: z.string().min(3).max(40),
  /** Teksten montøren faktisk så på skjermen, ikke en ny som lages her. */
  melding: z.string().min(1).max(900),
});

export const POST = endepunkt(Skjema, async ({ okt, data, request }) => {
  const fraFor = await db.query.smsLogg.findFirst({
    where: and(eq(smsLogg.tenantId, okt.tenantId), eq(smsLogg.klientNokkel, data.klientNokkel)),
  });
  if (fraFor) {
    // Uten dette ville et gjensendt kall sendt kunden den samme meldingen igjen.
    return NextResponse.json({ id: fraFor.id, sendt: fraFor.sendt, gjentakelse: true });
  }

  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  let nummer: string;
  try {
    nummer = normaliserNummer(data.mottaker);
  } catch (feil) {
    if (feil instanceof UgyldigNummerFeil) {
      return NextResponse.json(
        { feil: `${data.mottaker} ser ikke ut som et mobilnummer. Sjekk kontaktinfoen.` },
        { status: 400 },
      );
    }
    throw feil;
  }

  // Loggraden skrives før sendingen, slik at et forsøk aldri forsvinner.
  const [rad] = await db
    .insert(smsLogg)
    .values({
      tenantId: okt.tenantId,
      prosjektId: prosjekt.id,
      ansattId: okt.id,
      anledning: data.anledning,
      mottaker: nummer,
      melding: data.melding,
      klientNokkel: data.klientNokkel,
    })
    .returning();

  try {
    const resultat = await sendSms({ til: nummer, melding: data.melding });

    if (rad) {
      await db
        .update(smsLogg)
        .set({ sendt: true, leverandorId: resultat.leverandorId })
        .where(eq(smsLogg.id, rad.id));
    }

    await loggEndring(okt, {
      handling: "sms.sendt",
      tabell: "sms_logg",
      radId: rad?.id,
      etter: { prosjekt: prosjekt.nummer, anledning: data.anledning, mottaker: nummer },
      ipAdresse: ipFra(request),
    });

    return NextResponse.json({ id: rad?.id, sendt: true });
  } catch (feil) {
    const melding = feil instanceof Error ? feil.message : "Ukjent feil.";
    if (rad) {
      await db.update(smsLogg).set({ feilmelding: melding }).where(eq(smsLogg.id, rad.id));
    }
    console.error("SMS gikk ikke ut", { prosjekt: prosjekt.nummer, feil });

    const kanProvesIgjen = feil instanceof SmsFeil && feil.kanProvesIgjen;
    return NextResponse.json(
      { feil: "Meldingen gikk ikke ut. Prøv igjen, eller ring kunden." },
      { status: kanProvesIgjen ? 502 : 400 },
    );
  }
});
