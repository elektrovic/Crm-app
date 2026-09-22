/**
 * Kjører databasemigrasjonene.
 *
 * Kjøres som en del av byggingen. Grunnen er praktisk: Netlify bygger fra
 * GitHub, og den som setter opp systemet har ikke nødvendigvis en terminal
 * med tilgang til produksjonsdatabasen. Uten dette må noen kjøre
 * `db:push` manuelt, og glemmer man det, starter appen mot tomme tabeller.
 *
 * Migrasjonene ligger som SQL i `drizzle/` og kjøres én gang hver.
 * Drizzle holder selv rede på hvilke som er kjørt, så dette er trygt å
 * kjøre ved hvert bygg.
 *
 * Uten DATABASE_URL hopper den over i stillhet. Da bygger appen fortsatt
 * — det skal være mulig å bygge uten en database, for eksempel i en test.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function kjor() {
  // Migrering endrer selve tabellene, og det skal gå i én forbindelse som
  // holder seg i ro fra start til slutt.
  //
  // Transaksjonsposeren til Supabase (port 6543) gir ingen slik garanti —
  // den bytter forbindelse under deg. Derfor kan DATABASE_URL_DIREKTE
  // settes til direkteforbindelsen, som brukes her og bare her. Er den
  // ikke satt, brukes den vanlige.
  const url = process.env.DATABASE_URL_DIREKTE || process.env.DATABASE_URL;
  if (!url) {
    console.log("Ingen DATABASE_URL — hopper over migrering.");
    return;
  }

  const lokal = url.includes("localhost") || url.includes("127.0.0.1");

  const forbindelse = postgres(url, {
    max: 1,
    prepare: false,
    ssl: lokal ? false : "require",
  });

  try {
    await migrate(drizzle(forbindelse), { migrationsFolder: "./drizzle" });
    console.log("Databasen er oppdatert.");
  } finally {
    await forbindelse.end();
  }
}

kjor().catch((feil) => {
  console.error("Migreringen feilet:", feil);
  // Bygget skal stoppe. En app mot en halvveis migrert database er verre
  // enn et bygg som ikke gikk gjennom.
  process.exit(1);
});
