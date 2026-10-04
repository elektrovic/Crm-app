import { test } from "node:test";
import assert from "node:assert/strict";
import { byggCsp, sikkerhetsHeadere } from "./csp";

test("produksjon slipper aldri gjennom eval", () => {
  // Dette er hele grunnen til at fila har tester. Lettelsen som ble lagt
  // inn for å få `next dev` til å kjøre, skal aldri følge med ut.
  assert.ok(!byggCsp(false).includes("unsafe-eval"));
});

test("produksjon snakker bare med seg selv", () => {
  const csp = byggCsp(false);
  assert.ok(csp.includes("connect-src 'self';") || csp.endsWith("connect-src 'self'"));
  assert.ok(!csp.includes("localhost"));
});

test("utvikling får eval, fordi React krever det", () => {
  assert.ok(byggCsp(true).includes("'unsafe-eval'"));
});

test("utvikling får websocket, så koden kan byttes mens sida står", () => {
  assert.ok(byggCsp(true).includes("ws://localhost:*"));
});

test("resten av reglene er like i begge", () => {
  const uten = (csp: string) =>
    csp
      .split("; ")
      .filter((d) => !d.startsWith("script-src") && !d.startsWith("connect-src"));
  assert.deepEqual(uten(byggCsp(true)), uten(byggCsp(false)));
});

test("rammer fra andre nettsteder er stengt ute uansett", () => {
  for (const csp of [byggCsp(true), byggCsp(false)]) {
    assert.ok(csp.includes("frame-ancestors 'none'"));
  }
});

test("headerne har med seg både ramme- og innholdsvernet", () => {
  const navn = sikkerhetsHeadere(false).map((h) => h.key);
  assert.ok(navn.includes("X-Frame-Options"));
  assert.ok(navn.includes("Content-Security-Policy"));
  assert.ok(navn.includes("Strict-Transport-Security"));
});
