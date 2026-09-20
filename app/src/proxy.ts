/**
 * Kjører foran hver forespørsel og avviser den som ikke er logget inn.
 *
 * Het `middleware.ts` fram til Next 16; navnet er `proxy.ts` nå.
 * Denne fila kjører på edge og har ikke databasetilgang — derfor ligger
 * bare innloggingssjekken her, mens rolleoppslaget skjer i auth.ts.
 */
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Alt unntatt statiske filer krever innlogging.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ikoner|manifest.webmanifest|sw.js).*)"],
};
