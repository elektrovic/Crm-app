/**
 * Edge-trygg del av innloggingsoppsettet.
 *
 * Middleware kjører på edge og har ikke databasetilgang, så alt som krever
 * et databaseoppslag ligger i auth.ts i stedet. Her ligger bare reglene for
 * hvem som slipper inn hvor.
 */
import type { NextAuthConfig } from "next-auth";

/** Sider som er åpne uten innlogging. */
const APNE_STIER = ["/logg-inn", "/api/auth"];

export const authConfig = {
  providers: [], // Fylles ut i auth.ts — middleware trenger dem ikke.
  pages: {
    signIn: "/logg-inn",
    error: "/logg-inn",
  },
  session: {
    strategy: "jwt",
    // Åtte timer dekker en arbeidsdag. Montøren logger inn om morgenen,
    // ikke på nytt etter hver pause.
    maxAge: 8 * 60 * 60,
  },
  callbacks: {
    authorized({ request, auth }) {
      const sti = request.nextUrl.pathname;
      if (APNE_STIER.some((p) => sti.startsWith(p))) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
