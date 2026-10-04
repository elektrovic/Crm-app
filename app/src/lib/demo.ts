/**
 * Demomodus.
 *
 * Systemet logger normalt inn med Microsoft Entra ID. Det krever en
 * app-registrering, og den er ikke på plass før noen setter den opp. Da er
 * det ingen vei inn i appen i det hele tatt — heller ikke for å se på den.
 *
 * Demomodus åpner en dør til: man velger en ansatt fra lista i stedet for å
 * logge inn med Entra.
 *
 * Derfor er dette farlig, og derfor er det bygget slik:
 *
 * - Den er avslått med mindre DEMO_INNLOGGING står til «1». Standard er av.
 * - Den slipper bare inn ansatte som allerede finnes og er aktive i
 *   databasen. Den lager ingen kontoer.
 * - Den krever DEMO_PASSORD. Uten det satt er døra stengt, ikke åpen — en
 *   manglende hemmelighet skal aldri bety fri adgang.
 * - Innloggingssida sier tydelig at demomodus er på, slik at ingen tror de
 *   ser et sikret system når de ikke gjør det.
 *
 * Den skal stå AV i det øyeblikket ekte kundedata legges inn.
 */
export const DEMO_INNLOGGING = process.env.DEMO_INNLOGGING === "1";

/**
 * Felles passord foran demodøra.
 *
 * Dette sto tidligere i Netlify, som en sperre foran hele nettstedet. Den
 * sperren lå også foran API-rutene, så den planlagte synken mot Tripletex
 * ble blokkert sammen med alt annet. Sperren hører hjemme her, der den kan
 * gjelde menneskene og ikke maskinene.
 */
export const DEMO_PASSORD = process.env.DEMO_PASSORD ?? "";

/** Demodøra er bare åpen når begge er på plass. */
export const DEMO_KLAR = DEMO_INNLOGGING && DEMO_PASSORD.length > 0;
