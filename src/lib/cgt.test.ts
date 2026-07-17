import { test } from "node:test";
import assert from "node:assert/strict";
import {
  marginalRate,
  oldEffectiveRate,
  newEffectiveRate,
  projectStrategies,
  type CgtInputs,
} from "./cgt.ts";

test("marginalRate follows 2025-26 resident brackets plus Medicare levy", () => {
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  close(marginalRate(15000), 0);
  close(marginalRate(40000), 0.18);
  close(marginalRate(75000), 0.32);
  close(marginalRate(150000), 0.39);
  close(marginalRate(250000), 0.47);
});

test("oldEffectiveRate halves the marginal rate", () => {
  assert.equal(oldEffectiveRate(0.32), 0.16);
  assert.equal(oldEffectiveRate(0.47), 0.235);
});

test("newEffectiveRate applies at least 30% to the indexed gain", () => {
  // Median earner, 20y, 8.5% return, 2.5% inflation — FSC ballpark (~27-29%)
  const eff = newEffectiveRate(0.32, 0.085, 0.025, 20);
  assert.ok(eff > 0.25 && eff < 0.29, `got ${eff}`);
  // Low earner is dragged up by the 30% floor
  const low = newEffectiveRate(0.18, 0.085, 0.025, 20);
  assert.ok(low > 0.24, `got ${low}`);
});

test("newEffectiveRate beats the old discount when returns barely outpace inflation", () => {
  const m = 0.32;
  const eff = newEffectiveRate(m, 0.04, 0.026, 10);
  assert.ok(eff < oldEffectiveRate(m), `got ${eff}`);
});

test("newEffectiveRate is zero when there is no real gain", () => {
  assert.equal(newEffectiveRate(0.32, 0.02, 0.026, 10), 0);
});

const base: CgtInputs = {
  salary: 100000,
  monthly: 500,
  sharesReturn: 0.08,
  propertyReturn: 0.06,
  inflation: 0.026,
};

test("projectStrategies returns one point per age 31-60", () => {
  const points = projectStrategies(base);
  assert.equal(points.length, 30);
  assert.equal(points[0].age, 31);
  assert.equal(points[29].age, 60);
});

test("shares under new rules net less than under old rules at healthy returns", () => {
  const last = projectStrategies(base)[29];
  assert.ok(last.sharesOldNet > last.sharesNewNet);
  // Gross value sanity: $500/mo at 8% for 30y is ~$700k
  assert.ok(last.sharesValue > 600000 && last.sharesValue < 800000, `got ${last.sharesValue}`);
});

test("property keeps the discount: at equal returns it matches shares under old rules", () => {
  const last = projectStrategies({ ...base, propertyReturn: base.sharesReturn })[29];
  assert.ok(Math.abs(last.propertyNet - last.sharesOldNet) < 1);
  assert.ok(Math.abs(last.propertyValue - last.sharesValue) < 1);
});

test("higher property growth lifts the property line", () => {
  const low = projectStrategies({ ...base, propertyReturn: 0.04 })[29];
  const high = projectStrategies({ ...base, propertyReturn: 0.09 })[29];
  assert.ok(high.propertyNet > low.propertyNet);
});
