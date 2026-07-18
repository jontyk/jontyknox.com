// CGT comparison model for the 2026 reforms: old regime (50% discount) vs
// new regime from July 2027 (inflation-indexed cost base, 30% minimum rate).
//
// The initial investment is the buyer's deposit and the LVR is what the
// bank will lend against the house, so house value = deposit / (1 - LVR)
// and the interest-only payment on the loan falls out (loan x rate / 12).
// The share strategies invest the same deposit as an upfront lump sum plus
// that same monthly payment, so every line reflects the same total outlay.
//
// Simplifications: constant salary/brackets and rates, all parcels acquired
// post-2027, rent covers the property's running costs (interest is the
// owner's monthly payment), negative-gearing refunds not modelled, CGT
// assessed at the investor's marginal rate without bracket creep.

export interface CgtInputs {
  salary: number;
  /** shares/ETF annual growth */
  sharesReturn: number;
  /** property annual valuation growth */
  propertyReturn: number;
  /** upfront cash: house deposit, or the initial share investment */
  initialInvestment: number;
  /** loan-to-value ratio the bank lends at, 0.5..0.95 */
  lvr: number;
  /** interest-only mortgage rate */
  mortgageRate: number;
  inflation: number;
}

export interface CgtPoint {
  age: number;
  loan: number;
  houseValue: number;
  deposit: number;
  /** derived interest-only payment, also invested monthly in shares */
  monthly: number;
  /** total cash outlay to date: deposit + monthly payments */
  contributed: number;
  /** gross share portfolio value (deposit lump sum + monthly parcels) */
  sharesValue: number;
  /** shares taxed with the 50% discount — the pre-2027 deal */
  sharesOldNet: number;
  /** shares taxed with indexation + 30% minimum — the post-2027 deal */
  sharesNewNet: number;
  /** new-build property equity net of CGT (keeps the 50% discount) */
  propertyNet: number;
  /** established house: same growth, taxed like shares post-2027 */
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
 * Deploy the same cashflow four ways from age 30 and sell at each age 31-60:
 * shares under the old rules, shares under the new rules, a new-build house
 * and an established house — both houses bought at age 30 with the max
 * interest-only loan priced by the bank's LVR and mortgage rate.
 */
export function projectStrategies(inputs: CgtInputs): CgtPoint[] {
  const m = marginalRate(inputs.salary);
  const deposit = inputs.initialInvestment;
  const houseValue = deposit / (1 - inputs.lvr);
  const loan = houseValue - deposit;
  const monthly = (loan * inputs.mortgageRate) / 12;
  const points: CgtPoint[] = [];

  for (let age = 31; age <= 60; age++) {
    const years = age - 30;
    let sharesValue = 0;
    let sharesOldTax = 0;
    let sharesNewTax = 0;

    const shareParcel = (amount: number, hold: number) => {
      const value = amount * Math.pow(1 + inputs.sharesReturn, hold);
      const gain = value - amount;
      sharesValue += value;
      if (gain > 0) {
        sharesOldTax += gain * oldEffectiveRate(m);
        sharesNewTax +=
          gain * newEffectiveRate(m, inputs.sharesReturn, inputs.inflation, hold);
      }
    };

    shareParcel(deposit, years);
    for (let month = 0; month < years * 12; month++) {
      shareParcel(monthly, years - month / 12);
    }

    const houseNow = houseValue * Math.pow(1 + inputs.propertyReturn, years);
    const houseGain = Math.max(0, houseNow - houseValue);
    const grossEquity = houseNow - loan;
    const newBuildTax = houseGain * oldEffectiveRate(m);
    const existingTax =
      houseGain * newEffectiveRate(m, inputs.propertyReturn, inputs.inflation, years);

    points.push({
      age,
      loan,
      houseValue,
      deposit,
      monthly,
      contributed: deposit + monthly * years * 12,
      sharesValue,
      sharesOldNet: sharesValue - sharesOldTax,
      sharesNewNet: sharesValue - sharesNewTax,
      propertyNet: grossEquity - newBuildTax,
      existingNet: grossEquity - existingTax,
    });
  }
  return points;
}
