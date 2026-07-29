# Egypt Live Price Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a semi-automated, source-backed CNY comparison for the two方案3 Egypt branches: Cairo+Luxor+Hurghada and Cairo+Sharm El Sheikh.

**Architecture:** Keep collected price data in a structured JSON file, run deterministic Node scripts to validate and score it, then generate a Markdown report from the same data. Web price collection remains semi-automated: Codex searches public pages, records visible prices and source URLs, and marks unavailable or uncertain fields explicitly.

**Tech Stack:** Node.js ESM scripts using built-in `fs`, `path`, `assert`; JSON data files; Markdown reports; no package installation required.

## Global Constraints

- Main output currency is CNY.
- Compare only方案3 branches: `S3_HRG` and `S3_SSH`.
- Dates: 09-24 Beijing to Lanzhou, 09-27 Lanzhou to Changchun, 09-27 or 09-28 Changchun to Beijing, 09-29 Beijing to Cairo, 10-06 Cairo to Beijing.
- Travelers: flights for traveler A full route; Egypt hotel and activity pricing for 2 adults, 1 room.
- Hotels: each city gets 2-3 candidates where publicly visible prices can be found.
- Beach hotels: prioritize good environment, high rating, breakfast+dinner or all-inclusive.
- City hotels: prioritize convenient transport, cleanliness, safety, stable reviews.
- Hotel sources: Ctrip, Qunar, Fliggy, Meituan, Booking, Agoda, Trip.com, Expedia, Hotels.com, local/regional platforms, and hotel official sites.
- Activities: prioritize overseas platforms such as GetYourGuide, Viator, Tripadvisor, Klook, and KKday; Chinese platforms are cross-checks only.
- Do not assume checked baggage is included when the source does not confirm it.
- Do not assume hotel meal plan is included when the source does not confirm it.
- Do not bypass login, CAPTCHA, app-only prices, or anti-scraping limits.
- Current directory is not a git repository; commit steps should be replaced by a local verification note unless a git repository is initialized by the user.

---

## File Structure

- Create `data/live_price_options.json`: canonical live-price dataset, including metadata, branches, flights, hotels, activities, ground transport, and source notes.
- Create `scripts/validate_live_options.mjs`: schema and consistency validator for `data/live_price_options.json`.
- Create `scripts/score_live_options.mjs`: imports scoring helpers and prints branch summary.
- Create `scripts/live_price_scoring.mjs`: pure functions for totals, risk counts, and score calculation.
- Create `scripts/generate_live_report.mjs`: renders `reports/2026-09-egypt-live-price-comparison.md` from JSON and scoring functions.
- Create `tests/live_price_scoring.test.mjs`: Node `assert` tests for scoring and totals.
- Create `tests/validate_live_options.test.mjs`: Node `assert` tests for the validator.
- Create `reports/2026-09-egypt-live-price-comparison.md`: generated or manually refreshed report from the live-price dataset.

---

### Task 1: Create Live Price Dataset Skeleton And Validator

**Files:**
- Create: `data/live_price_options.json`
- Create: `scripts/validate_live_options.mjs`
- Test: `tests/validate_live_options.test.mjs`

**Interfaces:**
- Produces: JSON shape consumed by all later tasks.
- Produces: `validateLiveOptions(data: object): { ok: true, warnings: string[] }`.
- Produces: CLI command `node scripts/validate_live_options.mjs data/live_price_options.json`.

- [ ] **Step 1: Write the failing validator test**

Create `tests/validate_live_options.test.mjs`:

```js
import assert from "node:assert/strict";
import { validateLiveOptions } from "../scripts/validate_live_options.mjs";

const validData = {
  metadata: {
    created_at: "2026-07-29",
    last_checked_at: "2026-07-29T12:00:00+08:00",
    currency: "CNY",
    exchange_rates: [{ pair: "USD_CNY", rate: 7.2, source: "manual", checked_at: "2026-07-29" }]
  },
  branches: [
    { id: "S3_HRG", name: "方案3：开罗+卢克索+赫尔格达" },
    { id: "S3_SSH", name: "方案3：开罗+沙姆沙伊赫" }
  ],
  flights: [
    {
      id: "flight-domestic-bjs-lhw",
      branch_ids: ["S3_HRG", "S3_SSH"],
      date: "2026-09-24",
      origin: "BJS",
      destination: "LHW",
      platform: "Ctrip",
      carrier: "public-search",
      departure_time: "evening",
      arrival_time: "night",
      duration_minutes: 165,
      price_cny: 900,
      checked_baggage_included: "unknown",
      booking_url_or_search_url: "https://www.ctrip.com/",
      confidence_level: "low"
    }
  ],
  hotels: [],
  activities: [],
  ground_transport: [],
  source_notes: []
};

assert.equal(validateLiveOptions(validData).ok, true);

const invalidData = structuredClone(validData);
delete invalidData.metadata.currency;
assert.throws(() => validateLiveOptions(invalidData), /metadata.currency/);

const invalidBranch = structuredClone(validData);
invalidBranch.flights[0].branch_ids = ["BAD_BRANCH"];
assert.throws(() => validateLiveOptions(invalidBranch), /Unknown branch id BAD_BRANCH/);

console.log("validate_live_options tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/validate_live_options.test.mjs
```

