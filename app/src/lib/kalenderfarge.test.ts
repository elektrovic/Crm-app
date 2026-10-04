import { test } from "node:test";
import assert from "node:assert/strict";
import { KALENDERFARGER, prosjektfarge } from "./kalenderfarge";

test("samme prosjekt får samme farge hver gang", () => {
  const id = "9c96c2d8-5d87-40de-93d2-84a002ef028c";
  assert.equal(prosjektfarge(id), prosjektfarge(id));
});

test("fargen er alltid en av de tolv", () => {
  for (let i = 0; i < 300; i++) {
    assert.ok(KALENDERFARGER.includes(prosjektfarge(crypto.randomUUID()) as never));
  }
});

test("ulike prosjekter havner ikke alle på samme farge", () => {
  // Uten spredning ville rutenettet vært ensfarget, og da er fargen
  // ingen opplysning.
  const brukt = new Set(Array.from({ length: 60 }, () => prosjektfarge(crypto.randomUUID())));
  assert.ok(brukt.size >= 8, `bare ${brukt.size} farger i bruk`);
});

test("id-er som ligner gir ulik farge", () => {
  // Prosjekt-id-er fra samme import ligner hverandre tegn for tegn.
  const a = prosjektfarge("00000000-0000-0000-0000-000000000001");
  const b = prosjektfarge("00000000-0000-0000-0000-000000000002");
  const c = prosjektfarge("00000000-0000-0000-0000-000000000003");
  assert.ok(new Set([a, b, c]).size > 1);
});

test("tom id gir en gyldig farge i stedet for å feile", () => {
  assert.ok(KALENDERFARGER.includes(prosjektfarge("") as never));
});
