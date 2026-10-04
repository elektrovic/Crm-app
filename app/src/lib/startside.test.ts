import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ROLLER } from "@/db/schema";
import { startside } from "./startside";

test("montøren lander i montørappen", () => {
  assert.equal(startside("montor"), "/hjem");
});

test("ledelsen lander på ledelsesflaten", () => {
  // Dette er feilen som gjorde at Marius så nøyaktig det samme som Tore:
  // rota sendte alle til /hjem, og ingen lenke pekte videre.
  assert.equal(startside("leder"), "/admin");
  assert.equal(startside("admin"), "/admin");
});

test("hver rolle har et sted å lande", () => {
  for (const rolle of ROLLER) {
    assert.match(startside(rolle), /^\/(admin|hjem)$/, `${rolle} havnet ingen steder`);
  }
});
