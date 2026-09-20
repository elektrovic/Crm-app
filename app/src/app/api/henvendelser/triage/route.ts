/**
 * Kjører AI-triagering på én henvendelse.
 *
 * Resultatet lagres i ai-kolonnene, atskilt fra det saksbehandleren selv
 * har bestemt. Triageringen flytter aldri en henvendelse videre i
 * pipelinen — den foreslår, et menneske avgjør.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { henvendelser } from "@/db/schema";
import { endepunkt, ipFra } from "@/lib/api";
import { krevRolle } from "@/lib/tilgang";
import { loggEndring } from "@/lib/endringslogg";
import { TriageFeil, vurderHenvendelse } from "@/lib/ai/triage";

const Skjema = z.object({ id: z.uuid() });

export const POST = endepunkt(Skjema, async ({ okt, data, request }) => {
  // Endepunktet ligger utenfor /admin, så rollen må sjekkes her også.
  await krevRolle("leder");

  const rad = await db.query.henvendelser.findFirst({
    where: and(eq(henvendelser.id, data.id), eq(henvendelser.tenantId, okt.tenantId)),
  });
  if (!rad) {
    return NextResponse.json({ feil: "Ukjent henvendelse." }, { status: 404 });
  }

  try {
    const vurdering = await vurderHenvendelse({
      kanal: rad.kanal,
      innhold: rad.innhold,
      avsenderNavn: rad.avsenderNavn,
    });

    await db
      .update(henvendelser)
      .set({
        aiSammendrag: vurdering.sammendrag,
        aiKategori: vurdering.kategori,
        aiHastegrad: vurdering.hastegrad,
        aiModell: vurdering.modell,
        aiVurdert: new Date(),
      })
      .where(eq(henvendelser.id, rad.id));

    await loggEndring(okt, {
      handling: "henvendelse.aiVurdert",
      tabell: "henvendelser",
      radId: rad.id,
      etter: {
        kategori: vurdering.kategori,
        hastegrad: vurdering.hastegrad,
        modell: vurdering.modell,
      },
      ipAdresse: ipFra(request),
    });

    return NextResponse.json({ vurdering });
  } catch (feil) {
    const kanProvesIgjen = feil instanceof TriageFeil && feil.kanProvesIgjen;
    const melding =
      feil instanceof TriageFeil ? feil.message : "Klarte ikke å vurdere henvendelsen.";
    console.error("AI-triagering feilet", { henvendelse: rad.id, feil });

    return NextResponse.json({ feil: melding }, { status: kanProvesIgjen ? 502 : 400 });
  }
});
