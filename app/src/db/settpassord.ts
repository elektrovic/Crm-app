/**
 * Setter et passord på en bruker, lokalt.
 *
 *   npm run db:passord -- victor@hallandgroup.no mitt-passord-her
 *
 * Finnes fordi det midlertidige passordet vises én gang i terminalen, og
 * en terminal rulles bort. Da sto man uten vei inn i sin egen lokale
 * base, og måtte tømme alt for å komme i gang igjen.
 *
 * Den nekter mot produksjon. Der skal passord settes i portalen, av noen
 * som er logget inn, og havne i endringsloggen — ikke fra en terminal
 * uten spor.
 */
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { ansatte } from "./schema";
import { erSikkertIkkeProduksjon } from "./vern";
import { lagHash, vurderPassord } from "../lib/passord";

const TENANT = process.env.DEFAULT_TENANT_ID ?? "halland";

async function kjor() {
  if (!erSikkertIkkeProduksjon(process.env)) {
    console.error(
      "Nekter: miljøet sier ikke at dette er test eller lokalt.\n" +
        "I produksjon settes passord under Admin → Brukere og roller.",
    );
    process.exit(1);
  }

  const [epostInn, passord] = process.argv.slice(2);
  if (!epostInn || !passord) {
    console.error('Bruk: npm run db:passord -- epost@firma.no "nytt passord"');
    process.exit(1);
  }

  const innvending = vurderPassord(passord);
  if (innvending) {
    console.error(innvending);
    process.exit(1);
  }

  const epost = epostInn.trim().toLowerCase();
  const rad = await db.query.ansatte.findFirst({
    where: and(eq(ansatte.tenantId, TENANT), eq(ansatte.epost, epost)),
    columns: { id: true, navn: true },
  });
  if (!rad) {
    console.error(`Fant ingen bruker med e-posten ${epost}.`);
    process.exit(1);
  }

  await db
    .update(ansatte)
    .set({
      passordHash: await lagHash(passord),
      // Du valgte det selv, så det er ikke midlertidig.
      maaByttePassord: false,
      aktiv: true,
    })
    .where(eq(ansatte.id, rad.id));

  console.log("");
  console.log(`  Passordet er satt for ${rad.navn} (${epost}).`);
  console.log("  Logg inn på http://localhost:3000");
  console.log("");
}

kjor()
  .then(() => process.exit(0))
  .catch((feil) => {
    console.error("Gikk ikke:", feil instanceof Error ? feil.message : feil);
    process.exit(1);
  });
