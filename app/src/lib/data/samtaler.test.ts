import { test } from "node:test";
import assert from "node:assert/strict";
import { apneForslag, varighet } from "./samtaler";

test("et forslag som er tatt i bruk tilbys ikke igjen", () => {
  assert.deepEqual(
    apneForslag(["Ring tilbake om pris", "Send tilbud"], ["Send tilbud"]),
    ["Ring tilbake om pris"],
  );
});

test("uten noe brukt står alle forslagene igjen", () => {
  assert.deepEqual(apneForslag(["A", "B"], null), ["A", "B"]);
});

test("ingen forslag gir tom liste, ikke null", () => {
  assert.deepEqual(apneForslag(null, null), []);
  assert.deepEqual(apneForslag(null, ["A"]), []);
});

test("rekkefølgen fra Pocket beholdes", () => {
  assert.deepEqual(apneForslag(["C", "A", "B"], ["A"]), ["C", "B"]);
});

test("varighet rundes til minutter, og korte samtaler vises i sekunder", () => {
  assert.equal(varighet(45), "45 sek");
  assert.equal(varighet(60), "1 min");
  assert.equal(varighet(254), "4 min");
});

test("uten varighet vises ingenting i stedet for «0 min»", () => {
  assert.equal(varighet(null), null);
  assert.equal(varighet(0), null);
});
