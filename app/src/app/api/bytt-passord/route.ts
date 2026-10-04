/**
 * Brukeren bytter sitt eget passord.
 *
 * Det gamle passordet må oppgis, også når byttet er påtvunget. Det er
 * forskjellen mellom «noen satte seg ned ved en ulåst maskin» og «brukeren
 * byttet passordet sitt»: uten det kravet kan den som kommer til en
 * innlogget skjerm overta kontoen uten å vite noe.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ansatte } from "@/db/schema";
import { ipFra } from "@/lib/api";
import { loggEndring } from "@/lib/endringslogg";
import { lagHash, sjekkPassord, vurderPassord } from "@/lib/passord";
import { IkkeInnloggetFeil, krevOktUtenBytte } from "@/lib/tilgang";

const Bytte = z.object({
  gammelt: z.string().min(1, "Skriv det gamle passordet."),
  nytt: z.string().min(1, "Skriv et nytt passord."),
});

export async function POST(request: Request): Promise<NextResponse> {
  // Egen innpakning i stedet for endepunkt(): den vanlige sender brukeren
  // videre til passordbytte, og det er nettopp her vi er.
  let okt;
  try {
    okt = await krevOktUtenBytte();
  } catch (feil) {
    if (feil instanceof IkkeInnloggetFeil) {
      return NextResponse.json({ feil: "Ikke innlogget." }, { status: 401 });
    }
    throw feil;
  }

  const lest = Bytte.safeParse(await request.json().catch(() => null));
  if (!lest.success) {
    return NextResponse.json(
      { feil: "Ugyldig innhold.", detaljer: lest.error.issues },
      { status: 400 },
    );
  }

  const rad = await db.query.ansatte.findFirst({ where: eq(ansatte.id, okt.id) });
  if (!rad?.aktiv) return NextResponse.json({ feil: "Ukjent bruker." }, { status: 404 });

  if (!(await sjekkPassord(lest.data.gammelt, rad.passordHash))) {
    return NextResponse.json({ feil: "Det gamle passordet stemmer ikke." }, { status: 400 });
  }

  const innvending = vurderPassord(lest.data.nytt);
  if (innvending) return NextResponse.json({ feil: innvending }, { status: 400 });

  if (await sjekkPassord(lest.data.nytt, rad.passordHash)) {
    return NextResponse.json(
      { feil: "Det nye passordet må være et annet enn det gamle." },
      { status: 400 },
    );
  }

  await db
    .update(ansatte)
    .set({ passordHash: await lagHash(lest.data.nytt), maaByttePassord: false })
    .where(eq(ansatte.id, rad.id));

  await loggEndring(okt, {
    handling: "bruker.byttet_passord",
    tabell: "ansatte",
    radId: rad.id,
    etter: { byttet: true },
    ipAdresse: ipFra(request),
  });

  return NextResponse.json({ ok: true });
}
