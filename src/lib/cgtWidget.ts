// Interactive explorer for the CGT article. Mounts into #cgt-explorer if the
// current page contains it; no-op elsewhere.
import { projectStrategies, marginalRate } from "./cgt.ts";

const W = 640;
const H = 330;
const PAD = { top: 16, right: 16, bottom: 30, left: 58 };
const INFLATION = 0.026;

const fmtMoney = (v: number) =>
  "$" + (v >= 1_000_000 ? (v / 1_000_000).toFixed(2) + "m" : Math.round(v / 1000) + "k");
const fmtFull = (v: number) => "$" + Math.round(v).toLocaleString("en-AU");

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
      <label>Shares return <output></output>
        <input type="range" data-k="sharesRet" min="3" max="12" step="0.5" value="8" /></label>
      <label>Property growth <output></output>
        <input type="range" data-k="propRet" min="2" max="12" step="0.5" value="2" /></label>
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
    <p class="cgt-note">The same cash four ways, sold in full at the age on the x-axis. The initial
    investment is the deposit, the bank's gearing sets the house it buys (house = deposit ÷ (1 − LVR)),
    and the interest-only payment on the loan falls out of the mortgage rate — the share strategies invest
    the same deposit as a lump sum plus that same monthly payment, so every line reflects identical total
    outlay. Assumes
    ${(INFLATION * 100).toFixed(1)}% inflation, current tax brackets, share parcels acquired under the
    post-July-2027 rules, and rent covering the property's running costs. New builds keep the 50% discount
    (and negative-gearing eligibility); an established house is taxed like shares from July 2027 — the gap
    between the two property lines is purely that tax treatment, since negative-gearing refunds are not
    modelled. Ignores stamp duty, vacancies and rate risk. Illustrative only — not financial advice.</p>`;

  const svg = host.querySelector("svg")!;
  const readout = host.querySelector(".cgt-readout")!;
  const loanLine = host.querySelector(".cgt-loan")!;
  const sliders = Array.from(host.querySelectorAll<HTMLInputElement>("input[type=range]"));
  let hoverAge = 60;

  const x = (age: number) => PAD.left + ((age - 31) / 29) * (W - PAD.left - PAD.right);
  const y = (v: number, max: number) => H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);

  function state() {
    const get = (k: string) => Number(sliders.find((s) => s.dataset.k === k)!.value);
    return {
      salary: get("salary"),
      sharesReturn: get("sharesRet") / 100,
      propertyReturn: get("propRet") / 100,
      initialInvestment: get("initial"),
      lvr: get("lvr") / 100,
      mortgageRate: get("mortRate") / 100,
      inflation: INFLATION,
    };
  }

  function render() {
    const s = state();
    const labels: Record<string, string> = {
      salary: fmtFull(s.salary),
      sharesRet: (s.sharesReturn * 100).toFixed(1) + "% p.a.",
      propRet: (s.propertyReturn * 100).toFixed(1) + "% p.a.",
      mortRate: (s.mortgageRate * 100).toFixed(2).replace(/\.?0+$/, "") + "% interest-only",
      initial: fmtFull(s.initialInvestment) + " (deposit or shares)",
      lvr: Math.round(s.lvr * 100) + "% LVR",
    };
    for (const slider of sliders)
      slider.parentElement!.querySelector("output")!.textContent = labels[slider.dataset.k!];

    const points = projectStrategies(s);
    const first = points[0];
    loanLine.innerHTML =
      `A <strong>${fmtFull(first.deposit)}</strong> deposit at ${Math.round(s.lvr * 100)}% LVR buys a ` +
      `<strong>${fmtFull(first.houseValue)}</strong> property with a <strong>${fmtFull(first.loan)}</strong> loan — ` +
      `<strong>${fmtFull(first.monthly)}/month</strong> interest-only, which the share strategies invest instead.`;

    const last = points[points.length - 1];
    const max =
      Math.max(last.sharesOldNet, last.sharesNewNet, last.propertyNet, last.existingNet) * 1.08;
    const line = (key: "sharesOldNet" | "sharesNewNet" | "propertyNet" | "existingNet") =>
      points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(Math.max(0, p[key]), max).toFixed(1)}`).join("");

    const yTicks = [0.25, 0.5, 0.75, 1].map((f) => {
      const v = max * f;
      return `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(v, max)}" y2="${y(v, max)}" class="cgt-grid"/>
        <text x="${PAD.left - 8}" y="${y(v, max) + 4}" text-anchor="end" class="cgt-tick">${fmtMoney(v)}</text>`;
    }).join("");
    const xTicks = [35, 40, 45, 50, 55, 60].map((age) =>
      `<text x="${x(age)}" y="${H - 10}" text-anchor="middle" class="cgt-tick">${age}</text>`).join("");

    const hp = points.find((p) => p.age === hoverAge)!;
    const gapPath = points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.sharesOldNet, max).toFixed(1)}`).join("")
      + points.slice().reverse().map((p) => `L${x(p.age).toFixed(1)},${y(p.sharesNewNet, max).toFixed(1)}`).join("") + "Z";

    svg.innerHTML = `${yTicks}${xTicks}
      <path d="${gapPath}" class="cgt-gap"/>
      <path d="${line("existingNet")}" class="cgt-line cgt-line-exist"/>
      <path d="${line("propertyNet")}" class="cgt-line cgt-line-prop"/>
      <path d="${line("sharesOldNet")}" class="cgt-line cgt-line-old"/>
      <path d="${line("sharesNewNet")}" class="cgt-line cgt-line-new"/>
      <line x1="${x(hoverAge)}" x2="${x(hoverAge)}" y1="${PAD.top}" y2="${H - PAD.bottom}" class="cgt-cursor"/>
      <circle cx="${x(hoverAge)}" cy="${y(Math.max(0, hp.existingNet), max)}" r="4" class="cgt-dot-exist"/>
      <circle cx="${x(hoverAge)}" cy="${y(Math.max(0, hp.propertyNet), max)}" r="4" class="cgt-dot-prop"/>
      <circle cx="${x(hoverAge)}" cy="${y(hp.sharesOldNet, max)}" r="4" class="cgt-dot-old"/>
      <circle cx="${x(hoverAge)}" cy="${y(hp.sharesNewNet, max)}" r="4" class="cgt-dot-new"/>`;

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
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    hoverAge = Math.min(60, Math.max(31, Math.round(31 + ((px - PAD.left) / (W - PAD.left - PAD.right)) * 29)));
    render();
  });
  svg.addEventListener("mouseleave", () => { hoverAge = 60; render(); });
  for (const slider of sliders) slider.addEventListener("input", render);
  render();
}
