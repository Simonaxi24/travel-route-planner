# Live Price Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local static Dashboard for comparing S3-HRG and S3-SSH, with editable prices, instant recalculation, source links, risk flags, and JSON export.

**Architecture:** The app is dependency-free static HTML/CSS/JS. A Node build script reads `data/live_price_options.json` and writes `app/live-price-data.js`, then the browser app reads `window.LIVE_PRICE_DATA`, computes branch summaries client-side, renders cards/tabs/tables, and exports edited JSON.

**Tech Stack:** Node.js ESM scripts with built-in modules; browser JavaScript without frameworks; HTML/CSS; Node `assert` tests; optional Python static server for manual browser viewing.

## Global Constraints

- First version does not auto-login or scrape OTA sites.
- First version stores edits only in the browser and exports JSON; no server-side save.
- Main currency is CNY.
- Compare `S3_HRG` and `S3_SSH`.
- `selected !== false` means included in totals; `selected === false` means displayed as an alternative.
- Risk flags must show unknown baggage, unknown/confirm meal plans, low confidence, and placeholder/confirm notes.
- Page must show flights, hotels, activities, and ground transport.
- User can edit CNY prices, toggle included status, edit notes, recalculate totals, open source links, and export updated JSON.
- No dependency installation is required.

---

## File Structure

- Create `app/index.html`: static Dashboard shell with summary area, controls, tabs, tables, and export controls.
- Create `app/styles.css`: responsive dashboard styling for cards, tabs, risk badges, tables, and forms.
- Create `app/dashboard-core.js`: browser-safe pure functions for totals, scoring, risk detection, item metadata, JSON export payload creation.
- Create `app/app.js`: DOM rendering, event handling, tab/filter state, price edits, selected toggles, source links, export download.
- Create `app/live-price-data.js`: generated file containing `window.LIVE_PRICE_DATA`.
- Create `scripts/build_dashboard_data.mjs`: reads `data/live_price_options.json` and writes `app/live-price-data.js`.
- Create `tests/dashboard_core.test.mjs`: imports `app/dashboard-core.js` and verifies totals, risks, edits, and export payload.
- Modify `README.md`: add dashboard build/open instructions.

---

### Task 1: Dashboard Data Build Script

**Files:**
- Create: `scripts/build_dashboard_data.mjs`
- Test: existing shell command checks output.

**Interfaces:**
- Consumes: `data/live_price_options.json`
- Produces: `app/live-price-data.js` with `window.LIVE_PRICE_DATA = <json>;`

- [ ] **Step 1: Create build script**

Create `scripts/build_dashboard_data.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveOptions } from "./validate_live_options.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const inputPath = path.join(rootDir, "data", "live_price_options.json");
const outputDir = path.join(rootDir, "app");
const outputPath = path.join(outputDir, "live-price-data.js");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateLiveOptions(data);

const generated = `window.LIVE_PRICE_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, generated);
console.log(`Wrote ${outputPath}`);
```

- [ ] **Step 2: Run build script**

Run:

```bash
node scripts/build_dashboard_data.mjs
```

Expected: exit 0 and prints `Wrote .../app/live-price-data.js`.

- [ ] **Step 3: Verify generated file contains global data**

Run:

```bash
node -e "const fs=require('fs'); const text=fs.readFileSync('app/live-price-data.js','utf8'); if(!text.startsWith('window.LIVE_PRICE_DATA = ')) throw new Error('missing global'); console.log('dashboard data ok')"
```

Expected: `dashboard data ok`.

---

### Task 2: Browser Core Calculation Functions

**Files:**
- Create: `app/dashboard-core.js`
- Create: `tests/dashboard_core.test.mjs`

**Interfaces:**
- Produces: `summarizeBranches(data): BranchSummary[]`
- Produces: `scoreBranches(summaries): ScoredBranch[]`
- Produces: `getItemPrice(item, category): number`
- Produces: `setItemPrice(item, category, price): object`
- Produces: `getItemRisks(item, category): string[]`
- Produces: `createExportPayload(data): string`

- [ ] **Step 1: Write core tests**

Create `tests/dashboard_core.test.mjs`:

```js
import assert from "node:assert/strict";
import {
  summarizeBranches,
  scoreBranches,
  getItemPrice,
  setItemPrice,
  getItemRisks,
  createExportPayload
} from "../app/dashboard-core.js";

