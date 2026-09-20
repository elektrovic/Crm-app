import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Tilkoblingen opprettes først når noen faktisk spør etter den.
 *
 * Uten dette ville `next build` krevd en kjørende database bare for å
 * importere modulen, og bygget ville feilet i CI der ingen database finnes.
 */
let bufret: PostgresJsDatabase<typeof schema> | null = null;

function opprett(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL mangler. Kopier .env.example til .env og fyll den ut.");
  }

  const klient = postgres(url, {
    // Én tilkobling i utvikling hindrer at hot reload åpner nye for hver endring.
    max: process.env.NODE_ENV === "production" ? 10 : 1,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  });

  return drizzle(klient, { schema });
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_mål, egenskap) {
    bufret ??= opprett();
    const verdi = Reflect.get(bufret, egenskap, bufret);
    return typeof verdi === "function" ? verdi.bind(bufret) : verdi;
  },
});

export { schema };
