import { test } from "node:test";
import assert from "node:assert/strict";
import {
  suggestCarbs,
  effectiveCarb,
  estimateSweatLPerHr,
  fluidPlan,
  sodiumPlan,
  buildRecipe,
  buildSchedule,
  type FuelInputs,
} from "./fuel.ts";

const base: FuelInputs = {
  hours: 2,
  minutes: 40,
  intensity: "z80",
  weightKg: 72,
  tempC: 15,
  gi: "well",
  sweatSodium: "typical",
  customCarb: null,
  ratio: "1:0.8",
};

test("suggestCarbs uses GI-training base rates", () => {
  assert.equal(suggestCarbs({ ...base, gi: "untrained" }), 60);
  assert.equal(suggestCarbs({ ...base, gi: "moderate" }), 90);
  assert.equal(suggestCarbs({ ...base, gi: "well" }), 105);
});

test("suggestCarbs scales down short easy sessions", () => {
  const easy = { ...base, hours: 1, minutes: 0, intensity: "z60" as const };
  assert.equal(suggestCarbs({ ...easy, gi: "untrained" }), 45);
  assert.equal(suggestCarbs({ ...easy, gi: "well" }), 60);
  assert.equal(suggestCarbs({ ...easy, intensity: "z90" }), 105);
});

test("effectiveCarb prefers a positive custom target", () => {
  assert.equal(effectiveCarb({ ...base, customCarb: 80 }), 80);
  assert.equal(effectiveCarb({ ...base, customCarb: null }), 105);
  assert.equal(effectiveCarb({ ...base, customCarb: 0 }), 105);
});

test("estimateSweat lands near ~0.8 L/hr for the reference ride", () => {
  const s = estimateSweatLPerHr(base);
  assert.ok(s > 0.7 && s < 0.85, `got ${s}`);
});

test("estimateSweat rises with intensity and heat", () => {
  assert.ok(estimateSweatLPerHr({ ...base, intensity: "z90" }) > estimateSweatLPerHr(base));
  assert.ok(estimateSweatLPerHr({ ...base, tempC: 30 }) > estimateSweatLPerHr(base));
  assert.ok(estimateSweatLPerHr({ ...base, tempC: 5 }) < estimateSweatLPerHr(base));
});

test("fluidPlan replaces ~60% of loss, clamped, with a deficit", () => {
  const p = fluidPlan(base);
  assert.ok(p.plannedMlPerHr >= 300 && p.plannedMlPerHr <= 750);
  assert.ok(p.deficitMlPerHr >= 0);
  const hot = fluidPlan({ ...base, tempC: 40, weightKg: 95, intensity: "z90" });
  assert.equal(hot.plannedMlPerHr, 750);
});

test("sodiumPlan scales with sweat rate and sweat-sodium preset", () => {
  const typical = sodiumPlan(base).targetMgPerHr;
  const salty = sodiumPlan({ ...base, sweatSodium: "salty" }).targetMgPerHr;
  assert.ok(salty > typical);
  assert.ok(typical > 0);
});

test("buildRecipe splits carbs by ratio and flags concentration", () => {
  const oneToOne = buildRecipe({ ...base, ratio: "1:1" });
  assert.ok(oneToOne.tableSugarG > 0);
  assert.equal(oneToOne.maltoG, 0);
  assert.equal(oneToOne.fructoseG, 0);

  const r = buildRecipe(base);
  assert.equal(oneToOne.tableSugarG === 0, false);
  assert.ok(Math.abs(r.maltoG / r.fructoseG - 1 / 0.8) < 0.01);
  assert.equal(r.tableSugarG, 0);
  assert.ok(r.saltG > 0);
  assert.ok(r.concentrationPct > 0);
  assert.ok(["none", "soft", "strong"].includes(r.warning));
});

test("buildRecipe caps drink concentration by GI training and fills the surplus with whole gels", () => {
  const dry = buildRecipe({ ...base, customCarb: 120, weightKg: 55, tempC: 5, intensity: "z60" });
  // gi "well" -> 12% cap
  assert.ok(dry.concentrationPct <= 12, `got ${dry.concentrationPct}`);
  assert.ok(dry.gelCount > 0, `got ${dry.gelCount}`);
  assert.equal(dry.gelCarbG, dry.gelCount * 25);
  // gels + drink together hit the total target exactly
  assert.ok(Math.abs(dry.drinkCarbG + dry.gelCarbG - dry.totalCarbG) < 0.2);
  // ingredient split applies to the drink carbs only
  assert.ok(Math.abs(dry.maltoG + dry.fructoseG - dry.drinkCarbG) < 0.2);
});

test("buildRecipe uses a lower concentration cap for less GI-trained riders", () => {
  const inputs = { ...base, customCarb: 100, gi: "untrained" as const };
  const untrained = buildRecipe(inputs);
  const well = buildRecipe({ ...inputs, gi: "well" });
  assert.ok(untrained.concentrationPct <= 8, `got ${untrained.concentrationPct}`);
  assert.ok(untrained.gelCount >= well.gelCount);
});

