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

  const lokal = url.includes("localhost") || url.includes("127.0.0.1");

  const klient = postgres(url, {
    // Appen kjører som serverløse funksjoner. Hver forespørsel kan få sin
    // egen instans, så én tilkobling per instans — ikke ti. Ti ganger
    // antall samtidige instanser tømmer tilkoblingsbudsjettet fort.
    max: 1,

    // Transaksjonsposeren til Supabase (port 6543) gir deg ikke samme
    // tilkobling to ganger. Forberedte spørringer hører til én tilkobling,
    // så de går i stykker der — med «prepared statement already exists»
    // midt i produksjon, ikke under bygging.
    //
    // Vi slår dem av uansett pooler. Gevinsten er liten når hver instans
    // uansett lever kort, og alternativet er en feil som bare viser seg
    // under last.
    prepare: false,

    ssl: lokal ? false : "require",
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