Expected: FAIL with module not found for `scripts/validate_live_options.mjs`.

- [ ] **Step 3: Create dataset skeleton**

Create `data/live_price_options.json`:

```json
{
  "metadata": {
    "created_at": "2026-07-29",
    "last_checked_at": "2026-07-29T12:00:00+08:00",
    "currency": "CNY",
    "exchange_rates": [
      {
        "pair": "USD_CNY",
        "rate": 7.2,
        "source": "manual placeholder for query-day conversion",
        "checked_at": "2026-07-29"
      }
    ],
    "price_validity_note": "Prices are public visible prices collected during research and must be rechecked before booking."
  },
  "branches": [
    {
      "id": "S3_HRG",
      "name": "方案3：开罗+卢克索+赫尔格达",
      "experience_summary": "历史完整度更强，覆盖开罗/吉萨、卢克索和红海赫尔格达。"
    },
    {
      "id": "S3_SSH",
      "name": "方案3：开罗+沙姆沙伊赫",
      "experience_summary": "价格和时间更轻，覆盖开罗/吉萨和红海沙姆沙伊赫度假。"
    }
  ],
  "flights": [],
  "hotels": [],
  "activities": [],
  "ground_transport": [],
  "source_notes": []
}
```

- [ ] **Step 4: Implement validator**

