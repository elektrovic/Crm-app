/**
 * Innlogging med Microsoft Entra ID.
 *
 * De ansatte har allerede kontoer med to-faktor i Microsoft 365, så vi
 * håndterer aldri passord selv. En ansatt som slutter mister tilgangen i
 * samme øyeblikk kontoen stenges i Entra — uten at noen må huske å gjøre
 * noe i Montørappen.
 *
 * Merk at det ikke er nok å ha en Entra-konto: den ansatte må også finnes
 * som aktiv rad i `ansatte`-tabellen. Da bestemmer ledelsen hvem som får
 * bruke appen, ikke Entra-katalogen alene.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { ansatte, type Avdeling, type Rolle } from "./db/schema";

/** Feltene Montørappen legger på den innloggede brukeren. */
export type Brukerprofil = {
  id: string;
  navn: string;
  epost: string;
  rolle: Rolle;
  avdeling: Avdeling;
  tenantId: string;
  initialer: string;
  farge: string;
  tripletexEmployeeId: number | null;
  abaxVehicleId: string | null;
};

declare module "next-auth" {
  // Utvider standardbrukeren i stedet for å erstatte den, slik at
  // next-auth sine egne felter fortsatt er på plass.
  interface Session {
    user: Brukerprofil & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Slipper bare inn ansatte som er lagt inn og aktive. Alt annet avvises,
     * også gyldige Entra-kontoer.
     */
    async signIn({ profile }) {
      const oid = lesOid(profile);
      if (!oid) return false;

      const rad = await db.query.ansatte.findFirst({
        where: eq(ansatte.entraOid, oid),
        columns: { aktiv: true },
      });

      return Boolean(rad?.aktiv);
    },

    /**
     * Rolle og avdeling hentes fra databasen ved innlogging og legges i
     * tokenet, slik at hver forespørsel etterpå slipper et databaseoppslag.
     */
    async jwt({ token, profile }) {
      const oid = lesOid(profile);
      if (!oid) return token;

      const rad = await db.query.ansatte.findFirst({
        where: eq(ansatte.entraOid, oid),
      });
      if (!rad) return token;

      token.ansattId = rad.id;
      token.navn = rad.navn;
      token.epost = rad.epost;
      token.rolle = rad.rolle;
      token.avdeling = rad.avdeling;
      token.tenantId = rad.tenantId;
      token.initialer = rad.initialer;
      token.farge = rad.farge;
      token.tripletexEmployeeId = rad.tripletexEmployeeId;
      token.abaxVehicleId = rad.abaxVehicleId;
      return token;
    },

    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: String(token.ansattId ?? ""),
        navn: String(token.navn ?? ""),
        epost: String(token.epost ?? ""),
        rolle: (token.rolle as Rolle) ?? "montor",
        avdeling: token.avdeling as Avdeling,
        tenantId: String(token.tenantId ?? ""),
        initialer: String(token.initialer ?? ""),
        farge: String(token.farge ?? "#2563EB"),
        tripletexEmployeeId: (token.tripletexEmployeeId as number | null) ?? null,
        abaxVehicleId: (token.abaxVehicleId as string | null) ?? null,
      };
      return session;
    },
  },
});

/** Entra legger objekt-ID-en i `oid`. Den er stabil, i motsetning til e-post. */
function lesOid(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const oid = (profile as { oid?: unknown }).oid;
  return typeof oid === "string" ? oid : null;
}
