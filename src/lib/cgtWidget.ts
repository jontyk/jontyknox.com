// Interactive explorer for the CGT article. Mounts into #cgt-explorer if the
// current page contains it; no-op elsewhere.
import { projectPortfolio, marginalRate, type CgtPoint } from "./cgt.ts";

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
      <label>Invested per month <output></output>
        <input type="range" data-k="monthly" min="100" max="3000" step="100" value="500" /></label>
      <label>Expected return <output></output>
        <input type="range" data-k="ret" min="3" max="12" step="0.5" value="8" /></label>
      <label>Portfolio mix <output></output>
        <input type="range" data-k="mix" min="0" max="100" step="5" value="100" /></label>
    </div>
    <p class="cgt-legend">
      <span><span class="swatch old"></span>Old rules (50% discount)</span>
      <span><span class="swatch new"></span>New rules (from July 2027)</span>
      <span>x-axis: age at sale</span>
    </p>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="After-tax portfolio value by sale age under the old and new CGT regimes"></svg>
    <p class="cgt-readout"></p>
    <p class="cgt-note">Assumes ${(INFLATION * 100).toFixed(1)}% inflation, current tax brackets, monthly parcels
    all acquired under the post-July-2027 rules, and full sale at the chosen age. “Portfolio mix” slides
    between new-build property (keeps the 50% discount) and shares/ETFs (indexation + 30% minimum).
    Illustrative only — not financial advice.</p>`;

  const svg = host.querySelector("svg")!;
  const readout = host.querySelector(".cgt-readout")!;
  const sliders = Array.from(host.querySelectorAll<HTMLInputElement>("input[type=range]"));
  let hoverAge = 60;

  const x = (age: number) => PAD.left + ((age - 31) / 29) * (W - PAD.left - PAD.right);
  const y = (v: number, max: number) => H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);

  function state() {
    const get = (k: string) => Number(sliders.find((s) => s.dataset.k === k)!.value);
    return {
      salary: get("salary"),
      monthly: get("monthly"),
      annualReturn: get("ret") / 100,
      inflation: INFLATION,
      sharesPct: get("mix") / 100,
    };
  }

  function render() {
    const s = state();
    const labels: Record<string, string> = {
      salary: fmtFull(s.salary),
      monthly: fmtFull(s.monthly),
      ret: (s.annualReturn * 100).toFixed(1) + "% p.a.",
      mix: Math.round(s.sharesPct * 100) + "% shares / " + Math.round(100 - s.sharesPct * 100) + "% new builds",
    };
    for (const slider of sliders)
      slider.parentElement!.querySelector("output")!.textContent = labels[slider.dataset.k!];

    const points = projectPortfolio(s);
    const max = points[points.length - 1].value * 1.05;
    const line = (key: "oldNet" | "newNet") =>
      points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p[key], max).toFixed(1)}`).join("");

    const yTicks = [0.25, 0.5, 0.75, 1].map((f) => {
      const v = max * f;
      return `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${y(v, max)}" y2="${y(v, max)}" class="cgt-grid"/>
        <text x="${PAD.left - 8}" y="${y(v, max) + 4}" text-anchor="end" class="cgt-tick">${fmtMoney(v)}</text>`;
    }).join("");
    const xTicks = [35, 40, 45, 50, 55, 60].map((age) =>
      `<text x="${x(age)}" y="${H - 10}" text-anchor="middle" class="cgt-tick">${age}</text>`).join("");

    const hp = points.find((p) => p.age === hoverAge)!;
    const gapPath = points.map((p, i) => `${i ? "L" : "M"}${x(p.age).toFixed(1)},${y(p.oldNet, max).toFixed(1)}`).join("")
      + points.slice().reverse().map((p) => `L${x(p.age).toFixed(1)},${y(p.newNet, max).toFixed(1)}`).join("") + "Z";

    svg.innerHTML = `${yTicks}${xTicks}
      <path d="${gapPath}" class="cgt-gap"/>
      <path d="${line("oldNet")}" class="cgt-line cgt-line-old"/>
      <path d="${line("newNet")}" class="cgt-line cgt-line-new"/>
      <line x1="${x(hoverAge)}" x2="${x(hoverAge)}" y1="${PAD.top}" y2="${H - PAD.bottom}" class="cgt-cursor"/>
      <circle cx="${x(hoverAge)}" cy="${y(hp.oldNet, max)}" r="4" class="cgt-dot-old"/>
      <circle cx="${x(hoverAge)}" cy="${y(hp.newNet, max)}" r="4" class="cgt-dot-new"/>`;

    const extra = hp.newTax - hp.oldTax;
    readout.innerHTML =
      `Sell at <strong>${hp.age}</strong> (marginal rate ${(marginalRate(s.salary) * 100).toFixed(0)}%): ` +
      `<strong>${fmtFull(hp.value)}</strong> gross → old rules keep <strong>${fmtFull(hp.oldNet)}</strong>, ` +
      `new rules keep <strong>${fmtFull(hp.newNet)}</strong> — ` +
      (Math.abs(extra) < 1
        ? `no difference.`
        : extra > 0
          ? `<strong class="cgt-delta">${fmtFull(extra)} extra tax</strong>.`
          : `<strong class="cgt-delta-win">${fmtFull(-extra)} less tax</strong>.`);
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
