// Pure endurance-fueling math. No DOM/Astro imports so node --test can load it.
// Numbers are documented approximations chosen to match published guidance;
// see docs/superpowers/specs/2026-07-05-fuel-calculator-design.md.

export type Intensity = "z60" | "z70" | "z80" | "z90";
export type GiTraining = "untrained" | "moderate" | "well";
export type SweatSodium = "low" | "typical" | "salty";
export type Ratio = "1:1" | "2:1" | "1:0.8";

export interface FuelInputs {
  hours: number;
  minutes: number;
  intensity: Intensity;
  weightKg: number;
  tempC: number;
  gi: GiTraining;
  sweatSodium: SweatSodium;
  customCarb: number | null; // g/hr, null/0 = use suggestion
  ratio: Ratio;
  bottleCount: number;
  bottleSizeMl: number;
}

export function carriedMl(i: FuelInputs): number {
  return Math.max(0, i.bottleCount) * Math.max(0, i.bottleSizeMl);
}

const CARB_BASE: Record<GiTraining, number> = { untrained: 60, moderate: 90, well: 105 };
const INTENSITY_SWEAT: Record<Intensity, number> = { z60: 0.9, z70: 1.1, z80: 1.35, z90: 1.6 };
const SWEAT_SODIUM_MG_PER_L: Record<SweatSodium, number> = { low: 500, typical: 800, salty: 1200 };

const BASE_SWEAT_ML_PER_KG = 8; // L/hr baseline = 0.008 * kg at z70-equivalent
const FLUID_REPLACE_FRACTION = 0.6;
const FLUID_MIN_ML = 300;
const FLUID_MAX_ML = 750; // gut-tolerance cap (~gastric emptying limit)
const SODIUM_REPLACE_FRACTION = 0.7;
const SALT_SODIUM_FRACTION = 0.39; // table salt is ~39% sodium by weight
const TSP_SALT_G = 6;
const KCAL_PER_CARB_G = 4;

export function durationHours(i: FuelInputs): number {
  return Math.max(0, i.hours) + Math.max(0, i.minutes) / 60;
}

export function suggestCarbs(i: FuelInputs): number {
  const easy = durationHours(i) < 1.5 && (i.intensity === "z60" || i.intensity === "z70");
  if (easy) return i.gi === "untrained" ? 45 : 60;
  return CARB_BASE[i.gi];
}

export function effectiveCarb(i: FuelInputs): number {
  return i.customCarb && i.customCarb > 0 ? i.customCarb : suggestCarbs(i);
}

export function estimateSweatLPerHr(i: FuelInputs): number {
  const baseL = (BASE_SWEAT_ML_PER_KG * Math.max(0, i.weightKg)) / 1000;
  const tempFactor =
    i.tempC >= 15 ? 1 + (i.tempC - 15) * 0.04 : Math.max(0.6, 1 + (i.tempC - 15) * 0.02);
  return baseL * INTENSITY_SWEAT[i.intensity] * tempFactor;
}

export interface FluidPlan {
  lossMlPerHr: number;
  idealMlPerHr: number;
  plannedMlPerHr: number;
  deficitMlPerHr: number;
}

export function fluidPlan(i: FuelInputs): FluidPlan {
  const durH = durationHours(i);
  const lossMlPerHr = estimateSweatLPerHr(i) * 1000;
  const ideal = Math.min(FLUID_MAX_ML, Math.max(FLUID_MIN_ML, lossMlPerHr * FLUID_REPLACE_FRACTION));
  // You can only drink what you carry.
  const planned = durH > 0 ? Math.min(ideal, carriedMl(i) / durH) : ideal;
  return {
    lossMlPerHr: Math.round(lossMlPerHr),
    idealMlPerHr: Math.round(ideal),
    plannedMlPerHr: Math.round(planned),
    deficitMlPerHr: Math.max(0, Math.round(lossMlPerHr - planned)),
  };
}

export interface SodiumPlan {
  lossMgPerHr: number;
  targetMgPerHr: number;
}

export function sodiumPlan(i: FuelInputs): SodiumPlan {
  const lossMgPerHr = estimateSweatLPerHr(i) * SWEAT_SODIUM_MG_PER_L[i.sweatSodium];
  return {
    lossMgPerHr: Math.round(lossMgPerHr),
    targetMgPerHr: Math.round(lossMgPerHr * SODIUM_REPLACE_FRACTION),
  };
}