Create `scripts/validate_live_options.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requiredTopLevelKeys = ["metadata", "branches", "flights", "hotels", "activities", "ground_transport", "source_notes"];
const allowedConfidence = new Set(["high", "medium", "low"]);
const allowedBaggage = new Set(["yes", "no", "unknown"]);

function requireField(object, field, label) {
  if (object[field] === undefined || object[field] === null || object[field] === "") {
    throw new Error(`Missing required field ${label}.${field}`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function assertBranchIds(branchIds, knownBranchIds) {
  assertArray(branchIds, "branch_ids");
  for (const branchId of branchIds) {
    if (!knownBranchIds.has(branchId)) {
      throw new Error(`Unknown branch id ${branchId}`);
    }
  }
}

export function validateLiveOptions(data) {
  for (const key of requiredTopLevelKeys) requireField(data, key, "root");
  requireField(data.metadata, "currency", "metadata");
  if (data.metadata.currency !== "CNY") throw new Error("metadata.currency must be CNY");

  assertArray(data.branches, "branches");
  assertArray(data.flights, "flights");
  assertArray(data.hotels, "hotels");
  assertArray(data.activities, "activities");
  assertArray(data.ground_transport, "ground_transport");
  assertArray(data.source_notes, "source_notes");

  const branchIds = new Set(data.branches.map((branch) => branch.id));
  for (const branch of data.branches) {
    requireField(branch, "id", "branch");
    requireField(branch, "name", "branch");
  }

  const warnings = [];

  for (const flight of data.flights) {
    requireField(flight, "id", "flight");
    assertBranchIds(flight.branch_ids, branchIds);
    for (const field of ["date", "origin", "destination", "platform", "price_cny", "duration_minutes", "checked_baggage_included", "booking_url_or_search_url", "confidence_level"]) {
      requireField(flight, field, "flight");
    }
    if (!allowedBaggage.has(flight.checked_baggage_included)) throw new Error(`Invalid baggage flag on flight ${flight.id}`);
    if (!allowedConfidence.has(flight.confidence_level)) throw new Error(`Invalid confidence level on flight ${flight.id}`);
    if (flight.checked_baggage_included === "unknown") warnings.push(`Flight ${flight.id} has unknown baggage`);
  }

  for (const hotel of data.hotels) {
    requireField(hotel, "id", "hotel");
    assertBranchIds(hotel.branch_ids, branchIds);
    for (const field of ["city", "check_in", "check_out", "nights", "platform", "hotel_name", "meal_plan", "price_cny_total", "booking_url_or_search_url", "confidence_level"]) {
      requireField(hotel, field, "hotel");
    }
    if (!allowedConfidence.has(hotel.confidence_level)) throw new Error(`Invalid confidence level on hotel ${hotel.id}`);
    if (hotel.meal_plan === "unknown") warnings.push(`Hotel ${hotel.id} has unknown meal plan`);
  }

  for (const activity of data.activities) {
    requireField(activity, "id", "activity");
    assertBranchIds(activity.branch_ids, branchIds);
    for (const field of ["city", "platform", "activity_name", "duration", "price_cny_total_for_2", "booking_url_or_search_url", "confidence_level"]) {
      requireField(activity, field, "activity");
    }
    if (!allowedConfidence.has(activity.confidence_level)) throw new Error(`Invalid confidence level on activity ${activity.id}`);
  }

  for (const transport of data.ground_transport) {
    requireField(transport, "id", "transport");
    assertBranchIds(transport.branch_ids, branchIds);
    for (const field of ["from", "to", "mode", "duration_minutes", "price_cny_total", "confidence_level"]) {
      requireField(transport, field, "transport");
    }
    if (!allowedConfidence.has(transport.confidence_level)) throw new Error(`Invalid confidence level on transport ${transport.id}`);
  }

  return { ok: true, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "live_price_options.json");
  const data = JSON.parse(fs.readFileSync(target, "utf8"));
  const result = validateLiveOptions(data);
  console.log(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 5: Run validator tests**

Run:

```bash
node tests/validate_live_options.test.mjs
node scripts/validate_live_options.mjs data/live_price_options.json
```

Expected: both PASS; validator outputs `{ "ok": true, "warnings": [] }`.

- [ ] **Step 6: Record commit status**

Run:

```bash
git status --short
```

Expected in current workspace: FAIL with `fatal: not a git repository`. Record this in the final implementation summary instead of committing.

---

### Task 2: Implement Scoring And Summary Engine

**Files:**
- Create: `scripts/live_price_scoring.mjs`
- Create: `scripts/score_live_options.mjs`
- Test: `tests/live_price_scoring.test.mjs`

**Interfaces:**
- Consumes: validated live options JSON.
- Produces: `summarizeBranches(data: object): Array<BranchSummary>`.
- Produces: `scoreBranches(summaries: Array<BranchSummary>): Array<ScoredBranch>`.
- Produces: CLI command `node scripts/score_live_options.mjs`.

- [ ] **Step 1: Write scoring tests**

Create `tests/live_price_scoring.test.mjs`:

```js
import assert from "node:assert/strict";
import { summarizeBranches, scoreBranches } from "../scripts/live_price_scoring.mjs";

const data = {
  branches: [
    { id: "S3_HRG", name: "HRG" },
    { id: "S3_SSH", name: "SSH" }
  ],
  flights: [
    { branch_ids: ["S3_HRG", "S3_SSH"], price_cny: 1000, duration_minutes: 120, checked_baggage_included: "yes" },
    { branch_ids: ["S3_HRG"], price_cny: 500, duration_minutes: 60, checked_baggage_included: "unknown" },
    { branch_ids: ["S3_SSH"], price_cny: 300, duration_minutes: 40, checked_baggage_included: "yes" }
  ],
  hotels: [
    { branch_ids: ["S3_HRG"], price_cny_total: 2000 },
    { branch_ids: ["S3_SSH"], price_cny_total: 1500 }
  ],
  activities: [
    { branch_ids: ["S3_HRG"], price_cny_total_for_2: 800 },
    { branch_ids: ["S3_SSH"], price_cny_total_for_2: 600 }
  ],
  ground_transport: [
    { branch_ids: ["S3_HRG"], price_cny_total: 400, duration_minutes: 240 },
    { branch_ids: ["S3_SSH"], price_cny_total: 200, duration_minutes: 60 }
  ]
};

const summaries = summarizeBranches(data);
const hrg = summaries.find((summary) => summary.branch_id === "S3_HRG");
const ssh = summaries.find((summary) => summary.branch_id === "S3_SSH");

assert.equal(hrg.total_trip_cny, 4700);
assert.equal(hrg.total_travel_minutes, 420);
assert.equal(hrg.checked_baggage_risk_count, 1);
assert.equal(ssh.total_trip_cny, 3600);
assert.equal(ssh.total_travel_minutes, 220);

