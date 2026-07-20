// CGT comparison model for the 2026 reforms: old regime (50% discount) vs
// new regime from July 2027 (inflation-indexed cost base, 30% minimum rate).
//
// One upfront investment. For shares the initial amount buys a portfolio
// that compounds untouched. For property it is the deposit on an
// interest-only loan at the bank's LVR (house = deposit / (1 - LVR)). Rent
// (rental yield x current house value) goes toward the interest; any
// shortfall is a holding cost the owner pays each year. That shortfall is
// where negative gearing lives: a new build can deduct it against wage
// income, an established house from July 2027 cannot.
//
// Simplifications: constant salary/brackets and rates, all assets acquired
// post-2027, rent net of running costs, rental surpluses beyond the
// interest ignored, holding costs subtracted at face value at sale, CGT
// assessed at the investor's marginal rate without bracket creep. Each
// line is self-contained: the share investor is not credited with
// investing the shortfall the landlord pays.

export interface CgtInputs {
  salary: number;
  /** shares/ETF annual growth */
  sharesReturn: number;
  /** property annual valuation growth */
  propertyReturn: number;
  /** upfront cash: house deposit, or the share lump sum */
  initialInvestment: number;
  /** loan-to-value ratio the bank lends at, 0.5..0.95 */
  lvr: number;
  /** interest-only mortgage rate */
  mortgageRate: number;
  /** net rental yield on the current house value */
  rentalYield: number;
  /** age when the lump sum is invested */
  startAge: number;
  /** final sale age charted */
  endAge: number;
  inflation: number;
}

export interface CgtPoint {
  age: number;
  loan: number;
  houseValue: number;
  deposit: number;
  /** gross share portfolio value */
  sharesValue: number;
  /** shares taxed with the 50% discount — the pre-2027 deal */
  sharesOldNet: number;
  /** shares taxed with indexation + 30% minimum — the post-2027 deal */
  sharesNewNet: number;
  /** cumulative interest-minus-rent shortfall paid to date, before any deduction */
  shortfall: number;
  /** new-build property: equity net of CGT (keeps the 50% discount) and of
   * the negatively-geared shortfall (deducted at the marginal rate) */
  propertyNet: number;
  /** established house: same growth, taxed like shares post-2027, shortfall
   * paid with no deduction */
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
 * Deploy the same lump sum four ways at startAge and sell at each age up to
 * endAge: shares under the old rules, shares under the new rules, a
 * new-build house and an established house — both houses bought with the
 * deposit geared to the bank's LVR.
 */
export function projectStrategies(inputs: CgtInputs): CgtPoint[] {
  const m = marginalRate(inputs.salary);
  const deposit = inputs.initialInvestment;
  const houseValue = deposit / (1 - inputs.lvr);
  const loan = houseValue - deposit;
  const points: CgtPoint[] = [];

  const interest = loan * inputs.mortgageRate;
  let shortfall = 0;

  for (let age = inputs.startAge + 1; age <= inputs.endAge; age++) {
    const years = age - inputs.startAge;

    // Shortfall for the year just held: rent on the start-of-year value.
    const rent =
      inputs.rentalYield * houseValue * Math.pow(1 + inputs.propertyReturn, years - 1);
    shortfall += Math.max(0, interest - rent);

    const sharesValue = deposit * Math.pow(1 + inputs.sharesReturn, years);
    const sharesGain = Math.max(0, sharesValue - deposit);
    const sharesOldTax = sharesGain * oldEffectiveRate(m);
    const sharesNewTax =
      sharesGain * newEffectiveRate(m, inputs.sharesReturn, inputs.inflation, years);

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
      sharesValue,
      shortfall,
      sharesOldNet: sharesValue - sharesOldTax,
      sharesNewNet: sharesValue - sharesNewTax,
      propertyNet: grossEquity - newBuildTax - shortfall * (1 - m),
      existingNet: grossEquity - existingTax - shortfall,
    });
  }
  return points;
}
