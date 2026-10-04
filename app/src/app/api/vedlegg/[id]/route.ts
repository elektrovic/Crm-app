/**
 * Serverer et bilde.
 *
 * Bildene ligger som base64 i databasen. De kunne vært lagt rett inn i
 * sidekilden som data-URL, men da ville hver sidelasting dratt med seg
 * hele bildet på nytt, og nettleseren kunne ikke lagret det. Her får de en
 * adresse, og dermed også en mellomlagring.
 *
 * Tilgang sjekkes på hver forespørsel: innlogget, og bildet må høre til
 * din egen tenant. Uten den sjekken ville en gjettet UUID vært nok.
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { vedlegg } from "@/db/schema";
import { IkkeInnloggetFeil, krevOkt } from "@/lib/tilgang";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let okt;
  try {
    okt = await krevOkt();
  } catch (feil) {
    if (feil instanceof IkkeInnloggetFeil) {
      return NextResponse.json({ feil: "Ikke innlogget." }, { status: 401 });
    }
    throw feil;
  }

  const { id } = await params;
  const rad = await db.query.vedlegg.findFirst({
    where: and(eq(vedlegg.id, id), eq(vedlegg.tenantId, okt.tenantId)),
  });

  // Samme svar enten raden ikke finnes eller ikke er din: en gjettet UUID
  // skal ikke kunne fortelle at den traff.
  if (!rad) return new NextResponse("Ikke funnet", { status: 404 });

  if (!rad.data) {
    // Raden står igjen, men bytene er ryddet bort etter at Tripletex
    // bekreftet at de har kopien. Det er ikke en feil.
    return new NextResponse("Bildet er arkivert i Tripletex", { status: 410 });
  }

  return new NextResponse(Buffer.from(rad.data, "base64"), {
    headers: {
      "Content-Type": rad.mimetype,
      "Content-Length": String(rad.storrelse),
      // Privat: bildet kan vise en kundes tavle eller inngangsparti.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