test("buildRecipe prefers gels over a maxed-out drink (drink lands below the cap)", () => {
  const r = buildRecipe({ ...base, customCarb: 120, weightKg: 55, tempC: 5, intensity: "z60" });
  // whole gels (ceil) absorb the surplus, so the drink stays at or below its cap
  const conc = r.drinkCarbG / r.totalWaterMl;
  assert.ok(conc <= 0.12 + 1e-9, `got ${conc}`);
});

test("buildRecipe keeps all carbs in the drink when they fit under the cap", () => {
  const easy = buildRecipe({ ...base, gi: "untrained", tempC: 35, customCarb: 50 });
  assert.equal(easy.gelCount, 0);
  assert.equal(easy.gelCarbG, 0);
  assert.ok(Math.abs(easy.drinkCarbG - easy.totalCarbG) < 0.2);
});

test("buildSchedule spreads gels across mid-ride rows and totals match", () => {
  const i = { ...base, customCarb: 120, weightKg: 55, tempC: 5, intensity: "z60" as const };
  const recipe = buildRecipe(i);
  const rows = buildSchedule(i);
  const gelSum = rows.reduce((a, r) => a + r.gels, 0);
  assert.equal(gelSum, recipe.gelCount);
  // no gel at pre-start
  assert.equal(rows[0].gels, 0);
});

test("buildSchedule never places the first gel before 40 minutes", () => {
  // lots of gels on a long ride
  const i = { ...base, hours: 4, minutes: 0, customCarb: 120, gi: "untrained" as const };
  const rows = buildSchedule(i);
  const firstGel = rows.find((r) => r.gels > 0);
  assert.ok(firstGel, "expected at least one gel");
  assert.ok(firstGel!.timeMin >= 40, `first gel at ${firstGel!.timeMin} min`);
});

test("buildSchedule spaces gels at least 40 minutes apart when they fit", () => {
  const i = { ...base, hours: 4, minutes: 0, customCarb: 110, gi: "moderate" as const };
  const rows = buildSchedule(i);
  const gelTimes = rows.filter((r) => r.gels > 0).flatMap((r) => Array(r.gels).fill(r.timeMin));
  const totalGels = gelTimes.length;
  // enough 40-min slots exist (4h ride -> slots at 40..220)
  if (totalGels > 0 && totalGels <= 5) {
    for (let k = 1; k < gelTimes.length; k++) {
      assert.ok(gelTimes[k] - gelTimes[k - 1] >= 40, `gap ${gelTimes[k] - gelTimes[k - 1]}`);
    }
  }
});

test("buildRecipe caps drink sodium at 700 mg/L and reports the unreplaced remainder", () => {
  // salty sweater, very hot: uncapped would exceed 1000 mg/L
  const hot = buildRecipe({ ...base, tempC: 38, sweatSodium: "salty" });
  const mgPerL = hot.sodiumMg / (hot.totalWaterMl / 1000);
  assert.ok(mgPerL <= 700 + 1, `got ${mgPerL} mg/L`);
  assert.ok(hot.sodiumShortfallMg > 0, `got ${hot.sodiumShortfallMg}`);
  // mild day: no cap, no shortfall
  const mild = buildRecipe({ ...base, tempC: 12, sweatSodium: "low" });
  assert.equal(mild.sodiumShortfallMg, 0);
});

test("buildSchedule emits a pre-start drink plus 20-min steps that sum to the drink totals", () => {
  const rows = buildSchedule(base);
  assert.equal(rows[0].label, "Pre-Start");
  assert.ok(rows.length >= 2);
  const carbSum = rows.reduce((a, r) => a + r.carbG, 0);
  const recipe = buildRecipe(base);
  assert.ok(Math.abs(carbSum - recipe.drinkCarbG) < 0.5, `sum ${carbSum} vs ${recipe.drinkCarbG}`);
});

test("buildSchedule's last drink lands one step before the ride ends, not at the end", () => {
  // 2:00 ride -> last sip at 01:40, not 02:00
  const rows = buildSchedule({ ...base, hours: 2, minutes: 0 });
  const last = rows[rows.length - 1];
  assert.equal(last.timeMin, 100, `got ${last.timeMin}`);
  // still sums to the full drink totals
  const carbSum = rows.reduce((a, r) => a + r.carbG, 0);
  const recipe = buildRecipe({ ...base, hours: 2, minutes: 0 });
  assert.ok(Math.abs(carbSum - recipe.drinkCarbG) < 0.5, `sum ${carbSum} vs ${recipe.drinkCarbG}`);
});

test("buildSchedule still emits at least one mid-ride drink on short rides", () => {
  const rows = buildSchedule({ ...base, hours: 0, minutes: 30 });
  assert.equal(rows[0].label, "Pre-Start");
  assert.ok(rows.length >= 2, `got ${rows.length} rows`);
  assert.ok(rows[rows.length - 1].timeMin < 30);
});