const data = {
  metadata: { currency: "CNY" },
  branches: [
    { id: "S3_HRG", name: "HRG" },
    { id: "S3_SSH", name: "SSH" }
  ],
  flights: [
    { id: "shared", branch_ids: ["S3_HRG", "S3_SSH"], selected: true, price_cny: 1000, duration_minutes: 100, checked_baggage_included: "unknown", confidence_level: "low", notes: "confirm exact date" },
    { id: "hrg", branch_ids: ["S3_HRG"], selected: true, price_cny: 500, duration_minutes: 50, checked_baggage_included: "yes", confidence_level: "medium" },
    { id: "ssh", branch_ids: ["S3_SSH"], selected: false, price_cny: 100, duration_minutes: 20, checked_baggage_included: "yes", confidence_level: "high" }
  ],
  hotels: [
    { id: "hotel-hrg", branch_ids: ["S3_HRG"], selected: true, nights: 2, price_cny_total: 2000, meal_plan: "breakfast available, confirm exact room", confidence_level: "medium" },
    { id: "hotel-ssh", branch_ids: ["S3_SSH"], selected: true, nights: 2, price_cny_total: 1500, meal_plan: "all-inclusive", confidence_level: "high" }
  ],
  activities: [
    { id: "act-hrg", branch_ids: ["S3_HRG"], selected: true, price_cny_total_for_2: 800, confidence_level: "high" },
    { id: "act-ssh", branch_ids: ["S3_SSH"], selected: true, price_cny_total_for_2: 600, confidence_level: "high" }
  ],
  ground_transport: [
    { id: "ground-hrg", branch_ids: ["S3_HRG"], selected: true, price_cny_total: 400, duration_minutes: 200, confidence_level: "low" },
    { id: "ground-ssh", branch_ids: ["S3_SSH"], selected: true, price_cny_total: 200, duration_minutes: 60, confidence_level: "medium" }
  ]
};

assert.equal(getItemPrice(data.flights[0], "flights"), 1000);
assert.equal(getItemPrice(data.hotels[0], "hotels"), 2000);
assert.equal(getItemPrice(data.activities[0], "activities"), 800);
assert.equal(getItemPrice(data.ground_transport[0], "ground_transport"), 400);

const editedFlight = setItemPrice(data.flights[0], "flights", 1234);
assert.equal(editedFlight.price_cny, 1234);
assert.notEqual(editedFlight, data.flights[0]);

const risks = getItemRisks(data.flights[0], "flights");
assert.ok(risks.includes("托运行李待确认"));
assert.ok(risks.includes("低置信度价格"));
assert.ok(risks.includes("需确认"));

const hotelRisks = getItemRisks(data.hotels[0], "hotels");
assert.ok(hotelRisks.includes("餐食/房型待确认"));

const summaries = summarizeBranches(data);
const hrg = summaries.find((summary) => summary.branch_id === "S3_HRG");
const ssh = summaries.find((summary) => summary.branch_id === "S3_SSH");
assert.equal(hrg.total_trip_cny, 4700);
assert.equal(hrg.total_travel_minutes, 350);
assert.equal(ssh.total_trip_cny, 3300);
assert.equal(ssh.total_travel_minutes, 160);

const scored = scoreBranches(summaries);
assert.equal(scored[0].branch_id, "S3_SSH");
assert.equal(scored[0].total_score, 100);

const exported = JSON.parse(createExportPayload(data));
assert.equal(exported.branches.length, 2);
assert.equal(exported.metadata.currency, "CNY");