export type Warning = "none" | "soft" | "strong";

// Concentrated drinks slow gastric emptying and raise GI-distress risk, so
// the mix is capped by gut training and surplus carbs move to whole gels.
const DRINK_CONC_BY_GI: Record<GiTraining, number> = {
  untrained: 0.08,
  moderate: 0.1,
  well: 0.12,
};
// Standard single gel (Maurten Gel 100 class). Each gel should be taken with
// plain water — not the carb drink — to keep gut concentration absorbable.
export const GEL_CARB_G = 25;
export const GEL_WATER_ML = 150;
// Practical gut ceiling on gel frequency (one every ~30 min).
const MAX_GELS_PER_HR = 2;

// Drink sodium above ~700 mg/L hurts palatability and absorption
// (optimal range in the literature is ~230-690 mg/L; avoid >1000).
const DRINK_SODIUM_MAX_MG_PER_L = 700;

export interface Recipe {
  totalCarbG: number;
  drinkCarbG: number;
  gelCount: number;
  gelCarbG: number;
  totalWaterMl: number; // water in the mix bottles
  bottleSizeMl: number;
  mixBottles: number;
  plainBottles: number;
  refillShortfallMl: number; // ideal intake beyond what the bottles carry
  gelWaterShortMl: number; // gel water the carried plain bottles can't cover
  unmetCarbG: number; // carbs that fit neither the drink nor the gel-rate cap
  tableSugarG: number; // >0 only for the 1:1 (sucrose) recipe
  maltoG: number;
  fructoseG: number;
  saltG: number;
  saltTsp: number;
  sodiumMg: number;
  sodiumShortfallMg: number;
  kcal: number;
  concentrationPct: number;
  warning: Warning;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildRecipe(i: FuelInputs): Recipe {
  const durH = durationHours(i);
  const totalCarbG = effectiveCarb(i) * durH;
  const plan = fluidPlan(i);
  const intakeMl = plan.plannedMlPerHr * durH;
  const carried = carriedMl(i);
  const refillShortfallMl = Math.max(0, Math.round(plan.idealMlPerHr * durH - carried));
  const cap = DRINK_CONC_BY_GI[i.gi];

  // Split the carried bottles between mix and plain water, and pick a gel
  // count, so the carb target is met as fully as possible. A bottle is
  // either mix or plain (part-fills allowed); gels need their plain water
  // reserved from the SAME carried bottles — no phantom extras. The gut
  // caps gel frequency at ~2/hr. Among plans, minimize unmet carbs, then
  // use the fewest gels.
  const gelCap = Math.floor(MAX_GELS_PER_HR * durH);
  const evaluate = (g: number) => {
    const gelWaterMl = g * GEL_WATER_ML;
    const plainBottles =
      g > 0 ? Math.min(i.bottleCount, Math.max(1, Math.ceil(gelWaterMl / i.bottleSizeMl))) : 0;
    const mixBottles = i.bottleCount - plainBottles;
    const gelCarbG = g * GEL_CARB_G;
    // Use the full fluid budget for mix — more water means a weaker,
    // easier-emptying drink. Gel water rides on top of the plan.
    const mixWaterMl = Math.min(intakeMl, mixBottles * i.bottleSizeMl);
    const drinkCarbG = Math.min(Math.max(0, totalCarbG - gelCarbG), mixWaterMl * cap);
    const unmetCarbG = Math.max(0, totalCarbG - drinkCarbG - gelCarbG);
    const gelWaterShortMl = Math.max(0, Math.round(gelWaterMl - plainBottles * i.bottleSizeMl));
    return { g, plainBottles, mixBottles, mixWaterMl, drinkCarbG, unmetCarbG, gelWaterShortMl };
  };
  let best = evaluate(0);
  for (let g = 1; g <= gelCap; g++) {
    const plan = evaluate(g);
    if (plan.unmetCarbG < best.unmetCarbG - 0.1) best = plan;
    if (best.unmetCarbG < 0.1) break; // target met with fewest gels
  }
  const { plainBottles, mixBottles, gelWaterShortMl, drinkCarbG, unmetCarbG } = best;
  const totalWaterMl = best.mixWaterMl;
  const gelCount = best.g;
  const gelCarbG = gelCount * GEL_CARB_G;

  const sodiumTargetMg = sodiumPlan(i).targetMgPerHr * durH;
  const sodiumCapMg = (totalWaterMl / 1000) * DRINK_SODIUM_MAX_MG_PER_L;
  const sodiumMg = Math.min(sodiumTargetMg, sodiumCapMg);
  const sodiumShortfallMg = Math.max(0, sodiumTargetMg - sodiumMg);

  let tableSugarG = 0;
  let maltoG = 0;
  let fructoseG = 0;
  if (i.ratio === "1:1") {
    tableSugarG = drinkCarbG; // sucrose = ~1:1 glucose:fructose
  } else {
    const fruWeight = i.ratio === "2:1" ? 0.5 : 0.8; // malto : fructose parts
    const parts = 1 + fruWeight;
    maltoG = drinkCarbG * (1 / parts);
    fructoseG = drinkCarbG * (fruWeight / parts);
  }

  const saltG = totalWaterMl > 0 ? sodiumMg / 1000 / SALT_SODIUM_FRACTION : 0;
  const concentrationPct = totalWaterMl > 0 ? (drinkCarbG / totalWaterMl) * 100 : 0;
  const warning: Warning = concentrationPct > 12 ? "strong" : concentrationPct > 8 ? "soft" : "none";

  return {
    totalCarbG: round1(totalCarbG),
    drinkCarbG: round1(drinkCarbG),
    gelCount,
    gelCarbG: round1(gelCarbG),
    totalWaterMl: Math.round(totalWaterMl),
    bottleSizeMl: i.bottleSizeMl,
    mixBottles,
    plainBottles,
    refillShortfallMl,
    gelWaterShortMl,
    unmetCarbG: round1(unmetCarbG),
    tableSugarG: round1(tableSugarG),
    maltoG: round1(maltoG),
    fructoseG: round1(fructoseG),
    saltG: round1(saltG),
    saltTsp: round1(saltG / TSP_SALT_G),
    sodiumMg: Math.round(sodiumMg),
    sodiumShortfallMg: Math.round(sodiumShortfallMg),
    kcal: Math.round(totalCarbG * KCAL_PER_CARB_G),
    concentrationPct: round1(concentrationPct),
    warning,
  };
}

export interface ScheduleRow {
  label: string; // "Pre-Start" or "hh:mm"
  timeMin: number;
  drinkMl: number;
  carbG: number;
  gels: number;
  sodiumMg: number;
}

const STEP_MIN = 20;
const PRE_FRACTION = 0.35;

function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function buildSchedule(i: FuelInputs): ScheduleRow[] {
  const durMin = Math.round(durationHours(i) * 60);
  const recipe = buildRecipe(i);
  // Last sip lands one step before the end — a drink at the finish can't be
  // absorbed in time to fuel the ride.
  const nSteps = Math.max(1, Math.round((durMin - STEP_MIN) / STEP_MIN));
  const units = PRE_FRACTION + nSteps;

  const portion = (frac: number, label: string, timeMin: number): ScheduleRow => ({
    label,
    timeMin,
    drinkMl: Math.round(recipe.totalWaterMl * frac),
    carbG: round1(recipe.drinkCarbG * frac),
    gels: 0,
    sodiumMg: Math.round(recipe.sodiumMg * frac),
  });

  const rows: ScheduleRow[] = [portion(PRE_FRACTION / units, "Pre-Start", 0)];
  for (let s = 1; s <= nSteps; s++) {
    rows.push(portion(1 / units, hhmm(s * STEP_MIN), s * STEP_MIN));
  }

  // Spread gels evenly across the ride, but never before 40 minutes — the
  // first gel is best taken 30-45 min in, then one every 30-45 min.
  const firstStep = Math.min(nSteps, 2); // step 2 = 40 min
  for (let g = 1; g <= recipe.gelCount; g++) {
    const step =
      recipe.gelCount === 1
        ? Math.round((firstStep + nSteps) / 2)
        : firstStep + Math.round(((g - 1) * (nSteps - firstStep)) / (recipe.gelCount - 1));
    rows[Math.min(nSteps, Math.max(firstStep, step))].gels += 1;
  }
  return rows;
}

export function totalEnergyKcal(i: FuelInputs): number {
  return buildRecipe(i).kcal;
}
