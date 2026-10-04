/**
 * Vernet mot å skrive i produksjonsdatabasen fra test.
 *
 * Skillet mellom test og produksjon kan bygges på to måter. Den vanlige
 * er å sette riktig DATABASE_URL i riktig miljø og huske det hver gang.
 * Den holder helt til den dagen noen ikke husker det — og da oppdages
 * feilen etter at testdataene ligger i den ekte basen.
 *
 * Denne er den andre måten: appen nekter å koble til produksjonsbasen
 * når den vet at den ikke er produksjon. Da er skillet en egenskap ved
 * koden, ikke ved hukommelsen til den som satte opp miljøvariablene.
 *
 * Verten er ikke en hemmelighet — den er maskinnavnet som står i enhver
 * URL mot basen. Passordet er hemmeligheten, og det står ingen steder
 * her.
 */

/** Prosjektreferansen til produksjonsbasen hos Supabase. */
const PRODUKSJONSBASE_STANDARD = "oezmybcojfjkpifypgvw";

/**
 * Når vet vi sikkert at dette ikke er produksjon?
 *
 * Bare når noe sier det positivt. Vi gjetter ikke motsatt vei: en
 * uventet tom variabel skal ikke ta ned den ekte appen for alle
 * montørene. Derfor er listen under tre ting som hver for seg er bevis,
 * og tausheten regnes som produksjon.
 *
 *  - MILJO        settes av oss, i .env lokalt og per kontekst i Netlify.
 *  - CONTEXT      settes av Netlify selv, og kan ikke glemmes der.
 *  - NODE_ENV     settes av `next dev`, og kan heller ikke glemmes.
 */
export function erSikkertIkkeProduksjon(miljo: Record<string, string | undefined>): boolean {
  const satt = miljo.MILJO?.trim().toLowerCase();
  if (satt === "test" || satt === "lokal") return true;
  if (satt === "produksjon") return false;

  const kontekst = miljo.CONTEXT?.trim().toLowerCase();
  if (kontekst === "branch-deploy" || kontekst === "deploy-preview" || kontekst === "dev") {
    return true;
  }

  return miljo.NODE_ENV === "development";
}

/** Peker denne URL-en på produksjonsbasen? */
export function erProduksjonsbase(
  url: string,
  miljo: Record<string, string | undefined> = process.env,
): boolean {
  const kjennetegn = miljo.PRODUKSJONSBASE?.trim() || PRODUKSJONSBASE_STANDARD;
  if (!kjennetegn) return false;
  return url.includes(kjennetegn);
}

export class FeilBaseFeil extends Error {
  constructor(melding: string) {
    super(melding);
    this.name = "FeilBaseFeil";
  }
}

/**
 * Stopper alt dersom et testmiljø peker på produksjonsbasen.
 *
 * Kastes den under bygging, feiler bygget — og det er riktig. Et bygg
 * som ikke gikk gjennom er en halv time. Testdata i produksjonsbasen er
 * en kveld med opprydding, og tvil om tallene lenge etterpå.
 */
export function krevRiktigBase(
  url: string,
  miljo: Record<string, string | undefined> = process.env,
): void {
  if (!erSikkertIkkeProduksjon(miljo)) return;
  if (!erProduksjonsbase(url, miljo)) return;

  const hvem = miljo.MILJO?.trim() || miljo.CONTEXT?.trim() || "et lokalt oppsett";

  throw new FeilBaseFeil(
    `DATABASE_URL peker på produksjonsbasen, men dette er ${hvem}. ` +
      "Testmiljøet skal ha sin egen base. Se docs/testmiljo.md. " +
      "Er dette likevel produksjon, må MILJO settes til «produksjon».",
  );
}
