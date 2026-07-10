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

test("buildRecipe caps drink concentration at 12% and pushes surplus carbs to gels/food", () => {
  const dry = buildRecipe({ ...base, customCarb: 120, weightKg: 55, tempC: 5, intensity: "z60" });
  assert.ok(dry.concentrationPct <= 12, `got ${dry.concentrationPct}`);
  assert.ok(dry.gelCarbG > 0, `got ${dry.gelCarbG}`);
  assert.ok(Math.abs(dry.drinkCarbG + dry.gelCarbG - dry.totalCarbG) < 0.2);
  // ingredient split applies to the drink carbs only
  assert.ok(Math.abs(dry.maltoG + dry.fructoseG - dry.drinkCarbG) < 0.2);
});

test("buildRecipe keeps all carbs in the drink when they fit below 12%", () => {
  const easy = buildRecipe({ ...base, gi: "untrained", tempC: 35 });
  assert.equal(easy.gelCarbG, 0);
  assert.ok(Math.abs(easy.drinkCarbG - easy.totalCarbG) < 0.2);
});

test("buildSchedule emits a pre-start drink plus 20-min steps that sum to the drink totals", () => {
  const rows = buildSchedule(base);
  assert.equal(rows[0].label, "Pre-Start");
  assert.ok(rows.length >= 2);
  const carbSum = rows.reduce((a, r) => a + r.carbG, 0);
  const recipe = buildRecipe(base);
  assert.ok(Math.abs(carbSum - recipe.drinkCarbG) < 0.5, `sum ${carbSum} vs ${recipe.drinkCarbG}`);
});
