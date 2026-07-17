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
  propertyLvr: 0,
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

test("leverage multiplies the property gain (and its CGT)", () => {
  // One parcel intuition: at 80% LVR each deposit dollar controls $5 of
  // property, so the nominal gain per parcel is 5x the unleveraged gain.
  const flat = projectStrategies(base)[29];
  const geared = projectStrategies({ ...base, propertyLvr: 0.8 })[29];
  const flatGain = flat.propertyValue - flat.contributed;
  const gearedGain = geared.propertyValue - geared.contributed;
  assert.ok(Math.abs(gearedGain - flatGain * 5) < 1, `${gearedGain} vs ${flatGain * 5}`);
  // After-tax outcome is far higher, but tax scales with the gain too
  assert.ok(geared.propertyNet > flat.propertyNet * 2);
  const flatTax = flat.propertyValue - flat.propertyNet;
  assert.ok(Math.abs((geared.propertyValue - geared.propertyNet) - flatTax * 5) < 1);
});

test("existing house is taxed like shares: below new builds when growth beats inflation", () => {
  const last = projectStrategies({ ...base, propertyReturn: 0.06, propertyLvr: 0.8 })[29];
  assert.ok(last.existingNet < last.propertyNet);
  // Same gross equity, different tax treatment
  const propTax = last.propertyValue - last.propertyNet;
  const existTax = last.propertyValue - last.existingNet;
  assert.ok(existTax > propTax);
});

test("existing house pays no CGT when growth stays under inflation", () => {
  const last = projectStrategies({ ...base, propertyReturn: 0.02, propertyLvr: 0.8 })[29];
  assert.equal(last.existingNet, last.propertyValue);
});

test("modest leveraged growth beats strong unleveraged shares", () => {
  // 6% property at 80% LVR should outrun 8% shares over 30 years
  const p = projectStrategies({ ...base, propertyLvr: 0.8 })[29];
  assert.ok(p.propertyNet > p.sharesOldNet);
});
