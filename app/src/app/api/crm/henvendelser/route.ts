/**
 * Henvendelser: registrer ny, og flytt mellom trinnene i pipelinen.
 *
 * Trinnet er det saksbehandleren har bestemt. AI-kolonnene røres ikke
 * herfra — de er et forslag, ikke en avgjørelse, og skal kunne
 * sammenlignes med hva mennesket faktisk valgte.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  ansatte,
  AVDELINGER,
  henvendelser,
  KANAL,
  kunder,
  oppfolginger,
  PIPELINE,
  prosjekter,
} from "@/db/schema";
import { velgKunde } from "@/lib/crm/kundetreff";

const ISO_DATO = /^\d{4}-\d{2}-\d{2}$/;
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";

const Ny = z.object({
  kanal: z.enum(KANAL),
  innhold: z.string().trim().min(1, "Skriv hva henvendelsen gjelder.").max(4000),
  avsenderNavn: z.string().trim().max(200).nullish(),
  avsenderTelefon: z.string().trim().max(40).nullish(),
  avsenderEpost: z.string().trim().max(200).nullish(),
  kundeId: z.uuid().nullish(),
  avdeling: z.enum(AVDELINGER).nullish(),
  sum: z.number().nonnegative().nullish(),
  /** Prosjektet saken ble til. Settes når den vinnes. */
  prosjektId: z.uuid().nullish(),
  /**
   * Frist for neste steg. Settes den, lages oppfølgingen i samme kall.
   *
   * Å registrere saken og å bestemme når noe skal skje er to handlinger i
   * hodet, men én ved telefonen. Krever den andre et nytt skjermbilde, blir
   * den ikke gjort — og da er saken glemt før den er ett minutt gammel.
   */
  frist: z.string().regex(ISO_DATO).nullish(),
});

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  // Kjenner vi nummeret, kobles saken til kunden med en gang. Avgjørelsen
  // ligger i velgKunde() med sine egne tester — den er lett å tro man har
  // fått riktig, og vanskelig å se at man ikke har.
  let kundeId = data.kundeId ?? null;
  if (!kundeId && data.avsenderTelefon) {
    const alle = await db
      .select({ id: kunder.id, telefon: kunder.telefon })
      .from(kunder)
      .where(eq(kunder.tenantId, okt.tenantId));
    kundeId = velgKunde(data.avsenderTelefon, alle);
  }

  const [rad] = await db
    .insert(henvendelser)
    .values({
      tenantId: okt.tenantId,
      kanal: data.kanal,
      innhold: data.innhold,
      avsenderNavn: data.avsenderNavn ?? null,
      avsenderTelefon: data.avsenderTelefon ?? null,
      avsenderEpost: data.avsenderEpost ?? null,
      kundeId,
      avdeling: data.avdeling ?? null,
      sum: data.sum === null || data.sum === undefined ? null : String(data.sum),
      prosjektId: data.prosjektId ?? null,
    })
    .returning();

  // Fristen lages etterpå, ikke i samme transaksjon. Går den galt, står
  // saken der likevel — og en registrert sak uten frist er mye bedre enn
  // en samtale som ikke ble skrevet ned i det hele tatt.
  let fristId: string | null = null;
  if (rad && data.frist) {
    const [o] = await db
      .insert(oppfolginger)
      .values({
        tenantId: okt.tenantId,
        henvendelseId: rad.id,
        kundeId,
        hva: data.avsenderNavn ? `Følg opp ${data.avsenderNavn}` : "Følg opp henvendelsen",
        frist: data.frist,
        ansvarlig: okt.id,
      })
      .returning({ id: oppfolginger.id });
    fristId = o?.id ?? null;
  }

  await loggEndring(okt, {
    handling: "henvendelse.opprettet",
    tabell: "henvendelser",
    radId: rad?.id,
    etter: {
      kanal: data.kanal,
      avdeling: data.avdeling,
      kjentKunde: kundeId !== null,
      frist: data.frist ?? null,
    },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id, kundeId, fristId });
});

const Endre = z.object({
  id: z.uuid(),
  trinn: z.enum(PIPELINE).optional(),
  ansvarlig: z.uuid().nullish(),
  avdeling: z.enum(AVDELINGER).nullish(),
  sum: z.number().nonnegative().nullish(),
  /** Prosjektet saken ble til. Settes når den vinnes. */
  prosjektId: z.uuid().nullish(),
});

export const PATCH = endepunkt(Endre, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.henvendelser.findFirst({
    where: and(eq(henvendelser.id, data.id), eq(henvendelser.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent henvendelse." }, { status: 404 });

  const endringer: Record<string, unknown> = {};
  if (data.trinn !== undefined) endringer.trinn = data.trinn;
  if (data.prosjektId !== undefined) {
    // Prosjektet må finnes og høre til oss. En ID fra forespørselen er
    // ikke et bevis på noe som helst.
    if (data.prosjektId) {
      const p = await db.query.prosjekter.findFirst({
        where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
      });
      if (!p) return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
    }
    endringer.prosjektId = data.prosjektId ?? null;
  }
  if (data.avdeling !== undefined) endringer.avdeling = data.avdeling ?? null;
  if (data.sum !== undefined) {
    endringer.sum = data.sum === null ? null : String(data.sum);
  }

  if (data.ansvarlig !== undefined) {
    if (data.ansvarlig) {
      const finnes = await db.query.ansatte.findFirst({
        where: and(eq(ansatte.id, data.ansvarlig), eq(ansatte.tenantId, okt.tenantId)),
        columns: { id: true },
      });
      if (!finnes) return NextResponse.json({ feil: "Ukjent ansatt." }, { status: 400 });
    }
    endringer.ansvarlig = data.ansvarlig ?? null;
  }

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(henvendelser).set(endringer).where(eq(henvendelser.id, rad.id));

  await loggEndring(okt, {
    handling: "henvendelse.endret",
    tabell: "henvendelser",
    radId: rad.id,
    for: { trinn: rad.trinn, ansvarlig: rad.ansvarlig, avdeling: rad.avdeling, sum: rad.sum },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id });
});