const scored = scoreBranches(summaries);
assert.equal(scored[0].branch_id, "S3_SSH");
assert.equal(scored[0].price_score, 100);
assert.equal(scored[0].time_score, 100);
assert.ok(scored[1].total_score < 100);

console.log("live_price_scoring tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/live_price_scoring.test.mjs
```

Expected: FAIL with module not found for `scripts/live_price_scoring.mjs`.

- [ ] **Step 3: Implement scoring helpers**

Create `scripts/live_price_scoring.mjs`:

```js
function includesBranch(item, branchId) {
  return item.branch_ids.includes(branchId);
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function round1(value) {
  return Number(value.toFixed(1));
}

export function summarizeBranches(data) {
  return data.branches.map((branch) => {
    const flights = data.flights.filter((item) => includesBranch(item, branch.id));
    const hotels = data.hotels.filter((item) => includesBranch(item, branch.id));
    const activities = data.activities.filter((item) => includesBranch(item, branch.id));
    const groundTransport = data.ground_transport.filter((item) => includesBranch(item, branch.id));

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
  const minPrice = Math.min(...summaries.map((summary) => summary.total_trip_cny));
  const minTime = Math.min(...summaries.map((summary) => summary.total_travel_minutes));
  return summaries
    .map((summary) => {
      const priceScore = minPrice / summary.total_trip_cny * 100;
      const timeScore = minTime / summary.total_travel_minutes * 100;
      return {
        ...summary,
        price_score: round1(priceScore),
        time_score: round1(timeScore),
        total_score: round1(priceScore * 0.5 + timeScore * 0.5)
      };
    })
    .sort((a, b) => b.total_score - a.total_score);
}
```

- [ ] **Step 4: Implement CLI**

Create `scripts/score_live_options.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveOptions } from "./validate_live_options.mjs";
import { summarizeBranches, scoreBranches } from "./live_price_scoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = process.argv[2] || path.join(__dirname, "..", "data", "live_price_options.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const validation = validateLiveOptions(data);
const summaries = summarizeBranches(data);
const scored = scoreBranches(summaries);

console.table(scored.map((summary) => ({
  branch: summary.branch_id,
  total_cny: summary.total_trip_cny,
  per_person_cny: summary.total_trip_cny_per_person,
  travel_hours: Number((summary.total_travel_minutes / 60).toFixed(1)),
  baggage_risks: summary.checked_baggage_risk_count,
  price_score: summary.price_score,
  time_score: summary.time_score,
  total_score: summary.total_score
})));

if (validation.warnings.length) {
  console.log("Warnings:");
  for (const warning of validation.warnings) console.log(`- ${warning}`);
}
```

- [ ] **Step 5: Run scoring tests and CLI**

Run:

```bash
node tests/live_price_scoring.test.mjs
node scripts/score_live_options.mjs
```

Expected: test PASS; CLI prints two branches with zero or empty totals until live data is collected. If zero totals cause `Infinity`, add a guard that returns score `0` when totals are zero and rerun.

---

### Task 3: Collect Public Visible Prices Into JSON

**Files:**
- Modify: `data/live_price_options.json`
- Modify: `reports/2026-09-egypt-live-price-comparison.md` only if a source note needs immediate human explanation.

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: populated arrays for `flights`, `hotels`, `activities`, and `ground_transport`.

- [ ] **Step 1: Gather exchange rate**

Use web search or finance pages to record USD/CNY and, if needed, EUR/CNY or EGP/CNY. Update `metadata.exchange_rates` with query-day values and source URLs.

Verification:

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
```

Expected: PASS.

- [ ] **Step 2: Collect shared domestic and international flights**

Search public pages for:

- BJS → LHW, 2026-09-24 evening.
- LHW → CGQ, 2026-09-27 morning.
- CGQ → BJS, 2026-09-27 evening or 2026-09-28.
- BJS → CAI, 2026-09-29.
- CAI → BJS, 2026-10-06.

Record each item with `branch_ids: ["S3_HRG", "S3_SSH"]`. Use Chinese platforms first, then airline and international platforms. Set `checked_baggage_included` to `unknown` unless the visible fare rule confirms it.

Verification:

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/score_live_options.mjs
```

Expected: PASS; both branches have nonzero flight totals.

- [ ] **Step 3: Collect S3-HRG branch-specific flights and transfer**

Search public pages for:

- CAI → LXR around 2026-10-01 or 2026-10-02.
- HRG → CAI around 2026-10-05 or 2026-10-06.
- LXR → HRG private transfer or bus.

Record flights under `flights` with `branch_ids: ["S3_HRG"]`. Record private transfer or bus under `ground_transport` with `branch_ids: ["S3_HRG"]`.

Verification:

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
```

Expected: PASS; S3-HRG has branch-specific Egypt transport.

- [ ] **Step 4: Collect S3-SSH branch-specific flights and transfers**

Search public pages for:

- CAI → SSH around 2026-10-02 or 2026-10-03.
- SSH → CAI around 2026-10-05 or 2026-10-06.
- Airport transfers in Sharm El Sheikh if not included by hotel or activities.

Record flights under `flights` with `branch_ids: ["S3_SSH"]`. Record transfers under `ground_transport`.

Verification:

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
```

Expected: PASS; S3-SSH has branch-specific Egypt transport.

- [ ] **Step 5: Collect hotels**

For each city, find 2-3 candidates when public visible prices are available:

- Cairo: S3-HRG and S3-SSH shared candidates for 2026-09-29 to 2026-10-01.
- Luxor: S3-HRG for 2026-10-01 to 2026-10-03.
- Hurghada: S3-HRG for 2026-10-03 to 2026-10-06, breakfast+dinner or all-inclusive preferred.
- Sharm El Sheikh: S3-SSH for 2026-10-02 to 2026-10-06, breakfast+dinner or all-inclusive preferred.

Record `meal_plan` precisely as visible, such as `breakfast`, `half-board`, `all-inclusive`, or `unknown`. Use `branch_ids` to share Cairo candidates across both branches.

Verification:

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
```

Expected: PASS; validator warnings are acceptable only when a public source does not reveal meal plan.

- [ ] **Step 6: Collect activities**

Search overseas platforms first:

- Cairo/Giza: Pyramids + museum or old Cairo half-day/day tour for 2 adults.
- Luxor: East and West Bank guide/driver day tour for 2 adults.
- Hurghada: Red Sea snorkeling, diving intro, or island day trip for 2 adults.
- Sharm El Sheikh: Ras Mohammed, snorkeling/diving, or boat trip for 2 adults.

Record at least two beach activity candidates per Red Sea branch. Include pickup, duration, language, rating, review count when visible.

Verification:

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/score_live_options.mjs
```

Expected: PASS; both branches have nonzero activity totals.

---

### Task 4: Generate Markdown Report From Live Data

**Files:**
- Create: `scripts/generate_live_report.mjs`
- Create or update: `reports/2026-09-egypt-live-price-comparison.md`

**Interfaces:**
- Consumes: `data/live_price_options.json`.
- Consumes: `summarizeBranches(data)` and `scoreBranches(summaries)`.
- Produces: deterministic Markdown report.

- [ ] **Step 1: Create report generator**

Create `scripts/generate_live_report.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveOptions } from "./validate_live_options.mjs";
import { summarizeBranches, scoreBranches } from "./live_price_scoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const dataPath = path.join(rootDir, "data", "live_price_options.json");
const reportPath = path.join(rootDir, "reports", "2026-09-egypt-live-price-comparison.md");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const validation = validateLiveOptions(data);
const scored = scoreBranches(summarizeBranches(data));

function money(value) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function hours(minutes) {
  return `${(minutes / 60).toFixed(1)} 小时`;
}

function table(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row) ?? "")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

function branchRows() {
  return table(scored, [
    { label: "分支", value: (row) => row.branch_name },
    { label: "总价", value: (row) => money(row.total_trip_cny) },
    { label: "人均", value: (row) => money(row.total_trip_cny_per_person) },
    { label: "移动时间", value: (row) => hours(row.total_travel_minutes) },
    { label: "行李风险", value: (row) => row.checked_baggage_risk_count },
    { label: "综合分", value: (row) => row.total_score }
  ]);
}

function itemTable(title, items, columns) {
  return `## ${title}\n\n${items.length ? table(items, columns) : "暂无公开可见价格。"}\n`;
}

const recommended = scored[0];
const content = `# 2026 埃及方案 3 实时比价报告

查询时间：${data.metadata.last_checked_at}

价格说明：主币种为人民币。公开网页无法确认的托运行李、餐食或取消政策会标记为 unknown，不默认计为已包含。

## 结论

按价格和时间同权重，当前排序第一的是 **${recommended.branch_name}**，总价约 **${money(recommended.total_trip_cny)}**，人均约 **${money(recommended.total_trip_cny_per_person)}**。

## 总价对比

${branchRows()}

${itemTable("机票明细", data.flights, [
  { label: "日期", value: (row) => row.date },
  { label: "航段", value: (row) => `${row.origin}-${row.destination}` },
  { label: "平台", value: (row) => row.platform },
  { label: "航司/摘要", value: (row) => row.carrier || row.flight_number_or_summary || "" },
  { label: "价格", value: (row) => money(row.price_cny) },
  { label: "托运行李", value: (row) => row.checked_baggage_included },
  { label: "置信度", value: (row) => row.confidence_level }
])}

${itemTable("酒店候选", data.hotels, [
  { label: "城市", value: (row) => row.city },
  { label: "酒店", value: (row) => row.hotel_name },
  { label: "平台", value: (row) => row.platform },
  { label: "晚数", value: (row) => row.nights },
  { label: "餐食", value: (row) => row.meal_plan },
  { label: "总价", value: (row) => money(row.price_cny_total) },
  { label: "适合理由", value: (row) => row.why_candidate || "" }
])}

${itemTable("当地项目", data.activities, [
  { label: "城市", value: (row) => row.city },
  { label: "项目", value: (row) => row.activity_name },
  { label: "平台", value: (row) => row.platform },
  { label: "时长", value: (row) => row.duration },
  { label: "接送", value: (row) => row.pickup_included || "" },
  { label: "2人价格", value: (row) => money(row.price_cny_total_for_2) }
])}

${itemTable("地面交通", data.ground_transport, [
  { label: "路线", value: (row) => `${row.from}-${row.to}` },
  { label: "方式", value: (row) => row.mode },
  { label: "时长", value: (row) => hours(row.duration_minutes) },
  { label: "总价", value: (row) => money(row.price_cny_total) },
  { label: "备注", value: (row) => row.notes || "" }
])}

## 校准清单

${validation.warnings.length ? validation.warnings.map((warning) => `- ${warning}`).join("\n") : "- 当前结构校验无警告。"}
`;

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, content);
console.log(`Wrote ${reportPath}`);
```

- [ ] **Step 2: Run report generator**

Run:

```bash
node scripts/generate_live_report.mjs
```

Expected: writes `reports/2026-09-egypt-live-price-comparison.md`.

- [ ] **Step 3: Inspect generated report**

Run:

```bash
sed -n '1,260p' reports/2026-09-egypt-live-price-comparison.md
```

Expected: report includes conclusion, total comparison, flight table, hotel table, activity table, ground transport table, and calibration checklist.

---

### Task 5: Final Verification And Delivery

**Files:**
- Modify: `README.md`
- Verify: all created files.

**Interfaces:**
- Consumes: outputs of Tasks 1-4.
- Produces: updated project README with live comparison commands.

- [ ] **Step 1: Update README**

Add this section to `README.md`:

```markdown
## 实时比价工作流

