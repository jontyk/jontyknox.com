// Interactive explorer for the CGT article. Mounts into #cgt-explorer if the
// current page contains it; no-op elsewhere.
import { projectStrategies, marginalRate } from "./cgt.ts";

const W = 640;
const H = 330;
const PAD = { top: 16, right: 16, bottom: 30, left: 58 };
const INFLATION = 0.026;

const fmtMoney = (v: number) => {
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  return sign + "$" + (a >= 1_000_000 ? (a / 1_000_000).toFixed(2) + "m" : Math.round(a / 1000) + "k");
};
const fmtFull = (v: number) =>
  (v < 0 ? "−" : "") + "$" + Math.abs(Math.round(v)).toLocaleString("en-AU");

export function mountCgtExplorer(): void {
  const host = document.getElementById("cgt-explorer");
  if (!host) return;

  host.innerHTML = `
    <div class="cgt-controls">
      <label>Salary <output></output>
        <input type="range" data-k="salary" min="45000" max="250000" step="5000" value="100000" /></label>
      <label>Initial investment <output></output>
        <input type="range" data-k="initial" min="5000" max="200000" step="5000" value="25000" /></label>
      <label>Bank gearing <output></output>
        <input type="range" data-k="lvr" min="50" max="95" step="5" value="80" /></label>
      <label>Mortgage rate <output></output>
        <input type="range" data-k="mortRate" min="3" max="9" step="0.25" value="6" /></label>
      <label>Rental yield <output></output>
        <input type="range" data-k="rentYield" min="0" max="6" step="0.25" value="3.5" /></label>
      <label>Shares return <output></output>
        <input type="range" data-k="sharesRet" min="3" max="12" step="0.5" value="8" /></label>
      <label>Property growth <output></output>
        <input type="range" data-k="propRet" min="-2" max="12" step="0.5" value="2" /></label>
      <label>Starting age <output></output>
        <input type="range" data-k="startAge" min="18" max="55" step="1" value="30" /></label>
      <label>Final sale age <output></output>
        <input type="range" data-k="endAge" min="25" max="75" step="1" value="60" /></label>
    </div>
    <p class="cgt-loan"></p>
    <p class="cgt-legend">
      <span><span class="swatch old"></span>Shares, old rules (50% discount)</span>
      <span><span class="swatch new"></span>Shares, new rules (July 2027)</span>
      <span><span class="swatch prop"></span>New-build property (keeps discount)</span>
      <span><span class="swatch exist"></span>Established house (taxed like shares)</span>
    </p>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="After-tax value by sale age: shares under the old CGT rules, shares under the new rules, new-build property, and an established house"></svg>
    <p class="cgt-readout"></p>
    <p class="cgt-note">The same lump sum four ways, sold in full at the age on the x-axis. The initial
    investment either buys shares that compound untouched, or acts as the deposit the bank's gearing turns
    into a house (house = deposit ÷ (1 − LVR)) on an interest-only loan. Rent (net yield × current value)
    goes toward the interest; while it falls short, the owner pays the gap — negatively geared. A new build
    deducts that gap at the marginal rate; an established house cannot from July 2027, and both carry the
    accumulated cost to sale. The share lines are self-contained and are not credited with investing the
    landlord's shortfall. Assumes
    ${(INFLATION * 100).toFixed(1)}% inflation, current tax brackets, share parcels acquired under the
    post-July-2027 rules, and rent covering the property's running costs. New builds keep the 50% discount
    (and negative-gearing eligibility); an established house is taxed like shares from July 2027 — the gap
    between the two property lines is purely that tax treatment, since negative-gearing refunds are not
    modelled. Ignores stamp duty, vacancies and rate risk. Illustrative only — not financial advice.</p>`;

  const svg = host.querySelector("svg")!;
  const readout = host.querySelector(".cgt-readout")!;
  const loanLine = host.querySelector(".cgt-loan")!;
  const sliders = Array.from(host.querySelectorAll<HTMLInputElement>("input[type=range]"));
  let hoverAge: number | null = null;

  function state() {
    const get = (k: string) => Number(sliders.find((s) => s.dataset.k === k)!.value);
    const startAge = get("startAge");
    const endAge = Math.max(startAge + 5, get("endAge"));
    return {
      salary: get("salary"),
      sharesReturn: get("sharesRet") / 100,
      propertyReturn: get("propRet") / 100,
      initialInvestment: get("initial"),
      lvr: get("lvr") / 100,
      mortgageRate: get("mortRate") / 100,
      rentalYield: get("rentYield") / 100,
      startAge,
      endAge,
      inflation: INFLATION,
    };
  }

  function render() {
    const s = state();
    const labels: Record<string, string> = {
      salary: fmtFull(s.salary),
      sharesRet: (s.sharesReturn * 100).toFixed(1) + "% p.a.",
      propRet: (s.propertyReturn * 100).toFixed(1) + "% p.a.",
      initial: fmtFull(s.initialInvestment) + " (deposit or shares)",
      lvr: Math.round(s.lvr * 100) + "% LVR",
      mortRate: (s.mortgageRate * 100).toFixed(2).replace(/\.?0+$/, "") + "% interest-only",
      rentYield: (s.rentalYield * 100).toFixed(2).replace(/\.?0+$/, "") + "% net",
      startAge: String(s.startAge),
      endAge: String(s.endAge),
    };
    for (const slider of sliders)
      slider.parentElement!.querySelector("output")!.textContent = labels[slider.dataset.k!];

    const x = (age: number) =>
      PAD.left + ((age - s.startAge - 1) / (s.endAge - s.startAge - 1)) * (W - PAD.left - PAD.right);

    const points = projectStrategies(s);
    const first = points[0];
    const interest = first.loan * s.mortgageRate;
    const rentYr1 = s.rentalYield * first.houseValue;
    const gap = interest - rentYr1;
    loanLine.innerHTML =
      `<strong>${fmtFull(first.deposit)}</strong> as a deposit at ${Math.round(s.lvr * 100)}% LVR buys a ` +
      `<strong>${fmtFull(first.houseValue)}</strong> property with a <strong>${fmtFull(first.loan)}</strong> ` +
      `interest-only loan. Year one: <strong>${fmtFull(interest)}</strong> interest vs ` +
      `<strong>${fmtFull(rentYr1)}</strong> rent — ` +
      (gap > 0
        ? `<strong class="cgt-delta">${fmtFull(gap)} negatively geared</strong>.`
        : `rent covers the interest.`) +
      ` The same <strong>${fmtFull(first.deposit)}</strong> in shares just compounds.`;

    const keys = ["sharesOldNet", "sharesNewNet", "propertyNet", "existingNet"] as const;
    const all = points.flatMap((p) => keys.map((k) => p[k]));
    const max = Math.max(...all) * 1.08;
    const min = Math.min(0, ...all) * 1.08;
    const yv = (v: number) =>
      H - PAD.bottom - ((v - min) / (max - min)) * (H - PAD.top - PAD.bottom);
    const line = (key: (typeof keys)[number]) =>
      points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${yv(p[key]).toFixed(1)}`).join("");

    const yTicks = [0.25, 0.5, 0.75, 1].map((f) => {
      const v = min + (max - min) * f;
      return `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yv(v)}" y2="${yv(v)}" class="cgt-grid"/>
        <text x="${PAD.left - 8}" y="${yv(v) + 4}" text-anchor="end" class="cgt-tick">${fmtMoney(v)}</text>`;
    }).join("");
    const zeroLine = min < 0
      ? `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yv(0)}" y2="${yv(0)}" class="cgt-zero"/>
        <text x="${PAD.left - 8}" y="${yv(0) + 4}" text-anchor="end" class="cgt-tick">$0</text>`
      : "";
    const span = s.endAge - s.startAge - 1;
    const stepAge = span > 30 ? 10 : span > 12 ? 5 : span > 6 ? 2 : 1;
    const ages: number[] = [];
    for (let a = Math.ceil((s.startAge + 1) / stepAge) * stepAge; a <= s.endAge; a += stepAge) ages.push(a);
    const xTicks = ages.map((age) =>
      `<text x="${x(age)}" y="${H - 10}" text-anchor="middle" class="cgt-tick">${age}</text>`).join("");

    const focusAge = Math.min(s.endAge, Math.max(s.startAge + 1, hoverAge ?? s.endAge));
    const hp = points.find((p) => p.age === focusAge)!;
    const gapPath = points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${yv(p.sharesOldNet).toFixed(1)}`).join("")
      + points.slice().reverse().map((p) => `L${x(p.age).toFixed(1)},${yv(p.sharesNewNet).toFixed(1)}`).join("") + "Z";

    svg.innerHTML = `${yTicks}${zeroLine}${xTicks}
      <path d="${gapPath}" class="cgt-gap"/>
      <path d="${line("existingNet")}" class="cgt-line cgt-line-exist"/>
      <path d="${line("propertyNet")}" class="cgt-line cgt-line-prop"/>
      <path d="${line("sharesOldNet")}" class="cgt-line cgt-line-old"/>
      <path d="${line("sharesNewNet")}" class="cgt-line cgt-line-new"/>
      <line x1="${x(focusAge)}" x2="${x(focusAge)}" y1="${PAD.top}" y2="${H - PAD.bottom}" class="cgt-cursor"/>
      <circle cx="${x(focusAge)}" cy="${yv(hp.existingNet)}" r="4" class="cgt-dot-exist"/>
      <circle cx="${x(focusAge)}" cy="${yv(hp.propertyNet)}" r="4" class="cgt-dot-prop"/>
      <circle cx="${x(focusAge)}" cy="${yv(hp.sharesOldNet)}" r="4" class="cgt-dot-old"/>
      <circle cx="${x(focusAge)}" cy="${yv(hp.sharesNewNet)}" r="4" class="cgt-dot-new"/>`;

    const extra = hp.sharesOldNet - hp.sharesNewNet;
    readout.innerHTML =
      `Sell at <strong>${hp.age}</strong> (marginal rate ${(marginalRate(s.salary) * 100).toFixed(0)}%): ` +
      `shares kept <strong>${fmtFull(hp.sharesOldNet)}</strong> under the old rules vs ` +
      `<strong>${fmtFull(hp.sharesNewNet)}</strong> under the new — ` +
      (Math.abs(extra) < 1
        ? `no difference`
        : extra > 0
          ? `<strong class="cgt-delta">${fmtFull(extra)} to the tax office</strong>`
          : `<strong class="cgt-delta-win">${fmtFull(-extra)} better off</strong>`) +
      `. The house at ${(s.propertyReturn * 100).toFixed(1)}% growth nets <strong>${fmtFull(hp.propertyNet)}</strong> ` +
      `equity as a new build, <strong>${fmtFull(hp.existingNet)}</strong> established.`;
  }

  svg.addEventListener("mousemove", (e) => {
    const s = state();
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = (px - PAD.left) / (W - PAD.left - PAD.right);
    hoverAge = Math.round(s.startAge + 1 + frac * (s.endAge - s.startAge - 1));
    render();
  });
  svg.addEventListener("mouseleave", () => { hoverAge = null; render(); });
  for (const slider of sliders) slider.addEventListener("input", render);
  render();
}
