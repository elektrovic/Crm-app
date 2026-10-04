/**
 * Lager den første administratoren.
 *
 * Problemet den løser er enkelt og uunngåelig: brukere opprettes i
 * portalen, og portalen krever at man er logget inn. En tom base har
 * ingen å logge inn som. Noen må settes inn utenfra én gang.
 *
 * Kjøres slik, med din egen e-post:
 *
 *   npm run db:forstebruker -- "Victor Halland" victor@hallandgroup.no
 *
 * Den skriver ut et midlertidig passord som må byttes ved første
 * innlogging. Passordet står bare i terminalen — det lagres aldri.
 *
 * Finnes det alt en administrator, nekter den. Da er veien inn portalen,
 * ikke en terminal.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { ansatte, AVDELINGER, tenants, type Avdeling } from "./schema";
import { foreslaPassord, lagHash } from "../lib/passord";

const TENANT = process.env.DEFAULT_TENANT_ID ?? "halland";

function initialerFra(navn: string): string {
  const ord = navn.trim().split(/\s+/).filter(Boolean);
  return ((ord[0]?.[0] ?? "?") + (ord.length > 1 ? (ord[ord.length - 1]?.[0] ?? "") : ""))
    .toUpperCase()
    .slice(0, 2);
}

async function kjor() {
  const [navn, epost, avdelingInn] = process.argv.slice(2);

  if (!navn || !epost) {
    console.error(
      'Bruk: npm run db:forstebruker -- "Fornavn Etternavn" epost@firma.no [avdeling]\n' +
        `Avdelinger: ${AVDELINGER.join(", ")}`,
    );
    process.exit(1);
  }

  const avdeling = (avdelingInn ?? AVDELINGER[0]) as Avdeling;
  if (!AVDELINGER.includes(avdeling)) {
    console.error(`Ukjent avdeling «${avdeling}». Velg en av: ${AVDELINGER.join(", ")}`);
    process.exit(1);
  }

  const epostRen = epost.trim().toLowerCase();

  // Kunderaden må finnes før noen kan peke på den.
  await db.insert(tenants).values({ id: TENANT, navn: "Halland Gruppen" }).onConflictDoNothing();

  const finnesAdmin = await db.query.ansatte.findFirst({
    where: and(eq(ansatte.tenantId, TENANT), eq(ansatte.rolle, "admin"), eq(ansatte.aktiv, true)),
    columns: { epost: true },
  });
  if (finnesAdmin) {
    console.error(
      `Det finnes alt en administrator (${finnesAdmin.epost}).\n` +
        "Nye brukere lages under Admin → Brukere og roller.",
    );
    process.exit(1);
  }

  const passord = foreslaPassord();

  await db
    .insert(ansatte)
    .values({
      tenantId: TENANT,
      navn,
      epost: epostRen,
      rolle: "admin",
      avdeling,
      initialer: initialerFra(navn),
      farge: "#2563EB",
      passordHash: await lagHash(passord),
      maaByttePassord: true,
    })
    .onConflictDoUpdate({
      target: [ansatte.tenantId, ansatte.epost],
      set: { rolle: "admin", aktiv: true },
    });

  console.log("");
  console.log("  Administrator opprettet.");
  console.log("");
  console.log(`  E-post:   ${epostRen}`);
  console.log(`  Passord:  ${passord}`);
  console.log("");
  console.log("  Passordet må byttes ved første innlogging, og vises ikke igjen.");
  console.log("");
}

kjor()
  .then(() => process.exit(0))
  .catch((feil) => {
    console.error("Gikk ikke:", feil instanceof Error ? feil.message : feil);
    process.exit(1);
  });
