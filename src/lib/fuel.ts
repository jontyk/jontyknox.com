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
  plannedMlPerHr: number;
  deficitMlPerHr: number;
}

export function fluidPlan(i: FuelInputs): FluidPlan {
  const lossMlPerHr = estimateSweatLPerHr(i) * 1000;
  const planned = Math.min(FLUID_MAX_ML, Math.max(FLUID_MIN_ML, lossMlPerHr * FLUID_REPLACE_FRACTION));
  return {
    lossMlPerHr: Math.round(lossMlPerHr),
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

// Drinks above ~12% carbohydrate slow gastric emptying and raise GI-distress
// risk, so the mix is capped there and surplus carbs move to gels/food.
const MAX_DRINK_CONC = 0.12;

export interface Recipe {
  totalCarbG: number;
  drinkCarbG: number;
  gelCarbG: number;
  totalWaterMl: number;
  tableSugarG: number; // >0 only for the 1:1 (sucrose) recipe
  maltoG: number;
  fructoseG: number;
  saltG: number;
  saltTsp: number;
  sodiumMg: number;
  kcal: number;
  concentrationPct: number;
  warning: Warning;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildRecipe(i: FuelInputs): Recipe {
  const durH = durationHours(i);
  const totalCarbG = effectiveCarb(i) * durH;
  const totalWaterMl = fluidPlan(i).plannedMlPerHr * durH;
  const sodiumMg = sodiumPlan(i).targetMgPerHr * durH;

  const drinkCarbG = Math.min(totalCarbG, totalWaterMl * MAX_DRINK_CONC);
  const gelCarbG = totalCarbG - drinkCarbG;

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
    gelCarbG: round1(gelCarbG),
    totalWaterMl: Math.round(totalWaterMl),
    tableSugarG: round1(tableSugarG),
    maltoG: round1(maltoG),
    fructoseG: round1(fructoseG),
    saltG: round1(saltG),
    saltTsp: round1(saltG / TSP_SALT_G),
    sodiumMg: Math.round(sodiumMg),
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
  const nSteps = Math.max(1, Math.round(durMin / STEP_MIN));
  const units = PRE_FRACTION + nSteps;

  const portion = (frac: number, label: string, timeMin: number): ScheduleRow => ({
    label,
    timeMin,
    drinkMl: Math.round(recipe.totalWaterMl * frac),
    carbG: round1(recipe.drinkCarbG * frac),
    sodiumMg: Math.round(recipe.sodiumMg * frac),
  });

  const rows: ScheduleRow[] = [portion(PRE_FRACTION / units, "Pre-Start", 0)];
  for (let s = 1; s <= nSteps; s++) {
    rows.push(portion(1 / units, hhmm(s * STEP_MIN), s * STEP_MIN));
  }
  return rows;
}

export function totalEnergyKcal(i: FuelInputs): number {
  return buildRecipe(i).kcal;
}
