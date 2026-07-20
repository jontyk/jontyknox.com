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
  // High yield so rent always covers interest: no shortfall in the base case.
  rentalYield: 0.06,
  startAge: 30,
  endAge: 60,
  inflation: 0.026,
};

test("projectStrategies returns one point per age 31-60", () => {
  const points = projectStrategies(base);
  assert.equal(points.length, 30);
  assert.equal(points[0].age, 31);
  assert.equal(points[29].age, 60);
});

test("age range is configurable", () => {
  const points = projectStrategies({ ...base, startAge: 25, endAge: 40 });
  assert.equal(points.length, 15);
  assert.equal(points[0].age, 26);
  assert.equal(points[14].age, 40);
  // Same horizon length means the same outcomes regardless of calendar age
  const shifted = projectStrategies({ ...base, startAge: 40, endAge: 55 });
  assert.equal(points[14].sharesOldNet, shifted[14].sharesOldNet);
});

test("negative property growth: falling house, no CGT, equity can sink", () => {
  // 3% rate keeps rent above interest even as the house falls, isolating equity.
  const points = projectStrategies({ ...base, propertyReturn: -0.02, lvr: 0.9, mortgageRate: 0.03 });
  const last = points[points.length - 1];
  // $25k deposit, 90% LVR: $250k house, $225k loan. At -2%/yr for 30y the
  // house is worth ~$137k — deep under the loan.
  const houseNow = 250000 * Math.pow(0.98, 30);
  assert.ok(Math.abs(last.propertyNet - (houseNow - 225000)) < 1, `got ${last.propertyNet}`);
  assert.ok(last.propertyNet < 0);
  // No gain, so new build and established differ only by holding costs
  assert.ok(last.existingNet <= last.propertyNet);
});

test("house and loan derive from deposit and LVR", () => {
  // $25k deposit at 80% LVR buys a $125k house with a $100k loan.
  const p = projectStrategies(base)[0];
  assert.ok(Math.abs(p.houseValue - 125000) < 1, `house ${p.houseValue}`);
  assert.ok(Math.abs(p.loan - 100000) < 1, `loan ${p.loan}`);
  assert.ok(Math.abs(p.deposit - 25000) < 1, `deposit ${p.deposit}`);
});

test("shares are a single lump sum compounding untouched", () => {
  const last = projectStrategies(base)[29];
  const expected = 25000 * Math.pow(1.08, 30);
  assert.ok(Math.abs(last.sharesValue - expected) < 1, `got ${last.sharesValue}`);
});

test("LVR changes the property lines only", () => {
  const a = projectStrategies(base)[29];
  const b = projectStrategies({ ...base, lvr: 0.95 })[29];
  assert.equal(a.sharesOldNet, b.sharesOldNet);
  assert.equal(a.sharesNewNet, b.sharesNewNet);
  assert.ok(b.propertyNet > a.propertyNet);
});

test("property growth leaves the share lines untouched", () => {
  const a = projectStrategies(base)[29];
  const b = projectStrategies({ ...base, propertyReturn: 0.1 })[29];
  assert.equal(a.sharesOldNet, b.sharesOldNet);
  assert.equal(a.sharesNewNet, b.sharesNewNet);
});

test("shares under new rules net less than under old rules at healthy returns", () => {
  const last = projectStrategies(base)[29];
  assert.ok(last.sharesOldNet > last.sharesNewNet);
});

test("property equity is house growth minus the standing loan, net of CGT", () => {
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

test("higher LVR buys a bigger house on the same deposit", () => {
  const low = projectStrategies({ ...base, lvr: 0.6 })[0];
  const high = projectStrategies({ ...base, lvr: 0.9 })[0];
  assert.ok(Math.abs(low.houseValue - 62500) < 1, `got ${low.houseValue}`);
  assert.ok(Math.abs(high.houseValue - 250000) < 1, `got ${high.houseValue}`);
});

test("no shortfall accrues while rent covers the interest", () => {
  // 6% yield on a $125k house ($7.5k rent) vs 6% on the $100k loan ($6k).
  const last = projectStrategies(base)[29];
  assert.equal(last.shortfall, 0);
});

test("mortgage rate and yield touch the property lines only", () => {
  const a = projectStrategies(base)[29];
  const b = projectStrategies({ ...base, mortgageRate: 0.09, rentalYield: 0.02 })[29];
  assert.equal(a.sharesOldNet, b.sharesOldNet);
  assert.equal(a.sharesNewNet, b.sharesNewNet);
  assert.ok(b.propertyNet < a.propertyNet);
});

test("negative gearing: new build deducts the shortfall, established pays it in full", () => {
  // Zero rent makes the shortfall the whole interest bill each year.
  const zeroRent = projectStrategies({ ...base, rentalYield: 0 });
  const withRent = projectStrategies(base);
  const last = zeroRent[29];
  const covered = withRent[29];
  const m = marginalRate(base.salary);
  const interest30y = 100000 * 0.06 * 30;
  assert.ok(Math.abs(last.shortfall - interest30y) < 1, `got ${last.shortfall}`);
  // New build bears (1-m) of the shortfall, established bears all of it.
  assert.ok(Math.abs(covered.propertyNet - last.propertyNet - interest30y * (1 - m)) < 1);
  assert.ok(Math.abs(covered.existingNet - last.existingNet - interest30y) < 1);
});

test("first-year shortfall uses rent on the purchase price", () => {
  // 2% yield on $125k = $2.5k rent vs $6k interest: $3.5k shortfall in year one.
  const first = projectStrategies({ ...base, rentalYield: 0.02 })[0];
  assert.ok(Math.abs(first.shortfall - 3500) < 1, `got ${first.shortfall}`);
});

test("growing rent can close the gearing gap over time", () => {
  // Start negative (2% yield), 6% growth: rent eventually overtakes interest
  // and the annual shortfall stops accruing.
  const points = projectStrategies({ ...base, rentalYield: 0.02 });
  const annual = points.map((p, i) => p.shortfall - (i ? points[i - 1].shortfall : 0));
  assert.ok(annual[0] > 0);
  assert.equal(annual[29], 0);
});
