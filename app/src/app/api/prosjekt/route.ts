/**
 * Endringer på et prosjekt som kontoret eier, ikke Tripletex.
 *
 * Avdeling er den viktigste. Tripletex vet ikke at Halland deler inn i
 * elektro, lås og eiendomspleie, så alt som importeres får en standard.
 * Noen må rette den — og synken skal aldri overskrive rettelsen. Derfor
 * ligger den her og ikke i synken.
 *
 * Nummer, navn, kunde og adresse endres IKKE herfra. De kommer fra
 * Tripletex, og blir overskrevet ved neste synk uansett. Et felt man kan
 * endre uten at endringen varer, er verre enn et felt man ikke kan endre.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { AVDELINGER, prosjekter } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { krevRolle } from "@/lib/tilgang";

const Endring = z.object({
  id: z.uuid(),
  avdeling: z.enum(AVDELINGER),
  /** Fargen prosjektet får der det vises per prosjekt. */
  farge: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const PATCH = endepunkt(Endring, async ({ okt, data, request }) => {
  await krevRolle("leder");

  const fraFor = await db.query.prosjekter.findFirst({
    where: and(eq(prosjekter.id, data.id), eq(prosjekter.tenantId, okt.tenantId)),
  });
  if (!fraFor) return NextResponse.json({ feil: "Ukjent prosjekt." }, { status: 404 });

  // En leder styrer sin egen avdeling. Å flytte et prosjekt UT av den er
  // greit; å rote i en annen avdelings prosjekter er det ikke.
  if (okt.rolle !== "admin" && fraFor.avdeling !== okt.avdeling) {
    return NextResponse.json(
      { feil: "Prosjektet hører til en annen avdeling." },
      { status: 403 },
    );
  }

  await db
    .update(prosjekter)
    .set({ avdeling: data.avdeling, ...(data.farge ? { farge: data.farge } : {}) })
    .where(eq(prosjekter.id, fraFor.id));

  await loggEndring(okt, {
    handling: "prosjekt.avdeling_endret",
    tabell: "prosjekter",
    radId: fraFor.id,
    for: { avdeling: fraFor.avdeling },
    etter: { avdeling: data.avdeling, prosjekt: `${fraFor.nummer} ${fraFor.navn}` },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ id: fraFor.id, avdeling: data.avdeling });
});
