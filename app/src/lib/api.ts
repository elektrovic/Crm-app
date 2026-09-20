/**
 * Felles innpakning for API-endepunktene.
 *
 * Uten dette gjentar hver rute den samme dansen: hent økt, fang
 * innloggingsfeil, les JSON, valider, fang valideringsfeil. Her ligger den
 * ett sted, og rutene inneholder bare det de faktisk handler om.
 */
import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { IkkeInnloggetFeil, IngenTilgangFeil, krevOkt, type Okt } from "./tilgang";

export type Handling<T> = (args: {
  okt: Okt;
  data: T;
  request: Request;
}) => Promise<NextResponse>;

/**
 * Krever innlogging og et gyldig innhold, og oversetter kjente feil til
 * riktig statuskode. Sendekøen skiller på 4xx og 5xx: 4xx blir stående som
 * «feilet» og krever at et menneske gjør noe, 5xx prøves på nytt.
 */
export function endepunkt<S extends z.ZodType>(skjema: S, handling: Handling<z.infer<S>>) {
  return async (request: Request): Promise<NextResponse> => {
    let okt: Okt;
    try {
      okt = await krevOkt();
    } catch (feil) {
      if (feil instanceof IkkeInnloggetFeil) {
        return NextResponse.json({ feil: "Ikke innlogget." }, { status: 401 });
      }
      throw feil;
    }

    const kropp = await request.json().catch(() => null);
    const lest = skjema.safeParse(kropp);
    if (!lest.success) {
      return NextResponse.json(
        { feil: "Ugyldig innhold i forespørselen.", detaljer: lest.error.issues },
        { status: 400 },
      );
    }

    try {
      return await handling({ okt, data: lest.data, request });
    } catch (feil) {
      if (feil instanceof IngenTilgangFeil) {
        return NextResponse.json({ feil: feil.message }, { status: 403 });
      }
      throw feil;
    }
  };
}

/** Klientens IP, til endringsloggen. */
export function ipFra(request: Request): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
}
