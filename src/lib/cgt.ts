// CGT comparison model for the 2026 reforms: old regime (50% discount) vs
// new regime from July 2027 (inflation-indexed cost base, 30% minimum rate).
// Simplifications: constant salary/brackets, all parcels acquired post-2027,
// unleveraged monthly contributions, CGT assessed at the investor's marginal
// rate without bracket creep from the gain itself.

export interface CgtInputs {
  salary: number;
  monthly: number;
  /** shares/ETF annual growth */
  sharesReturn: number;
  /** property annual valuation growth */
  propertyReturn: number;
  /**
   * loan-to-value ratio 0..0.9 — each deposit dollar controls 1/(1-LVR) of
   * property on an interest-only loan, with rent assumed to cover interest
   * and running costs (neutral gearing)
   */
  propertyLvr: number;
  inflation: number;
}

export interface CgtPoint {
  age: number;
  sharesValue: number;
  propertyValue: number;
  contributed: number;
  /** shares taxed with the 50% discount — the pre-2027 deal */
  sharesOldNet: number;
  /** shares taxed with indexation + 30% minimum — the post-2027 deal */
  sharesNewNet: number;
  /** new-build property, which keeps the 50% discount under the new rules */
  propertyNet: number;
  /** established house: same leveraged growth, taxed like shares post-2027 */
  existingNet: number;
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
 * Put the same `monthly` amount into each of three strategies from age 30 and
 * sell everything at each age 31-60, taxing each monthly parcel on its own
 * holding period: shares under the old rules, shares under the new rules, and
 * new-build property (own growth rate, keeps the 50% discount).
 */
export function projectStrategies(inputs: CgtInputs): CgtPoint[] {
  const m = marginalRate(inputs.salary);
  const points: CgtPoint[] = [];

  for (let age = 31; age <= 60; age++) {
    const years = age - 30;
    let sharesValue = 0;
    let propertyValue = 0;
    let sharesOldTax = 0;
    let sharesNewTax = 0;
    let propertyTax = 0;
    let existingTax = 0;

    for (let month = 0; month < years * 12; month++) {
      const hold = years - month / 12;

      const shareParcel = inputs.monthly * Math.pow(1 + inputs.sharesReturn, hold);
      const shareGain = shareParcel - inputs.monthly;
      sharesValue += shareParcel;
      if (shareGain > 0) {
        sharesOldTax += shareGain * oldEffectiveRate(m);
        sharesNewTax +=
          shareGain * newEffectiveRate(m, inputs.sharesReturn, inputs.inflation, hold);
      }

      // Each monthly deposit controls leverage x its value of property; the
      // debt is repaid at sale, so equity = deposit + leverage x growth, and
      // CGT falls on the whole leveraged nominal gain.
      const leverage = 1 / (1 - inputs.propertyLvr);
      const propGain =
        inputs.monthly * leverage * (Math.pow(1 + inputs.propertyReturn, hold) - 1);
      propertyValue += inputs.monthly + propGain;
      if (propGain > 0) {
        propertyTax += propGain * oldEffectiveRate(m);
        existingTax +=
          propGain * newEffectiveRate(m, inputs.propertyReturn, inputs.inflation, hold);
      }
    }

    points.push({
      age,
      sharesValue,
      propertyValue,
      contributed: inputs.monthly * years * 12,
      sharesOldNet: sharesValue - sharesOldTax,
      sharesNewNet: sharesValue - sharesNewTax,
      propertyNet: propertyValue - propertyTax,
      existingNet: propertyValue - existingTax,
    });
  }
  return points;
}
