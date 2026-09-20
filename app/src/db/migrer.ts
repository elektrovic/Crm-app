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
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("Ingen DATABASE_URL — hopper over migrering.");
    return;
  }

  // `max: 1` fordi migrering skal gå i én forbindelse, i rekkefølge.
  const forbindelse = postgres(url, { max: 1 });

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