半自动实时比价围绕方案 3：

- S3-HRG：开罗 + 卢克索 + 赫尔格达
- S3-SSH：开罗 + 沙姆沙伊赫

数据文件：

- `data/live_price_options.json`

验证和评分：

```bash
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/score_live_options.mjs
node scripts/generate_live_report.mjs
```

生成报告：

- `reports/2026-09-egypt-live-price-comparison.md`
```

- [ ] **Step 2: Run all verification commands**

Run:

```bash
node tests/validate_live_options.test.mjs
node tests/live_price_scoring.test.mjs
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/score_live_options.mjs
node scripts/generate_live_report.mjs
```

Expected: tests pass, validator passes, scorer prints branch comparison, report is generated.

- [ ] **Step 3: Check file list**

Run:

```bash
find data scripts tests reports docs/superpowers -maxdepth 3 -type f | sort
```

Expected: includes `data/live_price_options.json`, all new scripts, tests, plan, spec, and live price report.

- [ ] **Step 4: Record git status**

Run:

```bash
git status --short
```

Expected in current workspace: `fatal: not a git repository`. Mention that no commit was created because the workspace is not a git repository.

- [ ] **Step 5: Delivery summary**

Final response should include:

- Path to live comparison report.
- Path to live price JSON.
- Verification commands run and their results.
- Clear note about any publicly unavailable prices or unknown baggage/meal fields.
- Clear recommendation between S3-HRG and S3-SSH based on collected prices.
