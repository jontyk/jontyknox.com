import { test } from "node:test";
import assert from "node:assert/strict";
import {
  marginalRate,
  oldEffectiveRate,
  newEffectiveRate,
  projectPortfolio,
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
  annualReturn: 0.08,
  inflation: 0.026,
  sharesPct: 1,
};

test("projectPortfolio returns one point per age 31-60", () => {
  const points = projectPortfolio(base);
  assert.equal(points.length, 30);
  assert.equal(points[0].age, 31);
  assert.equal(points[29].age, 60);
});

test("projectPortfolio: new regime taxes more than old at healthy returns", () => {
  const points = projectPortfolio(base);
  const last = points[29];
  assert.ok(last.newTax > last.oldTax);
  assert.ok(last.oldNet > last.newNet);
  // Gross value sanity: $500/mo at 8% for 30y is ~$700k
  assert.ok(last.value > 600000 && last.value < 800000, `got ${last.value}`);
});

test("projectPortfolio: 100% new-build property keeps the old treatment", () => {
  const points = projectPortfolio({ ...base, sharesPct: 0 });
  const last = points[29];
  assert.ok(Math.abs(last.newTax - last.oldTax) < 1);
});

test("projectPortfolio: mixed portfolio blends the two treatments", () => {
  const all = projectPortfolio(base)[29];
  const half = projectPortfolio({ ...base, sharesPct: 0.5 })[29];
  const expected = all.oldTax + (all.newTax - all.oldTax) * 0.5;
  assert.ok(Math.abs(half.newTax - expected) < 1);
});
