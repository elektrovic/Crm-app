/**
 * Søket. GET fordi det ikke endrer noe, og fordi nettleseren da kan
 * avbryte et kall når man taster videre.
 */
import { NextResponse } from "next/server";
import { sok } from "@/lib/data/crm";
import { IkkeInnloggetFeil, krevRolle } from "@/lib/tilgang";

export async function GET(request: Request) {
  let okt;
  try {
    okt = await krevRolle("leder");
  } catch (feil) {
    if (feil instanceof IkkeInnloggetFeil) {
      return NextResponse.json({ feil: "Ikke innlogget." }, { status: 401 });
    }
    return NextResponse.json({ feil: "Ingen tilgang." }, { status: 403 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ treff: await sok(okt, q) });
}
