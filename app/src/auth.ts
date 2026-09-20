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
 *
 * I demomodus finnes det i tillegg en dør uten passord. Se lib/demo.ts for
 * hvorfor den finnes og hva som holder den lukket.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { and, eq } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { ansatte, type Avdeling, type Rolle } from "./db/schema";
import { DEMO_INNLOGGING } from "./lib/demo";

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

/**
 * Demodøra. Finnes bare når DEMO_INNLOGGING er «1», og slipper bare inn
 * ansatte som allerede ligger aktive i databasen.
 */
const demoProvider = Credentials({
  id: "demo",
  name: "Demo",
  credentials: { epost: { label: "E-post", type: "text" } },
  async authorize(data) {
    const epost = typeof data?.epost === "string" ? data.epost : "";
    if (!epost) return null;

    const rad = await db.query.ansatte.findFirst({
      where: and(eq(ansatte.epost, epost), eq(ansatte.aktiv, true)),
    });
    if (!rad) return null;

    return {
      id: rad.id,
      navn: rad.navn,
      epost: rad.epost,
      rolle: rad.rolle,
      avdeling: rad.avdeling,
      tenantId: rad.tenantId,
      initialer: rad.initialer,
      farge: rad.farge,
      tripletexEmployeeId: rad.tripletexEmployeeId,
      abaxVehicleId: rad.abaxVehicleId,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
    ...(DEMO_INNLOGGING ? [demoProvider] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Slipper bare inn ansatte som er lagt inn og aktive. Alt annet avvises,
     * også gyldige Entra-kontoer.
     */
    async signIn({ account, profile }) {
      // Demoprovideren har alt slått opp i databasen i authorize, og
      // returnerte null hvis den ansatte ikke fantes eller var sperret.
      if (account?.provider === "demo") return DEMO_INNLOGGING;

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
    async jwt({ token, user, profile }) {
      // Demoinnlogging: profilen kom fra authorize, ikke fra Entra.
      if (user && "rolle" in user) {
        const p = user as unknown as Brukerprofil;
        return { ...token, ...tilToken(p) };
      }

      const oid = lesOid(profile);
      if (!oid) return token;

      const rad = await db.query.ansatte.findFirst({
        where: eq(ansatte.entraOid, oid),
      });
      if (!rad) return token;

      return { ...token, ...tilToken({ ...rad, id: rad.id }) };
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

/** Feltene vi bærer i tokenet, så de settes likt uansett hvilken vei man kom inn. */
function tilToken(p: Brukerprofil) {
  return {
    ansattId: p.id,
    navn: p.navn,
    epost: p.epost,
    rolle: p.rolle,
    avdeling: p.avdeling,
    tenantId: p.tenantId,
    initialer: p.initialer,
    farge: p.farge,
    tripletexEmployeeId: p.tripletexEmployeeId,
    abaxVehicleId: p.abaxVehicleId,
  };
}

/** Entra legger objekt-ID-en i `oid`. Den er stabil, i motsetning til e-post. */
function lesOid(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const oid = (profile as { oid?: unknown }).oid;
  return typeof oid === "string" ? oid : null;
}