console.log("dashboard_core tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/dashboard_core.test.mjs
```

Expected: FAIL with module not found for `app/dashboard-core.js`.

- [ ] **Step 3: Implement core module**

Create `app/dashboard-core.js`:

```js
const categoryPriceField = {
  flights: "price_cny",
  hotels: "price_cny_total",
  activities: "price_cny_total_for_2",
  ground_transport: "price_cny_total"
};

function includesBranch(item, branchId) {
  return item.branch_ids.includes(branchId);
}

function selectedItems(items) {
  return items.filter((item) => item.selected !== false);
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function round1(value) {
  return Number(value.toFixed(1));
}

function scoreRatio(best, current) {
  if (!current || !best) return 0;
  return best / current * 100;
}

export function getItemPrice(item, category) {
  return Number(item[categoryPriceField[category]] || 0);
}

export function setItemPrice(item, category, price) {
  const field = categoryPriceField[category];
  return { ...item, [field]: Number(price) || 0 };
}

export function getItemRisks(item, category) {
  const risks = [];
  if (category === "flights" && item.checked_baggage_included === "unknown") risks.push("托运行李待确认");
  if (category === "hotels" && /unknown|confirm/i.test(String(item.meal_plan || ""))) risks.push("餐食/房型待确认");
  if (item.confidence_level === "low") risks.push("低置信度价格");
  const text = `${item.notes || ""} ${item.baggage_note || ""} ${item.tradeoffs || ""}`;
  if (/exact date not visible|placeholder|confirm/i.test(text)) risks.push("需确认");
  return [...new Set(risks)];
}

export function summarizeBranches(data) {
  return data.branches.map((branch) => {
    const flights = selectedItems(data.flights.filter((item) => includesBranch(item, branch.id)));
    const hotels = selectedItems(data.hotels.filter((item) => includesBranch(item, branch.id)));
    const activities = selectedItems(data.activities.filter((item) => includesBranch(item, branch.id)));
    const groundTransport = selectedItems(data.ground_transport.filter((item) => includesBranch(item, branch.id)));
    const totalFlightCny = sum(flights, "price_cny");
    const totalHotelCny = sum(hotels, "price_cny_total");
    const totalActivityCny = sum(activities, "price_cny_total_for_2");
    const totalGroundTransportCny = sum(groundTransport, "price_cny_total");
    const totalTripCny = totalFlightCny + totalHotelCny + totalActivityCny + totalGroundTransportCny;
    const totalTravelMinutes = sum(flights, "duration_minutes") + sum(groundTransport, "duration_minutes");
    return {
      branch_id: branch.id,
      branch_name: branch.name,
      total_flight_cny: totalFlightCny,
      total_hotel_cny: totalHotelCny,
      total_activity_cny: totalActivityCny,
      total_ground_transport_cny: totalGroundTransportCny,
      total_trip_cny: totalTripCny,
      total_trip_cny_per_person: Math.round(totalTripCny / 2),
      total_travel_minutes: totalTravelMinutes,
      hotel_nights: sum(hotels, "nights"),
      checked_baggage_risk_count: flights.filter((flight) => flight.checked_baggage_included !== "yes").length,
      self_transfer_risk_count: flights.filter((flight) => String(flight.layover_summary || "").includes("self-transfer")).length,
      experience_summary: branch.experience_summary || ""
    };
  });
}

export function scoreBranches(summaries) {
  const priced = summaries.filter((summary) => summary.total_trip_cny > 0);
  const timed = summaries.filter((summary) => summary.total_travel_minutes > 0);
  const minPrice = priced.length ? Math.min(...priced.map((summary) => summary.total_trip_cny)) : 0;
  const minTime = timed.length ? Math.min(...timed.map((summary) => summary.total_travel_minutes)) : 0;
  return summaries.map((summary) => {
    const priceScore = scoreRatio(minPrice, summary.total_trip_cny);
    const timeScore = scoreRatio(minTime, summary.total_travel_minutes);
    return {
      ...summary,
      price_score: round1(priceScore),
      time_score: round1(timeScore),
      total_score: round1(priceScore * 0.5 + timeScore * 0.5)
    };
  }).sort((a, b) => b.total_score - a.total_score);
}

export function createExportPayload(data) {
  return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 4: Run core tests**

Run:

```bash
node tests/dashboard_core.test.mjs
```

Expected: `dashboard_core tests passed`.

---

### Task 3: Static Dashboard UI

**Files:**
- Create: `app/index.html`
- Create: `app/styles.css`
- Create: `app/app.js`

**Interfaces:**
- Consumes: `window.LIVE_PRICE_DATA` from `app/live-price-data.js`
- Consumes: functions from `app/dashboard-core.js`
- Produces: interactive browser UI.

- [ ] **Step 1: Create HTML shell**

Create `app/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>埃及方案 3 实时比价 Dashboard</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="page-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Travel Route Planner</p>
          <h1>埃及方案 3 实时比价</h1>
          <p id="price-note" class="muted"></p>
        </div>
        <div class="actions">
          <button id="export-json" type="button">导出 JSON</button>
        </div>
      </header>

      <section id="summary" class="summary-grid" aria-label="方案总价对比"></section>

      <section class="toolbar" aria-label="筛选">
        <div class="segmented" id="tab-buttons"></div>
        <label>
          分支
          <select id="branch-filter">
            <option value="all">全部</option>
            <option value="S3_HRG">S3-HRG</option>
            <option value="S3_SSH">S3-SSH</option>
          </select>
        </label>
        <label>
          状态
          <select id="selected-filter">
            <option value="all">全部</option>
            <option value="selected">计入总价</option>
            <option value="alternative">备选</option>
          </select>
        </label>
      </section>

      <section class="panel">
        <div id="detail-table" class="table-wrap"></div>
      </section>

      <section class="panel">
        <h2>校准提醒</h2>
        <ul id="risk-list" class="risk-list"></ul>
      </section>
    </main>
    <script src="./live-price-data.js"></script>
    <script type="module" src="./app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create CSS**

Create `app/styles.css` using a compact dashboard layout:

```css
:root {
  color-scheme: light;
  --bg: #f6f7f9;
  --surface: #ffffff;
  --text: #1d2433;
  --muted: #657184;
  --line: #d9dee8;
  --accent: #0f766e;
  --accent-weak: #d9f3ef;
  --warn: #b45309;
  --warn-bg: #fff3d7;
  --danger: #b91c1c;
  --danger-bg: #fee2e2;
  --blue: #2563eb;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
a { color: var(--blue); text-decoration: none; }
a:hover { text-decoration: underline; }
button, select, input {
  font: inherit;
}
.page-shell {
  width: min(1440px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 24px 0 40px;
}
.topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--accent);
  font-weight: 700;
}
h1 {
  margin: 0 0 8px;
  font-size: 28px;
  line-height: 1.2;
}
h2 {
  margin: 0 0 14px;
  font-size: 18px;
}
.muted { color: var(--muted); margin: 0; }
.actions button,
.segmented button {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 8px;
  padding: 9px 12px;
  cursor: pointer;
}
.actions button {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.summary-card,
.panel,
.toolbar {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
}
.summary-card {
  padding: 16px;
}
.summary-card.is-best {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-weak);
}
.summary-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}
.summary-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 700;
  background: var(--accent-weak);
  color: var(--accent);
}
.badge.warn { background: var(--warn-bg); color: var(--warn); }
.badge.danger { background: var(--danger-bg); color: var(--danger); }
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}
.metric {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}
.metric span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}
.metric strong {
  display: block;
  font-size: 18px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 14px;
}
.segmented {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.segmented button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.toolbar label {
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}
.toolbar select {
  min-width: 140px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
}
.panel {
  padding: 14px;
  margin-bottom: 14px;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}
th, td {
  border-bottom: 1px solid var(--line);
  padding: 10px 8px;
  text-align: left;
  vertical-align: top;
}
th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  background: #fbfcfd;
}
.price-input {
  width: 108px;
  padding: 6px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.note-input {
  width: 220px;
  padding: 6px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.risk-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.risk-list {
  margin: 0;
  padding-left: 18px;
}
@media (max-width: 820px) {
  .page-shell { width: min(100vw - 20px, 1440px); padding-top: 16px; }
  .topbar { display: block; }
  .actions { margin-top: 12px; }
  .summary-grid { grid-template-columns: 1fr; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

- [ ] **Step 3: Create browser app**

Create `app/app.js`:

```js
import {
  summarizeBranches,
  scoreBranches,
  getItemPrice,
  setItemPrice,
  getItemRisks,
  createExportPayload
} from "./dashboard-core.js";

const categories = [
  { id: "flights", label: "机票" },
  { id: "hotels", label: "酒店" },
  { id: "activities", label: "当地项目" },
  { id: "ground_transport", label: "地面交通" }
];

const state = {
  data: structuredClone(window.LIVE_PRICE_DATA),
  activeCategory: "flights",
  branchFilter: "all",
  selectedFilter: "all"
};

const summaryEl = document.querySelector("#summary");
const priceNoteEl = document.querySelector("#price-note");
const tabButtonsEl = document.querySelector("#tab-buttons");
const branchFilterEl = document.querySelector("#branch-filter");
const selectedFilterEl = document.querySelector("#selected-filter");
const detailTableEl = document.querySelector("#detail-table");
const riskListEl = document.querySelector("#risk-list");
const exportButton = document.querySelector("#export-json");

function money(value) {
  return `¥${Math.round(Number(value || 0)).toLocaleString("zh-CN")}`;
}

function hours(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(1)} 小时`;
}

function itemTitle(item, category) {
  if (category === "flights") return `${item.origin}-${item.destination}`;
  if (category === "hotels") return item.hotel_name;
  if (category === "activities") return item.activity_name;
  return `${item.from}-${item.to}`;
}

function itemSubtitle(item, category) {
  if (category === "flights") return `${item.date || ""} ${item.carrier || ""}`;
  if (category === "hotels") return `${item.city || ""} · ${item.nights || 0}晚 · ${item.meal_plan || ""}`;
  if (category === "activities") return `${item.city || ""} · ${item.duration || ""}`;
  return `${item.mode || ""} · ${hours(item.duration_minutes)}`;
}

function branchNames(item) {
  return item.branch_ids.join(", ");
}

function isVisible(item) {
  const branchOk = state.branchFilter === "all" || item.branch_ids.includes(state.branchFilter);
  const selectedOk =
    state.selectedFilter === "all" ||
    (state.selectedFilter === "selected" && item.selected !== false) ||
    (state.selectedFilter === "alternative" && item.selected === false);
  return branchOk && selectedOk;
}

function renderTabs() {
  tabButtonsEl.innerHTML = categories.map((category) => (
    `<button type="button" class="${category.id === state.activeCategory ? "active" : ""}" data-category="${category.id}">${category.label}</button>`
  )).join("");
}

function renderSummary() {
  const scored = scoreBranches(summarizeBranches(state.data));
  summaryEl.innerHTML = scored.map((branch, index) => `
    <article class="summary-card ${index === 0 ? "is-best" : ""}">
      <div class="summary-head">
        <p class="summary-title">${branch.branch_name}</p>
        <span class="badge ${index === 0 ? "" : "warn"}">${index === 0 ? "当前推荐" : "对比方案"}</span>
      </div>
      <p class="muted">${branch.experience_summary || ""}</p>
      <div class="metric-grid">
        <div class="metric"><span>总价</span><strong>${money(branch.total_trip_cny)}</strong></div>
        <div class="metric"><span>人均参考</span><strong>${money(branch.total_trip_cny_per_person)}</strong></div>
        <div class="metric"><span>移动时间</span><strong>${hours(branch.total_travel_minutes)}</strong></div>
        <div class="metric"><span>综合分</span><strong>${branch.total_score}</strong></div>
      </div>
      <div class="metric-grid">
        <div class="metric"><span>机票</span><strong>${money(branch.total_flight_cny)}</strong></div>
        <div class="metric"><span>酒店</span><strong>${money(branch.total_hotel_cny)}</strong></div>
        <div class="metric"><span>项目</span><strong>${money(branch.total_activity_cny)}</strong></div>
        <div class="metric"><span>交通</span><strong>${money(branch.total_ground_transport_cny)}</strong></div>
      </div>
      <p class="muted">行李待确认航段：${branch.checked_baggage_risk_count}</p>
    </article>
  `).join("");
}

function renderTable() {
  const category = state.activeCategory;
  const items = state.data[category].filter(isVisible);
  detailTableEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>计入</th>
          <th>项目</th>
          <th>分支</th>
          <th>平台/来源</th>
          <th>价格</th>
          <th>风险</th>
          <th>备注</th>
          <th>链接</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => rowTemplate(item, category)).join("")}
      </tbody>
    </table>
  `;
}

function rowTemplate(item, category) {
  const risks = getItemRisks(item, category);
  return `
    <tr data-category="${category}" data-id="${item.id}">
      <td><input type="checkbox" class="selected-toggle" ${item.selected !== false ? "checked" : ""}></td>
      <td><strong>${itemTitle(item, category)}</strong><br><span class="muted">${itemSubtitle(item, category)}</span></td>
      <td>${branchNames(item)}</td>
      <td>${item.platform || item.provider_or_platform || ""}</td>
      <td><input class="price-input" type="number" min="0" step="1" value="${getItemPrice(item, category)}"></td>
      <td><div class="risk-pills">${risks.length ? risks.map((risk) => `<span class="badge ${risk.includes("低") ? "warn" : "danger"}">${risk}</span>`).join("") : `<span class="badge">OK</span>`}</div></td>
      <td><input class="note-input" type="text" value="${(item.notes || item.tradeoffs || "").replaceAll('"', "&quot;")}"></td>
      <td>${item.booking_url_or_search_url ? `<a href="${item.booking_url_or_search_url}" target="_blank" rel="noreferrer">打开来源</a>` : ""}</td>
    </tr>
  `;
}

function renderRisks() {
  const allRisks = [];
  for (const category of categories) {
    for (const item of state.data[category.id]) {
      const risks = getItemRisks(item, category.id);
      for (const risk of risks) allRisks.push(`${category.label} · ${itemTitle(item, category.id)}：${risk}`);
    }
  }
  riskListEl.innerHTML = allRisks.length ? allRisks.map((risk) => `<li>${risk}</li>`).join("") : "<li>暂无风险提示。</li>";
}

function render() {
  priceNoteEl.textContent = `${state.data.metadata.last_checked_at} · ${state.data.metadata.price_validity_note}`;
  renderTabs();
  renderSummary();
  renderTable();
  renderRisks();
}

function findItem(category, id) {
  return state.data[category].find((item) => item.id === id);
}

tabButtonsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.activeCategory = button.dataset.category;
  render();
});

branchFilterEl.addEventListener("change", () => {
  state.branchFilter = branchFilterEl.value;
  renderTable();
});

selectedFilterEl.addEventListener("change", () => {
  state.selectedFilter = selectedFilterEl.value;
  renderTable();
});

detailTableEl.addEventListener("input", (event) => {
  const row = event.target.closest("tr[data-category][data-id]");
  if (!row) return;
  const item = findItem(row.dataset.category, row.dataset.id);
  if (!item) return;
  if (event.target.classList.contains("price-input")) {
    Object.assign(item, setItemPrice(item, row.dataset.category, event.target.value));
  }
  if (event.target.classList.contains("note-input")) {
    item.notes = event.target.value;
  }
  renderSummary();
  renderRisks();
});

detailTableEl.addEventListener("change", (event) => {
  const row = event.target.closest("tr[data-category][data-id]");
  if (!row) return;
  const item = findItem(row.dataset.category, row.dataset.id);
  if (!item) return;
  if (event.target.classList.contains("selected-toggle")) {
    item.selected = event.target.checked;
  }
  renderSummary();
  renderTable();
  renderRisks();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([createExportPayload(state.data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "live_price_options.updated.json";
  link.click();
  URL.revokeObjectURL(url);
});

render();
```

- [ ] **Step 4: Build data and verify files**

Run:

```bash
node scripts/build_dashboard_data.mjs
test -f app/index.html
test -f app/styles.css
test -f app/app.js
test -f app/live-price-data.js
```

Expected: all commands exit 0.

---

### Task 4: Dashboard Verification Script

**Files:**
- Create: `scripts/verify_dashboard.mjs`

**Interfaces:**
- Consumes: app files and generated data.
- Produces: CLI verification of expected strings and score consistency.

- [ ] **Step 1: Create verification script**

Create `scripts/verify_dashboard.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeBranches as nodeSummarize, scoreBranches as nodeScore } from "./live_price_scoring.mjs";
import { summarizeBranches as browserSummarize, scoreBranches as browserScore } from "../app/dashboard-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(rootDir, "data", "live_price_options.json"), "utf8"));
const html = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const generated = fs.readFileSync(path.join(rootDir, "app", "live-price-data.js"), "utf8");

for (const text of ["summary", "detail-table", "export-json", "live-price-data.js"]) {
  if (!html.includes(text)) throw new Error(`index.html missing ${text}`);
}

for (const text of ["addEventListener", "createExportPayload", "renderSummary"]) {
  if (!app.includes(text)) throw new Error(`app.js missing ${text}`);
}

if (!generated.startsWith("window.LIVE_PRICE_DATA = ")) {
  throw new Error("Generated dashboard data is missing global assignment");
}

const nodeScored = nodeScore(nodeSummarize(data));
const browserScored = browserScore(browserSummarize(data));

for (const nodeBranch of nodeScored) {
  const browserBranch = browserScored.find((branch) => branch.branch_id === nodeBranch.branch_id);
  if (!browserBranch) throw new Error(`Missing browser branch ${nodeBranch.branch_id}`);
  if (browserBranch.total_trip_cny !== nodeBranch.total_trip_cny) throw new Error(`Total mismatch for ${nodeBranch.branch_id}`);
  if (browserBranch.total_score !== nodeBranch.total_score) throw new Error(`Score mismatch for ${nodeBranch.branch_id}`);
}

console.log("dashboard verification passed");
```

- [ ] **Step 2: Run verification**

Run:

```bash
node scripts/build_dashboard_data.mjs
node tests/dashboard_core.test.mjs
node scripts/verify_dashboard.mjs
```

Expected:

```text
dashboard_core tests passed
dashboard verification passed
```

---

### Task 5: README And Manual Browser Check

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: user-facing dashboard instructions.

- [ ] **Step 1: Update README**

Append:

```markdown
## 本地网页 Dashboard

生成页面数据：

```bash
node scripts/build_dashboard_data.mjs
```

打开方式：

```bash
cd /Users/xixinyu.simona/projects/路径规划/.worktrees/live-price-comparison
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/app/
```

Dashboard 支持：

- 查看 S3-HRG / S3-SSH 总价对比
- 查看机票、酒店、当地项目、地面交通明细
- 打开来源链接
- 修改人民币价格并即时重算
- 切换候选是否计入总价
- 导出更新后的 JSON
```

- [ ] **Step 2: Run full verification**

Run:

```bash
node tests/validate_live_options.test.mjs
node tests/live_price_scoring.test.mjs
node tests/dashboard_core.test.mjs
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/score_live_options.mjs
node scripts/build_dashboard_data.mjs
node scripts/verify_dashboard.mjs
```

Expected: all tests/scripts exit 0; validator warnings about unknown baggage are acceptable.

- [ ] **Step 3: Start local server**

Run:

```bash
python3 -m http.server 8000
```

Expected: server starts. Keep the session running until visual verification is complete.

- [ ] **Step 4: Browser check**

Use browser automation or manual browser access to `http://localhost:8000/app/` and verify:

- S3-HRG and S3-SSH cards are visible.
- Four tabs are visible.
- Price inputs are visible.
- Changing a price updates total.
- Export button exists.

- [ ] **Step 5: Stop local server**

Stop the server session with Ctrl-C.

- [ ] **Step 6: Final status**

Run:

```bash
git status --short
```

Expected: shows the new/modified dashboard files. If git staging is blocked by sandbox approval, do not bypass; report the manual commit commands.
