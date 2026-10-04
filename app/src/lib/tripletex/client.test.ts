import { strict as assert } from "node:assert";
import { test } from "node:test";
import { byggSesjonsforesporsel, lesSesjonssvar, STANDARD_BASE, TripletexFeil } from "./client";

const NAA = Date.parse("2026-10-04T09:00:00Z");
// Testmiljøet brukes som fikstur, så ingen leser den som produksjon.
const BASE = { TRIPLETEX_BASE_URL: "https://api-test.tripletex.tech/v2" };

test("JWT velges når den finnes, og sendes i kroppen", () => {
  const f = byggSesjonsforesporsel({ ...BASE, TRIPLETEX_JWT: "ey.hemmelig.jwt" }, NAA);

  assert.equal(f.maate, "jwt");
  assert.equal(f.init.method, "POST");
  assert.equal(
    f.url,
    "https://api-test.tripletex.tech/v2/token/session/:createFromRefreshToken",
  );
  // Det viktigste: tokenet skal ikke stå i adressen, der det havner i logger.
  assert.ok(!f.url.includes("ey."), "JWT lekket inn i URL-en");
  assert.deepEqual(JSON.parse(String(f.init.body)), {
    refreshToken: "ey.hemmelig.jwt",
    ttlSeconds: 86400,
  });
});

test("JWT vinner over de gamle nøklene når begge er satt", () => {
  const f = byggSesjonsforesporsel(
    {
      ...BASE,
      TRIPLETEX_JWT: "ny",
      TRIPLETEX_CONSUMER_TOKEN: "gammel-c",
      TRIPLETEX_EMPLOYEE_TOKEN: "gammel-e",
    },
    NAA,
  );
  assert.equal(f.maate, "jwt");
});

test("blank JWT teller ikke som satt", () => {
  const f = byggSesjonsforesporsel(
    { ...BASE, TRIPLETEX_JWT: "   ", TRIPLETEX_CONSUMER_TOKEN: "c", TRIPLETEX_EMPLOYEE_TOKEN: "e" },
    NAA,
  );
  assert.equal(f.maate, "consumer+employee");
});

test("den gamle veien brukes når bare de to gamle nøklene finnes", () => {
  const f = byggSesjonsforesporsel(
    { ...BASE, TRIPLETEX_CONSUMER_TOKEN: "c-tok", TRIPLETEX_EMPLOYEE_TOKEN: "e-tok" },
    NAA,
  );
  assert.equal(f.maate, "consumer+employee");
  assert.equal(f.init.method, "PUT");
  const url = new URL(f.url);
  assert.equal(url.pathname, "/v2/token/session/:create");
  assert.equal(url.searchParams.get("consumerToken"), "c-tok");
  assert.equal(url.searchParams.get("employeeToken"), "e-tok");
  assert.equal(url.searchParams.get("expirationDate"), "2026-10-05");
});

test("uten nøkler i det hele tatt sier feilen hva som mangler", () => {
  assert.throws(
    () => byggSesjonsforesporsel(BASE, NAA),
    (f: unknown) => f instanceof TripletexFeil && /TRIPLETEX_JWT/.test((f as Error).message),
  );
});

test("sesjonstokenet leses ut av innpakningen", () => {
  const s = lesSesjonssvar({ value: { token: "sesjon-123" } }, NAA);
  assert.equal(s.token, "sesjon-123");
  assert.equal(s.utloper, NAA, "uten oppgitt utløp brukes vårt eget anslag");
});

test("utløpet fra Tripletex vinner over vårt anslag", () => {
  const s = lesSesjonssvar(
    { value: { token: "t", expirationDate: "2026-10-06T00:00:00Z" } },
    NAA,
  );
  assert.equal(s.utloper, Date.parse("2026-10-06T00:00:00Z"));
});

test("svar uten innpakning leses også", () => {
  assert.equal(lesSesjonssvar({ token: "naken" }, NAA).token, "naken");
});

test("manglende token blir en tydelig feil, ikke undefined", () => {
  assert.throws(
    () => lesSesjonssvar({ value: {} }, NAA),
    (f: unknown) => f instanceof TripletexFeil && (f as TripletexFeil).status === 502,
  );
});

test("standardadressen peker på Tripletex sitt produksjonsmiljø", () => {
  // «api.tripletex.io» sto her før. Den verten ligger bak en CloudFront
  // som bare tar GET og HEAD, så hvert skrivende kall døde med 403 og en
  // HTML-side før Tripletex så det. Denne testen holder på verten.
  assert.equal(STANDARD_BASE, "https://tripletex.no/v2");
});

test("uten TRIPLETEX_BASE_URL brukes produksjonsadressen", () => {
  const f = byggSesjonsforesporsel({ TRIPLETEX_JWT: "ey.x" }, NAA);
  assert.ok(
    f.url.startsWith("https://tripletex.no/v2/"),
    `pekte på feil vert: ${f.url}`,
  );
});
