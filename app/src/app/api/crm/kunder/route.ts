/**
 * Kunder: opprett og rediger.
 *
 * Omsetning kan ikke settes herfra. Den hentes fra Tripletex og regnes
 * aldri ut på nytt her — ellers ville det finnes to tall, og ingen ville
 * vite hvilket som gjelder.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { AVDELINGER, KUNDESTATUS, kunder } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";

const Felter = {
  navn: z.string().trim().min(1, "Kunden må ha et navn.").max(200),
  type: z.string().trim().max(80).nullish(),
  orgnummer: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "Organisasjonsnummer er ni siffer.")
    .nullish(),
  kontaktperson: z.string().trim().max(200).nullish(),
  telefon: z.string().trim().max(40).nullish(),
  epost: z.email("Ugyldig e-postadresse.").nullish().or(z.literal("")),
  adresse: z.string().trim().max(300).nullish(),
  avdeling: z.enum(AVDELINGER).nullish(),
  status: z.enum(KUNDESTATUS).optional(),
};

const Ny = z.object(Felter);

/** Tom tekst fra et skjemafelt betyr «ikke utfylt», ikke tom streng. */
function tomErNull(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export const POST = endepunkt(Ny, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const [rad] = await db
    .insert(kunder)
    .values({
      tenantId: okt.tenantId,
      navn: data.navn,
      type: tomErNull(data.type),
      orgnummer: tomErNull(data.orgnummer),
      kontaktperson: tomErNull(data.kontaktperson),
      telefon: tomErNull(data.telefon),
      epost: tomErNull(data.epost),
      adresse: tomErNull(data.adresse),
      avdeling: data.avdeling ?? null,
      status: data.status ?? "prospekt",
    })
    .returning();

  await loggEndring(okt, {
    handling: "kunde.opprettet",
    tabell: "kunder",
    radId: rad?.id,
    etter: { navn: data.navn, status: data.status ?? "prospekt" },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad?.id });
});

const Endre = z.object({ id: z.uuid(), ...Felter, navn: Felter.navn.optional() });

export const PATCH = endepunkt(Endre, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const rad = await db.query.kunder.findFirst({
    where: and(eq(kunder.id, data.id), eq(kunder.tenantId, okt.tenantId)),
  });
  if (!rad) return NextResponse.json({ feil: "Ukjent kunde." }, { status: 404 });

  const endringer: Record<string, unknown> = {};
  if (data.navn !== undefined) endringer.navn = data.navn;
  if (data.type !== undefined) endringer.type = tomErNull(data.type);
  if (data.orgnummer !== undefined) endringer.orgnummer = tomErNull(data.orgnummer);
  if (data.kontaktperson !== undefined) endringer.kontaktperson = tomErNull(data.kontaktperson);
  if (data.telefon !== undefined) endringer.telefon = tomErNull(data.telefon);
  if (data.epost !== undefined) endringer.epost = tomErNull(data.epost);
  if (data.adresse !== undefined) endringer.adresse = tomErNull(data.adresse);
  if (data.avdeling !== undefined) endringer.avdeling = data.avdeling ?? null;
  if (data.status !== undefined) endringer.status = data.status;

  if (Object.keys(endringer).length === 0) {
    return NextResponse.json({ feil: "Ingenting å endre." }, { status: 400 });
  }

  await db.update(kunder).set(endringer).where(eq(kunder.id, rad.id));

  await loggEndring(okt, {
    handling: "kunde.endret",
    tabell: "kunder",
    radId: rad.id,
    for: { navn: rad.navn, status: rad.status, avdeling: rad.avdeling },
    etter: endringer,
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: rad.id });
});
