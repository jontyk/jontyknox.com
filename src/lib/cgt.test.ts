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
  const eff = newEffectiveRate(0.32, 0.085, 0.025, 20);
  assert.ok(eff > 0.25 && eff < 0.29, `got ${eff}`);
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
  sharesReturn: 0.08,
  propertyReturn: 0.06,
  initialInvestment: 25000,
  lvr: 0.8,
  mortgageRate: 0.06,
  inflation: 0.026,
};

test("projectStrategies returns one point per age 31-60", () => {
  const points = projectStrategies(base);
  assert.equal(points.length, 30);
  assert.equal(points[0].age, 31);
  assert.equal(points[29].age, 60);
});

test("house, loan and payment derive from deposit, LVR and rate", () => {
  // $25k deposit at 80% LVR buys a $125k house with a $100k loan, and 6%
  // interest-only costs $500/mo.
  const p = projectStrategies(base)[0];
  assert.ok(Math.abs(p.houseValue - 125000) < 1, `house ${p.houseValue}`);
  assert.ok(Math.abs(p.loan - 100000) < 1, `loan ${p.loan}`);
  assert.ok(Math.abs(p.deposit - 25000) < 1, `deposit ${p.deposit}`);
  assert.ok(Math.abs(p.monthly - 500) < 1, `monthly ${p.monthly}`);
});

test("shares strategies invest the deposit upfront plus the monthly amount", () => {
  // Total cash outlay matches the property strategy: deposit + monthly payments.
  const p = projectStrategies(base)[29];
  assert.ok(Math.abs(p.contributed - (25000 + 500 * 360)) < 1, `got ${p.contributed}`);
  // Deposit compounds for the full 30 years: value must exceed monthly-only accumulation
  assert.ok(p.sharesValue > 700000);
});

test("shares under new rules net less than under old rules at healthy returns", () => {
  const last = projectStrategies(base)[29];
  assert.ok(last.sharesOldNet > last.sharesNewNet);
});

test("property equity is house growth minus the standing loan, net of CGT", () => {
  // At 6% growth: equity before tax = 125k*1.06^30 - 100k
  const last = projectStrategies(base)[29];
  const grossEquity = 125000 * Math.pow(1.06, 30) - 100000;
  const gain = 125000 * (Math.pow(1.06, 30) - 1);
  const expectedNet = grossEquity - gain * oldEffectiveRate(marginalRate(base.salary));
  assert.ok(Math.abs(last.propertyNet - expectedNet) < 1, `${last.propertyNet} vs ${expectedNet}`);
});

test("established house pays more CGT than a new build when growth beats inflation", () => {
  const last = projectStrategies(base)[29];
  assert.ok(last.existingNet < last.propertyNet);
});

test("established house pays no CGT when growth stays under inflation", () => {
  const last = projectStrategies({ ...base, propertyReturn: 0.02 })[29];
  const grossEquity = 125000 * Math.pow(1.02, 30) - 100000;
  assert.ok(Math.abs(last.existingNet - grossEquity) < 1);
});

test("property growth leaves the share lines untouched", () => {
  const a = projectStrategies(base)[29];
  const b = projectStrategies({ ...base, propertyReturn: 0.1 })[29];
  assert.equal(a.sharesOldNet, b.sharesOldNet);
  assert.equal(a.sharesNewNet, b.sharesNewNet);
});

test("higher mortgage rate raises the payment, not the house", () => {
  const cheap = projectStrategies({ ...base, mortgageRate: 0.04 })[0];
  const dear = projectStrategies({ ...base, mortgageRate: 0.08 })[0];
  assert.equal(cheap.houseValue, dear.houseValue);
  assert.ok(dear.monthly > cheap.monthly);
});

test("higher LVR buys a bigger house on the same deposit", () => {
  const low = projectStrategies({ ...base, lvr: 0.6 })[0];
  const high = projectStrategies({ ...base, lvr: 0.9 })[0];
  assert.ok(Math.abs(low.houseValue - 62500) < 1, `got ${low.houseValue}`);
  assert.ok(Math.abs(high.houseValue - 250000) < 1, `got ${high.houseValue}`);
});
