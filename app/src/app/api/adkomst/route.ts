/**
 * Adkomstinfo: nøkkelkode, kontaktperson, parkering.
 *
 * Oppdateres av den som var der sist. Det er hele poenget — informasjonen
 * er fersk fordi den som nettopp sto i oppgangen retter den, ikke fordi
 * kontoret vedlikeholder et register.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { adkomst, prosjekter } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";

const Skjema = z.object({
  prosjektId: z.uuid(),
  nokkelkode: z.string().max(100).nullish(),
  kontaktperson: z.string().max(200).nullish(),
  kontakttelefon: z.string().max(40).nullish(),
  parkering: z.string().max(500).nullish(),
  merknad: z.string().max(2000).nullish(),
});

export const POST = endepunkt(Skjema, async ({ okt, data, request }) => {
  const prosjekt = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.prosjektId), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!prosjekt) {
    return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 400 });
  }

  const fraFor = await db.query.adkomst.findFirst({
    where: eq(adkomst.prosjektId, prosjekt.id),
  });

  const verdier = {
    nokkelkode: data.nokkelkode ?? null,
    kontaktperson: data.kontaktperson ?? null,
    kontakttelefon: data.kontakttelefon ?? null,
    parkering: data.parkering ?? null,
    merknad: data.merknad ?? null,
    oppdatertAv: okt.id,
    oppdatert: new Date(),
  };

  const [rad] = await db
    .insert(adkomst)
    .values({ tenantId: okt.tenantId, prosjektId: prosjekt.id, ...verdier })
    .onConflictDoUpdate({ target: adkomst.prosjektId, set: verdier })
    .returning();

  await loggEndring(okt, {
    handling: fraFor ? "adkomst.endret" : "adkomst.opprettet",
    tabell: "adkomst",
    radId: rad?.id,
    for: fraFor
      ? {
          nokkelkode: fraFor.nokkelkode,
          kontaktperson: fraFor.kontaktperson,
          parkering: fraFor.parkering,
        }
      : null,
    etter: {
      nokkelkode: verdier.nokkelkode,
      kontaktperson: verdier.kontaktperson,
      parkering: verdier.parkering,
    },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id, oppdatert: verdier.oppdatert.toISOString() });
});
