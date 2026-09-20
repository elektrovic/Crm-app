/**
 * Legger inn demodata under bygging — men bare når noen har bedt om det.
 *
 * Samme praktiske grunn som migrer.ts: den som setter opp systemet har
 * ikke nødvendigvis en terminal mot produksjonsdatabasen, og uten data er
 * det ingenting å se i appen.
 *
 * Demodataene er oppdiktede: tre ansatte, noen prosjekter og en prisliste.
 * De hører ikke hjemme i et system med ekte kunder, så dette er skrudd av
 * med mindre SEED_VED_BYGG står til «1». Skru det av igjen — og rydd bort
 * radene — før ekte data legges inn.
 *
 * Seeden er trygg å kjøre flere ganger; den hopper over det som finnes.
 */
async function kjor() {
  if (process.env.SEED_VED_BYGG !== "1") {
    console.log("SEED_VED_BYGG er ikke satt — hopper over demodata.");
    return;
  }

  console.log("SEED_VED_BYGG=1 — legger inn demodata.");
  // Dynamisk import: seed-modulen gjør jobben sin når den lastes, så den
  // skal ikke lastes i det hele tatt når dette er avslått.
  await import("./seed");
}

kjor().catch((feil) => {
  console.error("Demodataene kom ikke inn:", feil);
  process.exit(1);
});
