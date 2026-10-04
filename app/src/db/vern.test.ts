import { test } from "node:test";
import assert from "node:assert/strict";
import { erProduksjonsbase, erSikkertIkkeProduksjon, krevRiktigBase } from "./vern";

const PROD = "postgres://montorappen:xxx@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?options=project%3Doezmybcojfjkpifypgvw";
const TEST = "postgres://montorappen:xxx@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?options=project%3Dabcdefghijklmnopqrst";
const LOKAL = "postgres://montor@127.0.0.1:5432/montorappen";

test("MILJO=lokal og MILJO=test er bevis på at dette ikke er produksjon", () => {
  assert.equal(erSikkertIkkeProduksjon({ MILJO: "lokal" }), true);
  assert.equal(erSikkertIkkeProduksjon({ MILJO: "test" }), true);
  assert.equal(erSikkertIkkeProduksjon({ MILJO: "TEST" }), true);
});

test("MILJO=produksjon slår gjennom selv om Netlify sier noe annet", () => {
  // Rekkefølgen betyr noe: skal produksjon en gang bygges fra en gren,
  // må det være mulig å si det uten å endre koden.
  assert.equal(
    erSikkertIkkeProduksjon({ MILJO: "produksjon", CONTEXT: "branch-deploy" }),
    false,
  );
});

test("Netlify sine egne kontekster gjenkjennes", () => {
  assert.equal(erSikkertIkkeProduksjon({ CONTEXT: "branch-deploy" }), true);
  assert.equal(erSikkertIkkeProduksjon({ CONTEXT: "deploy-preview" }), true);
  assert.equal(erSikkertIkkeProduksjon({ CONTEXT: "production" }), false);
});

test("next dev er bevis nok i seg selv", () => {
  assert.equal(erSikkertIkkeProduksjon({ NODE_ENV: "development" }), true);
  assert.equal(erSikkertIkkeProduksjon({ NODE_ENV: "production" }), false);
});

test("tomt miljø regnes som produksjon, ikke som test", () => {
  // Med vilje. En glemt variabel skal ikke ta ned den ekte appen for
  // alle montørene — den skal bare la den stå.
  assert.equal(erSikkertIkkeProduksjon({}), false);
});

test("produksjonsbasen kjennes igjen på prosjektreferansen", () => {
  assert.equal(erProduksjonsbase(PROD, {}), true);
  assert.equal(erProduksjonsbase(TEST, {}), false);
  assert.equal(erProduksjonsbase(LOKAL, {}), false);
});

test("referansen kan overstyres når produksjon en gang flyttes", () => {
  assert.equal(erProduksjonsbase(TEST, { PRODUKSJONSBASE: "abcdefghijklmnopqrst" }), true);
  assert.equal(erProduksjonsbase(PROD, { PRODUKSJONSBASE: "abcdefghijklmnopqrst" }), false);
});

test("lokalt oppsett mot produksjonsbasen stoppes", () => {
  assert.throws(
    () => krevRiktigBase(PROD, { MILJO: "lokal" }),
    /peker på produksjonsbasen/,
  );
});

test("testgrenen mot produksjonsbasen stoppes", () => {
  assert.throws(
    () => krevRiktigBase(PROD, { CONTEXT: "branch-deploy" }),
    /Testmiljøet skal ha sin egen base/,
  );
});

test("testmiljø mot testbasen slipper gjennom", () => {
  assert.doesNotThrow(() => krevRiktigBase(TEST, { MILJO: "test" }));
  assert.doesNotThrow(() => krevRiktigBase(LOKAL, { MILJO: "lokal" }));
});

test("produksjon mot produksjonsbasen slipper gjennom", () => {
  assert.doesNotThrow(() => krevRiktigBase(PROD, { MILJO: "produksjon" }));
  assert.doesNotThrow(() => krevRiktigBase(PROD, { CONTEXT: "production" }));
});

test("feilmeldingen sier hvilket miljø som ble stoppet", () => {
  assert.throws(() => krevRiktigBase(PROD, { MILJO: "test" }), /dette er test/);
});
