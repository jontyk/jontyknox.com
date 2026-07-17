// CGT comparison model for the 2026 reforms: old regime (50% discount) vs
// new regime from July 2027 (inflation-indexed cost base, 30% minimum rate).
// Simplifications: constant salary/brackets, all parcels acquired post-2027,
// CGT assessed at the investor's marginal rate without bracket creep from the
// gain itself.

export interface CgtInputs {
  salary: number;
  monthly: number;
  annualReturn: number;
  inflation: number;
  /** 0..1 — remainder is new-build property, which keeps the 50% discount */
  sharesPct: number;
}

export interface CgtPoint {
  age: number;
  /** gross portfolio value at sale */
  value: number;
  contributed: number;
  oldTax: number;
  newTax: number;
  oldNet: number;
  newNet: number;
}

// 2025-26 resident brackets + 2% Medicare levy (applied above the low-income range).
export function marginalRate(salary: number): number {
  let base = 0.45;
  if (salary <= 18200) base = 0;
  else if (salary <= 45000) base = 0.16;
  else if (salary <= 135000) base = 0.3;
  else if (salary <= 190000) base = 0.37;
  return base + (salary > 26000 ? 0.02 : 0);
}

/** Effective tax rate on the nominal gain under the 50% discount. */
export function oldEffectiveRate(marginal: number): number {
  return marginal / 2;
}

/**
 * Effective tax rate on the nominal gain under indexation + 30% minimum:
 * the cost base grows with inflation, and the real gain is taxed at
 * max(marginal, 30%).
 */
export function newEffectiveRate(
  marginal: number,
  annualReturn: number,
  inflation: number,
  years: number,
): number {
  const growth = Math.pow(1 + annualReturn, years);
  const indexed = Math.pow(1 + inflation, years);
  const nominalGain = growth - 1;
  const realGain = Math.max(0, growth - indexed);
  if (nominalGain <= 0) return 0;
  return (Math.max(marginal, 0.3) * realGain) / nominalGain;
}

/**
 * Invest `monthly` from age 30, sell everything at each age 31-60. Each
 * monthly parcel is taxed on its own holding period. The property share of
 * the portfolio keeps old treatment under both regimes (new builds retain
 * the 50% discount).
 */
export function projectPortfolio(inputs: CgtInputs): CgtPoint[] {
  const m = marginalRate(inputs.salary);
  const points: CgtPoint[] = [];

  for (let age = 31; age <= 60; age++) {
    const years = age - 30;
    let value = 0;
    let oldTax = 0;
    let sharesNewTax = 0;

    for (let month = 0; month < years * 12; month++) {
      const hold = years - month / 12;
      const parcel = inputs.monthly * Math.pow(1 + inputs.annualReturn, hold);
      const gain = parcel - inputs.monthly;
      value += parcel;
      if (gain <= 0) continue;
      oldTax += gain * oldEffectiveRate(m);
      sharesNewTax +=
        gain * newEffectiveRate(m, inputs.annualReturn, inputs.inflation, hold);
    }

    const newTax = oldTax + (sharesNewTax - oldTax) * inputs.sharesPct;
    const contributed = inputs.monthly * years * 12;
    points.push({
      age,
      value,
      contributed,
      oldTax,
      newTax,
      oldNet: value - oldTax,
      newNet: value - newTax,
    });
  }
  return points;
}
