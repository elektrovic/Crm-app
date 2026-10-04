/**
 * Tømmer databasen for alt innhold.
 *
 * Finnes fordi demodataene er i veien når man skal se portalen slik den
 * faktisk blir: tre oppdiktede ansatte og et knippe prosjekter gjør det
 * umulig å se om det man nettopp bygget virker på ekte data eller bare
 * på kulissene.
 *
 * Den nekter å kjøre mot produksjon. Vernet i vern.ts stopper den om
 * DATABASE_URL peker på produksjonsbasen, og i tillegg kreves det her at
 * miljøet positivt sier at dette ikke er produksjon — her er det riktig
 * å feile fordi noe er uklart, ikke å gamble.
 *
 * Tenants står igjen. Uten den raden har ingenting av det som legges inn
 * etterpå noe å høre til.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { erSikkertIkkeProduksjon, krevRiktigBase } from "./vern";

/**
 * Rekkefølgen spiller ingen rolle: TRUNCATE med CASCADE tar dem i ett
 * jafs, og da slipper vi å holde en liste over hvem som peker på hvem
 * oppdatert hver gang en tabell kommer til.
 */
const TABELLER = [
  "ansatte",
  "prosjekter",
  "adkomst",
  "mangler",
  "tildelinger",
  "timeforinger",
  "endringslogg",
  "vedlegg",
  "tillegg",
  "skjemasvar",
  "sms_logg",
  "prislinjer",
  "skjemamaler",
  "kunder",
  "henvendelser",
  "reklamasjoner",
  "garantier",
  "oppfolginger",
  "kundehistorikk",
  "aktiviteter",
  "bestillinger",
  "bestillingslinjer",
  "medbring",
  "synkkjoringer",
  "samtaler",
];

async function kjor() {
  const url = process.env.DATABASE_URL_DIREKTE || process.env.DATABASE_URL;
  if (!url) {
    console.error("Ingen DATABASE_URL.");
    process.exit(1);
  }

  if (!erSikkertIkkeProduksjon(process.env)) {
    console.error(
      "Nekter å tømme: miljøet sier ikke at dette er test eller lokalt.\n" +
        "Sett MILJO=lokal eller MILJO=test om det stemmer.\n" +
        "Produksjonsbasen tømmes ikke herfra — se docs/rydd-demodata.sql.",
    );
    process.exit(1);
  }
  krevRiktigBase(url);

  const lokal = url.includes("localhost") || url.includes("127.0.0.1");
  const forbindelse = postgres(url, { max: 1, prepare: false, ssl: lokal ? false : "require" });
  const base = drizzle(forbindelse);

  try {
    // to_regclass gir null for en tabell som ikke finnes, slik at en base
    // som er migrert et annet sted enn koden ikke gir en feil her.
    const finnes: string[] = [];
    for (const t of TABELLER) {
      const [rad] = await base.execute<{ navn: string | null }>(
        sql`select to_regclass(${`public.${t}`})::text as navn`,
      );
      if (rad?.navn) finnes.push(`"${t}"`);
    }

    if (finnes.length === 0) {
      console.log("Ingen tabeller å tømme.");
      return;
    }

    await base.execute(sql.raw(`truncate table ${finnes.join(", ")} restart identity cascade`));
    console.log(`Tømte ${finnes.length} tabeller. Tenants står igjen.`);
  } finally {
    await forbindelse.end();
  }
}

kjor().catch((feil) => {
  console.error("Tømmingen feilet:", feil);
  process.exit(1);
});
