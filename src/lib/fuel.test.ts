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
  bottleCount: 2,
  bottleSizeMl: 750,
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
  // gut cap is 750/hr, but carrying 2x750 over 2:40 caps planned intake lower
  assert.equal(hot.idealMlPerHr, 750);
  assert.equal(hot.plannedMlPerHr, Math.round(1500 / (2 + 40 / 60)));
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
  // every carb is accounted for: drink + gels + explicitly-unmet remainder
  assert.ok(Math.abs(dry.drinkCarbG + dry.gelCarbG + dry.unmetCarbG - dry.totalCarbG) < 0.2);
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
  const easy = buildRecipe({ ...base, gi: "untrained", tempC: 35, customCarb: 25 });
  assert.equal(easy.gelCount, 0);
  assert.equal(easy.gelCarbG, 0);
  assert.ok(Math.abs(easy.drinkCarbG - easy.totalCarbG) < 0.2);
});

test("buildRecipe respects the ~2 gels/hr gut ceiling and reports unmet carbs", () => {
  // absurd target on a short ride: gels can't cover it all
  const r = buildRecipe({ ...base, hours: 1, minutes: 0, customCarb: 150 });
  assert.ok(r.gelCount <= 2, `got ${r.gelCount}`);
  assert.ok(r.unmetCarbG > 0, `got ${r.unmetCarbG}`);
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

test("buildRecipe caps drink sodium at 700 mg/L of mix and reports the unreplaced remainder", () => {
  // salty sweater, very hot: uncapped would exceed 1000 mg/L
  const hot = buildRecipe({ ...base, tempC: 38, sweatSodium: "salty" });
  if (hot.totalWaterMl > 0) {
    const mgPerL = hot.sodiumMg / (hot.totalWaterMl / 1000);
    assert.ok(mgPerL <= 700 + 1, `got ${mgPerL} mg/L`);
  }
  assert.ok(hot.sodiumShortfallMg > 0, `got ${hot.sodiumShortfallMg}`);
  // short mild ride: sodium fits in the mix, no shortfall
  const mild = buildRecipe({ ...base, hours: 1, minutes: 0, tempC: 12, sweatSodium: "low" });
  assert.equal(mild.sodiumShortfallMg, 0);
});

test("bottle allocation: recommends a mix/plain split within carried fluid", () => {
  const r = buildRecipe(base);
  assert.equal(r.bottleSizeMl, 750);
  assert.equal(r.mixBottles + r.plainBottles, 2);
  // mix fits in the bottles assigned to it (bottles may be part-filled)
  assert.ok(r.totalWaterMl <= r.mixBottles * 750 + 1);
  // can't plan to drink more mix than the fluid target allows
  const intake = fluidPlan(base).plannedMlPerHr * (2 + 40 / 60);
  assert.ok(r.totalWaterMl <= intake + 2);
});

test("bottle allocation: keeps enough plain water for the gels it schedules", () => {
  const r = buildRecipe({ ...base, gi: "moderate" });
  if (r.gelCount > 0 && r.gelWaterShortMl === 0) {
    assert.ok(r.plainBottles * r.bottleSizeMl >= r.gelCount * 150 - 1);
  }
  // carbs always add up: drink + gels + explicitly-unmet = target
  assert.ok(Math.abs(r.drinkCarbG + r.gelCarbG + r.unmetCarbG - r.totalCarbG) < 0.2);
});

test("fluid plan is capped by carried bottles and flags the refill shortfall", () => {
  // long hot ride, tiny carrying capacity
  const i = { ...base, hours: 5, minutes: 0, tempC: 30, bottleCount: 1, bottleSizeMl: 500 };
  const p = fluidPlan(i);
  assert.ok(p.plannedMlPerHr * 5 <= 500 + 1, `planned ${p.plannedMlPerHr}/hr exceeds carried`);
  const r = buildRecipe(i);
  assert.ok(r.refillShortfallMl > 0, `got ${r.refillShortfallMl}`);
  // comfortable case: no refill needed
  assert.equal(buildRecipe(base).refillShortfallMl, 0);
});

test("bottle allocation: gel water comes from the carried bottles, not a phantom extra", () => {
  // 2h at 90 g/hr with 2x750: can't fit 180 g in the mix alone, so one
  // bottle must go plain for the gels' water
  const i = { ...base, hours: 2, minutes: 0, gi: "moderate" as const, weightKg: 76, tempC: 27 };
  const r = buildRecipe(i);
  assert.ok(r.gelCount > 0, `got ${r.gelCount} gels`);
  assert.ok(r.plainBottles >= 1, `got ${r.plainBottles} plain bottles`);
  assert.equal(r.gelWaterShortMl, 0, `short ${r.gelWaterShortMl} ml`);
  assert.ok(r.plainBottles * r.bottleSizeMl >= r.gelCount * 150 - 1);
});

test("bottle allocation: prefers covering the carb target over avoiding gels", () => {
  const i = { ...base, hours: 2, minutes: 0, gi: "moderate" as const, weightKg: 76, tempC: 27 };
  const r = buildRecipe(i);
  // 180 g target: mix-only tops out at ~146 g; with gels the plan gets close
  assert.ok(r.unmetCarbG < 15, `unmet ${r.unmetCarbG} g`);
});

test("bottle allocation: doesn't add gels to close a trivial carb gap", () => {
  // untrained, 2h at 60 g/hr = 120 g target; two 750 ml bottles at the 8%
  // cap hold ~117 g. A ~3 g shortfall shouldn't cost a bottle and 3 gels.
  const i = {
    ...base,
    hours: 2,
    minutes: 0,
    gi: "untrained" as const,
    weightKg: 76,
    tempC: 27,
  };
  const r = buildRecipe(i);
  assert.equal(r.gelCount, 0, `got ${r.gelCount} gels`);
  assert.equal(r.mixBottles, 2);
  assert.ok(r.unmetCarbG < 6, `unmet ${r.unmetCarbG} g`);
});

test("bottle allocation: still adds gels for a real carb gap", () => {
  // moderate, 2h at 90 g/hr = 180 g; mix alone tops out ~146 g — a 34 g
  // gap is worth gels
  const i = { ...base, hours: 2, minutes: 0, gi: "moderate" as const, weightKg: 76, tempC: 27 };
  assert.ok(buildRecipe(i).gelCount > 0);
});

test("bottle allocation: flags when carried plain water can't cover gel water", () => {
  // huge carb target, small bottles -> many gels, nowhere near enough plain water
  const i = { ...base, customCarb: 120, hours: 4, minutes: 0, bottleCount: 1, bottleSizeMl: 500 };
  const r = buildRecipe(i);
  assert.ok(r.gelCount > 0);
  assert.ok(r.gelWaterShortMl > 0, `got ${r.gelWaterShortMl}`);
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
