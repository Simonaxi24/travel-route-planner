# Itinerary Result Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the price-table Dashboard with a Chinese itinerary-result workspace that only presents actually researched flight candidates as conclusions, supports 9/29 vs 9/30 scenarios, and clearly flags missing direct flights or missing required candidates.

**Architecture:** Add a v2 itinerary data model beside the current price data, then add browser-safe itinerary core functions that score only feasible scenarios. The UI renders a Chinese timeline and scenario switcher from those functions, while retaining editable prices/source links/export behavior.

**Tech Stack:** Node.js ESM scripts with built-in modules; browser JavaScript without frameworks; static HTML/CSS; Node `assert` tests; optional Python static server for manual viewing.

## Global Constraints

- No searched flight candidate may be represented as a final itinerary result unless it has concrete departure time, arrival time, direct/stop status, price, source platform, and searched timestamp.
- Missing required segments must render as `待查询` and must not participate in recommendation scoring.
- If no direct flight is found for a route/date, render `未找到直飞` explicitly.
- Main route labels must be Chinese city/airport names; airport codes are secondary helper text only.
- Support scenario switching for `9/29 出发` and `9/30 出发`.
- Support branch switching for `开罗 + 卢克索 + 赫尔格达` and `开罗 + 沙姆沙伊赫`.
- Keep currency in CNY.
- Keep the app dependency-free.
- Keep source links and editable CNY prices.

---

## File Structure

- Create `data/itinerary_scenarios.json`: v2 researched scenario data and missing-segment records.
- Create `scripts/validate_itinerary_scenarios.mjs`: schema and no-placeholder validation.
- Create `scripts/build_itinerary_data.mjs`: writes `app/itinerary-data.js` as `window.ITINERARY_DATA`.
- Create `app/itinerary-core.js`: pure functions for Chinese labels, feasibility, timeline, scoring, and edits.
- Modify `app/index.html`: add v2 shell sections for conclusion, scenario controls, timeline, candidate details, and risks.
- Modify `app/app.js`: render v2 itinerary workspace instead of the raw table-first workflow.
- Modify `app/styles.css`: replace table-dominant layout with decision-workspace/timeline styling.
- Create `tests/itinerary_core.test.mjs`: unit tests for no-placeholder filtering, Chinese airport labels, feasibility, no-direct messaging, and scenario scoring.
- Create `tests/itinerary_app.test.mjs`: DOM-level tests for Chinese rendering, scenario switching, price edits, and missing direct warnings.
- Modify `tests/dashboard_app.test.mjs`: convert the old v1 app integration test into a v2 smoke wrapper so the full suite no longer expects the removed raw table-first UI.
- Modify `scripts/verify_dashboard.mjs`: verify v2 app strings and itinerary scoring.
- Modify `README.md`: update local Dashboard wording to describe v2 itinerary-result workflow.

---

### Task 1: V2 Data Model And Validation

**Files:**
- Create: `data/itinerary_scenarios.json`
- Create: `scripts/validate_itinerary_scenarios.mjs`
- Create: `tests/itinerary_validation.test.mjs`

**Interfaces:**
- Produces: `validateItineraryData(data): { ok: true, warnings: string[] }`
- Produces: `node scripts/validate_itinerary_scenarios.mjs data/itinerary_scenarios.json`
- Consumes: none.

- [ ] **Step 1: Write failing validation tests**

Create `tests/itinerary_validation.test.mjs`:

```js
import assert from "node:assert/strict";
import { validateItineraryData } from "../scripts/validate_itinerary_scenarios.mjs";

const valid = {
  metadata: {
    currency: "CNY",
    searched_at: "2026-07-29T20:00:00+08:00",
    note: "Only concrete search results are eligible for conclusions."
  },
  scenarios: [
    {
      id: "S3_SSH_DEP0929",
      label_zh: "9/29 出发 · 开罗 + 沙姆沙伊赫",
      departure_date: "2026-09-29",
      branch_id: "S3_SSH",
      required_segment_keys: ["bjs-cai-outbound", "cai-bjs-return"],
      selected_candidate_ids: ["flight-bjs-cai-a", "flight-cai-bjs-a"],
      selected_hotel_ids: [],
      selected_activity_ids: [],
      selected_ground_transport_ids: []
    }
  ],
  flight_candidates: [
    {
      id: "flight-bjs-cai-a",
      scenario_ids: ["S3_SSH_DEP0929"],
      segment_key: "bjs-cai-outbound",
      date: "2026-09-29",
      from_city_zh: "北京",
      to_city_zh: "开罗",
      origin_airport_zh: "北京首都/大兴",
      origin_airport_code: "BJS",
      destination_airport_zh: "开罗",
      destination_airport_code: "CAI",
      departure_time_local: "23:30",
      arrival_time_local: "05:20",
      arrival_date_offset: 1,
      airline_zh: "埃及航空",
      flight_numbers: ["MS956"],
      is_direct: true,
      direct_search_result: "found",
      stops_count: 0,
      stopover_summary_zh: "直飞",
      duration_minutes: 650,
      price_cny: 3100,
      checked_baggage_included: "unknown",
      source_platform: "携程",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "示例候选"
    },
    {
      id: "flight-cai-bjs-a",
      scenario_ids: ["S3_SSH_DEP0929"],
      segment_key: "cai-bjs-return",
      date: "2026-10-06",
      from_city_zh: "开罗",
      to_city_zh: "北京",
      origin_airport_zh: "开罗",
      origin_airport_code: "CAI",
      destination_airport_zh: "北京首都/大兴",
      destination_airport_code: "BJS",
      departure_time_local: "14:20",
      arrival_time_local: "13:10",
      arrival_date_offset: 1,
      airline_zh: "阿联酋航空",
      flight_numbers: ["EK924", "EK306"],
      is_direct: false,
      direct_search_result: "not_found",
      stops_count: 1,
      stopover_summary_zh: "迪拜中转 3小时10分；未找到直飞",
      duration_minutes: 1070,
      price_cny: 3600,
      checked_baggage_included: "unknown",
      source_platform: "携程",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "10/6 未找到直飞，计入中转候选"
    }
  ],
  missing_segments: [],
  hotels: [],
  activities: [],
  ground_transport: []
};

assert.deepEqual(validateItineraryData(valid), { ok: true, warnings: [] });

const placeholderCandidate = structuredClone(valid);
placeholderCandidate.flight_candidates[0].departure_time_local = "target";
assert.throws(
  () => validateItineraryData(placeholderCandidate),
  /flight-bjs-cai-a.*departure_time_local/
);

const missingRequired = structuredClone(valid);
delete missingRequired.flight_candidates[1].source_platform;
assert.throws(
  () => validateItineraryData(missingRequired),
  /flight-cai-bjs-a.*source_platform/
);

const missingSegment = structuredClone(valid);
missingSegment.scenarios[0].selected_candidate_ids = ["flight-bjs-cai-a"];
missingSegment.missing_segments = [
  {
    scenario_ids: ["S3_SSH_DEP0929"],
    segment_key: "cai-bjs-return",
    date: "2026-10-06",
    from_city_zh: "开罗",
    to_city_zh: "北京",
    status_zh: "待查询",
    reason_zh: "尚未录入具体候选"
  }
];
assert.deepEqual(validateItineraryData(missingSegment), {
  ok: true,
  warnings: ["Scenario S3_SSH_DEP0929 has missing required segment cai-bjs-return"]
});

console.log("itinerary_validation tests passed");
```

- [ ] **Step 2: Run validation test to verify it fails**

Run:

```bash
node tests/itinerary_validation.test.mjs
```

Expected: FAIL with module not found for `scripts/validate_itinerary_scenarios.mjs`.

- [ ] **Step 3: Implement validator**

Create `scripts/validate_itinerary_scenarios.mjs`:

```js
import fs from "node:fs";

const requiredRootArrays = [
  "scenarios",
  "flight_candidates",
  "missing_segments",
  "hotels",
  "activities",
  "ground_transport"
];

const requiredFlightFields = [
  "id",
  "scenario_ids",
  "segment_key",
  "date",
  "from_city_zh",
  "to_city_zh",
  "origin_airport_zh",
  "origin_airport_code",
  "destination_airport_zh",
  "destination_airport_code",
  "departure_time_local",
  "arrival_time_local",
  "arrival_date_offset",
  "airline_zh",
  "flight_numbers",
  "is_direct",
  "direct_search_result",
  "stops_count",
  "stopover_summary_zh",
  "duration_minutes",
  "price_cny",
  "checked_baggage_included",
  "source_platform",
  "source_url",
  "searched_at",
  "confidence_level",
  "notes_zh"
];

const placeholderPattern = /target|placeholder|direct or one-stop|TBD|待定/i;

function assertPresent(object, field, context) {
  if (object[field] === undefined || object[field] === null || object[field] === "") {
    throw new Error(`${context} missing ${field}`);
  }
}

function assertNoPlaceholder(value, field, context) {
  if (placeholderPattern.test(String(value))) {
    throw new Error(`${context} has placeholder ${field}: ${value}`);
  }
}

export function validateItineraryData(data) {
  if (!data.metadata || data.metadata.currency !== "CNY") {
    throw new Error("metadata.currency must be CNY");
  }
  for (const field of requiredRootArrays) {
    if (!Array.isArray(data[field])) throw new Error(`${field} must be an array`);
  }

  for (const candidate of data.flight_candidates) {
    for (const field of requiredFlightFields) {
      assertPresent(candidate, field, candidate.id || "flight candidate");
      if (typeof candidate[field] === "string") assertNoPlaceholder(candidate[field], field, candidate.id);
    }
    if (!Array.isArray(candidate.scenario_ids) || candidate.scenario_ids.length === 0) {
      throw new Error(`${candidate.id} scenario_ids must be non-empty`);
    }
    if (!Array.isArray(candidate.flight_numbers)) {
      throw new Error(`${candidate.id} flight_numbers must be an array`);
    }
    if (!["found", "not_found", "not_checked"].includes(candidate.direct_search_result)) {
      throw new Error(`${candidate.id} direct_search_result invalid`);
    }
    if (candidate.is_direct && candidate.stops_count !== 0) {
      throw new Error(`${candidate.id} direct flight cannot have stops`);
    }
    if (candidate.price_cny <= 0 || candidate.duration_minutes <= 0) {
      throw new Error(`${candidate.id} price_cny and duration_minutes must be positive`);
    }
  }

  const candidateIds = new Set(data.flight_candidates.map((candidate) => candidate.id));
  const missingByScenarioAndSegment = new Set(
    data.missing_segments.flatMap((segment) =>
      segment.scenario_ids.map((scenarioId) => `${scenarioId}:${segment.segment_key}`)
    )
  );
  const warnings = [];

  for (const scenario of data.scenarios) {
    for (const field of ["id", "label_zh", "departure_date", "branch_id", "required_segment_keys", "selected_candidate_ids"]) {
      assertPresent(scenario, field, scenario.id || "scenario");
    }
    const selectedSegmentKeys = new Set();
    for (const candidateId of scenario.selected_candidate_ids) {
      if (!candidateIds.has(candidateId)) throw new Error(`${scenario.id} selected missing candidate ${candidateId}`);
      const candidate = data.flight_candidates.find((item) => item.id === candidateId);
      selectedSegmentKeys.add(candidate.segment_key);
    }
    for (const segmentKey of scenario.required_segment_keys) {
      if (!selectedSegmentKeys.has(segmentKey)) {
        const missingKey = `${scenario.id}:${segmentKey}`;
        if (!missingByScenarioAndSegment.has(missingKey)) {
          throw new Error(`${scenario.id} missing required segment ${segmentKey} without missing_segments record`);
        }
        warnings.push(`Scenario ${scenario.id} has missing required segment ${segmentKey}`);
      }
    }
  }

  return { ok: true, warnings };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const inputPath = process.argv[2];
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(JSON.stringify(validateItineraryData(data), null, 2));
}
```

- [ ] **Step 4: Seed v2 data with only explicit actual/missing records**

Create `data/itinerary_scenarios.json` with:

```json
{
  "metadata": {
    "currency": "CNY",
    "searched_at": "2026-07-29T20:00:00+08:00",
    "note": "Only concrete search results are eligible for conclusions. Missing segments are shown as 待查询 and excluded from recommendation scoring."
  },
  "scenarios": [
    {
      "id": "S3_SSH_DEP0929",
      "label_zh": "9/29 出发 · 开罗 + 沙姆沙伊赫",
      "departure_date": "2026-09-29",
      "branch_id": "S3_SSH",
      "required_segment_keys": ["bjs-lhw", "lhw-cgq", "cgq-bjs", "bjs-cai-outbound", "cai-bjs-return", "cai-ssh", "ssh-cai"],
      "selected_candidate_ids": [],
      "selected_hotel_ids": [],
      "selected_activity_ids": [],
      "selected_ground_transport_ids": []
    },
    {
      "id": "S3_HRG_DEP0929",
      "label_zh": "9/29 出发 · 开罗 + 卢克索 + 赫尔格达",
      "departure_date": "2026-09-29",
      "branch_id": "S3_HRG",
      "required_segment_keys": ["bjs-lhw", "lhw-cgq", "cgq-bjs", "bjs-cai-outbound", "cai-bjs-return", "cai-lxr", "lxr-hrg", "hrg-cai"],
      "selected_candidate_ids": [],
      "selected_hotel_ids": [],
      "selected_activity_ids": [],
      "selected_ground_transport_ids": []
    },
    {
      "id": "S3_SSH_DEP0930",
      "label_zh": "9/30 出发 · 开罗 + 沙姆沙伊赫",
      "departure_date": "2026-09-30",
      "branch_id": "S3_SSH",
      "required_segment_keys": ["bjs-lhw", "lhw-cgq", "cgq-bjs", "bjs-cai-outbound", "cai-bjs-return", "cai-ssh", "ssh-cai"],
      "selected_candidate_ids": [],
      "selected_hotel_ids": [],
      "selected_activity_ids": [],
      "selected_ground_transport_ids": []
    },
    {
      "id": "S3_HRG_DEP0930",
      "label_zh": "9/30 出发 · 开罗 + 卢克索 + 赫尔格达",
      "departure_date": "2026-09-30",
      "branch_id": "S3_HRG",
      "required_segment_keys": ["bjs-lhw", "lhw-cgq", "cgq-bjs", "bjs-cai-outbound", "cai-bjs-return", "cai-lxr", "lxr-hrg", "hrg-cai"],
      "selected_candidate_ids": [],
      "selected_hotel_ids": [],
      "selected_activity_ids": [],
      "selected_ground_transport_ids": []
    }
  ],
  "flight_candidates": [],
  "missing_segments": [
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_HRG_DEP0929", "S3_SSH_DEP0930", "S3_HRG_DEP0930"],
      "segment_key": "bjs-lhw",
      "date": "2026-09-24",
      "from_city_zh": "北京",
      "to_city_zh": "兰州",
      "status_zh": "待查询",
      "reason_zh": "尚未录入 9/24 晚北京到兰州的具体航班候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_HRG_DEP0929", "S3_SSH_DEP0930", "S3_HRG_DEP0930"],
      "segment_key": "lhw-cgq",
      "date": "2026-09-27",
      "from_city_zh": "兰州",
      "to_city_zh": "长春",
      "status_zh": "待查询",
      "reason_zh": "尚未录入 9/27 早兰州到长春的具体航班候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_HRG_DEP0929", "S3_SSH_DEP0930", "S3_HRG_DEP0930"],
      "segment_key": "cgq-bjs",
      "date": "2026-09-28",
      "from_city_zh": "长春",
      "to_city_zh": "北京",
      "status_zh": "待查询",
      "reason_zh": "尚未录入 9/28 长春回北京的具体航班候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_HRG_DEP0929"],
      "segment_key": "bjs-cai-outbound",
      "date": "2026-09-29",
      "from_city_zh": "北京",
      "to_city_zh": "开罗",
      "status_zh": "待查询",
      "reason_zh": "尚未录入 9/29 北京到开罗的具体航班候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0930", "S3_HRG_DEP0930"],
      "segment_key": "bjs-cai-outbound",
      "date": "2026-09-30",
      "from_city_zh": "北京",
      "to_city_zh": "开罗",
      "status_zh": "待查询",
      "reason_zh": "尚未录入 9/30 北京到开罗的具体航班候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_HRG_DEP0929", "S3_SSH_DEP0930", "S3_HRG_DEP0930"],
      "segment_key": "cai-bjs-return",
      "date": "2026-10-06",
      "from_city_zh": "开罗",
      "to_city_zh": "北京",
      "status_zh": "待查询",
      "reason_zh": "用户已查到 10/6 无直飞；仍需录入具体中转候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_SSH_DEP0930"],
      "segment_key": "cai-ssh",
      "date": "2026-10-02",
      "from_city_zh": "开罗",
      "to_city_zh": "沙姆沙伊赫",
      "status_zh": "待查询",
      "reason_zh": "尚未录入具体航班候选"
    },
    {
      "scenario_ids": ["S3_SSH_DEP0929", "S3_SSH_DEP0930"],
      "segment_key": "ssh-cai",
      "date": "2026-10-05",
      "from_city_zh": "沙姆沙伊赫",
      "to_city_zh": "开罗",
      "status_zh": "待查询",
      "reason_zh": "尚未录入具体航班候选"
    },
    {
      "scenario_ids": ["S3_HRG_DEP0929", "S3_HRG_DEP0930"],
      "segment_key": "cai-lxr",
      "date": "2026-10-01",
      "from_city_zh": "开罗",
      "to_city_zh": "卢克索",
      "status_zh": "待查询",
      "reason_zh": "尚未录入具体航班候选"
    },
    {
      "scenario_ids": ["S3_HRG_DEP0929", "S3_HRG_DEP0930"],
      "segment_key": "lxr-hrg",
      "date": "2026-10-03",
      "from_city_zh": "卢克索",
      "to_city_zh": "赫尔格达",
      "status_zh": "待查询",
      "reason_zh": "尚未录入卢克索到赫尔格达的具体包车或交通候选"
    },
    {
      "scenario_ids": ["S3_HRG_DEP0929", "S3_HRG_DEP0930"],
      "segment_key": "hrg-cai",
      "date": "2026-10-05",
      "from_city_zh": "赫尔格达",
      "to_city_zh": "开罗",
      "status_zh": "待查询",
      "reason_zh": "尚未录入具体航班候选"
    }
  ],
  "hotels": [],
  "activities": [],
  "ground_transport": []
}
```

- [ ] **Step 5: Run validation test and script**

Run:

```bash
node tests/itinerary_validation.test.mjs
node scripts/validate_itinerary_scenarios.mjs data/itinerary_scenarios.json
```

Expected:

```text
itinerary_validation tests passed
```

The validator script should print `ok: true` with warnings for missing international/Egypt segments.

---

### Task 2: Build Script And Browser Data

**Files:**
- Create: `scripts/build_itinerary_data.mjs`
- Create: `app/itinerary-data.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: `validateItineraryData(data)` from `scripts/validate_itinerary_scenarios.mjs`
- Produces: `app/itinerary-data.js` with `window.ITINERARY_DATA = <json>;`

- [ ] **Step 1: Write failing generated-data test**

Create `tests/itinerary_build.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

execFileSync("node", ["scripts/build_itinerary_data.mjs"], { stdio: "pipe" });
const generated = fs.readFileSync("app/itinerary-data.js", "utf8");
assert.ok(generated.startsWith("window.ITINERARY_DATA = "));
assert.match(generated, /S3_SSH_DEP0929/);
assert.match(generated, /待查询/);

console.log("itinerary_build tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node tests/itinerary_build.test.mjs
```

Expected: FAIL with module not found for `scripts/build_itinerary_data.mjs`.

- [ ] **Step 3: Implement build script**

Create `scripts/build_itinerary_data.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateItineraryData } from "./validate_itinerary_scenarios.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const inputPath = path.join(rootDir, "data", "itinerary_scenarios.json");
const outputDir = path.join(rootDir, "app");
const outputPath = path.join(outputDir, "itinerary-data.js");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateItineraryData(data);

const generated = `window.ITINERARY_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, generated);
console.log(`Wrote ${outputPath}`);
```

- [ ] **Step 4: Load v2 data before app module**

Modify `app/index.html` script tags:

```html
<script src="./live-price-data.js"></script>
<script src="./itinerary-data.js"></script>
<script type="module" src="./app.js"></script>
```

- [ ] **Step 5: Run build test**

Run:

```bash
node tests/itinerary_build.test.mjs
```

Expected:

```text
itinerary_build tests passed
```

---

### Task 3: Itinerary Core Functions

**Files:**
- Create: `app/itinerary-core.js`
- Create: `tests/itinerary_core.test.mjs`

**Interfaces:**
- Produces: `getAirportLabel(candidate, side): string`
- Produces: `getFlightRouteLabel(candidate): string`
- Produces: `getDirectLabel(candidate): string`
- Produces: `summarizeScenarios(data): ScenarioSummary[]`
- Produces: `scoreFeasibleScenarios(summaries): ScenarioSummary[]`
- Produces: `setCandidatePrice(data, candidateId, price): object`
- Produces: `createItineraryExportPayload(data): string`

- [ ] **Step 1: Write failing core tests**

Create `tests/itinerary_core.test.mjs`:

```js
import assert from "node:assert/strict";
import {
  getAirportLabel,
  getFlightRouteLabel,
  getDirectLabel,
  summarizeScenarios,
  scoreFeasibleScenarios,
  setCandidatePrice,
  createItineraryExportPayload
} from "../app/itinerary-core.js";

const data = {
  metadata: { currency: "CNY" },
  scenarios: [
    {
      id: "S3_SSH_DEP0929",
      label_zh: "9/29 出发 · 沙姆沙伊赫",
      departure_date: "2026-09-29",
      branch_id: "S3_SSH",
      required_segment_keys: ["out", "return"],
      selected_candidate_ids: ["out-a", "return-a"],
      selected_hotel_ids: [],
      selected_activity_ids: [],
      selected_ground_transport_ids: []
    },
    {
      id: "S3_HRG_DEP0930",
      label_zh: "9/30 出发 · 赫尔格达",
      departure_date: "2026-09-30",
      branch_id: "S3_HRG",
      required_segment_keys: ["out", "return"],
      selected_candidate_ids: ["out-b"],
      selected_hotel_ids: [],
      selected_activity_ids: [],
      selected_ground_transport_ids: []
    }
  ],
  flight_candidates: [
    {
      id: "out-a",
      scenario_ids: ["S3_SSH_DEP0929"],
      segment_key: "out",
      date: "2026-09-29",
      from_city_zh: "北京",
      to_city_zh: "开罗",
      origin_airport_zh: "北京首都/大兴",
      origin_airport_code: "BJS",
      destination_airport_zh: "开罗",
      destination_airport_code: "CAI",
      departure_time_local: "23:30",
      arrival_time_local: "05:20",
      arrival_date_offset: 1,
      airline_zh: "埃及航空",
      flight_numbers: ["MS956"],
      is_direct: true,
      direct_search_result: "found",
      stops_count: 0,
      stopover_summary_zh: "直飞",
      duration_minutes: 650,
      price_cny: 3000,
      checked_baggage_included: "unknown",
      source_platform: "携程",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "示例"
    },
    {
      id: "return-a",
      scenario_ids: ["S3_SSH_DEP0929"],
      segment_key: "return",
      date: "2026-10-06",
      from_city_zh: "开罗",
      to_city_zh: "北京",
      origin_airport_zh: "开罗",
      origin_airport_code: "CAI",
      destination_airport_zh: "北京首都/大兴",
      destination_airport_code: "BJS",
      departure_time_local: "14:20",
      arrival_time_local: "13:10",
      arrival_date_offset: 1,
      airline_zh: "阿联酋航空",
      flight_numbers: ["EK924", "EK306"],
      is_direct: false,
      direct_search_result: "not_found",
      stops_count: 1,
      stopover_summary_zh: "迪拜中转 3小时10分；未找到直飞",
      duration_minutes: 1070,
      price_cny: 3600,
      checked_baggage_included: "unknown",
      source_platform: "携程",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "示例"
    },
    {
      id: "out-b",
      scenario_ids: ["S3_HRG_DEP0930"],
      segment_key: "out",
      date: "2026-09-30",
      from_city_zh: "北京",
      to_city_zh: "开罗",
      origin_airport_zh: "北京首都/大兴",
      origin_airport_code: "BJS",
      destination_airport_zh: "开罗",
      destination_airport_code: "CAI",
      departure_time_local: "20:00",
      arrival_time_local: "08:00",
      arrival_date_offset: 1,
      airline_zh: "卡塔尔航空",
      flight_numbers: ["QR893", "QR1303"],
      is_direct: false,
      direct_search_result: "not_checked",
      stops_count: 1,
      stopover_summary_zh: "多哈中转",
      duration_minutes: 960,
      price_cny: 2800,
      checked_baggage_included: "unknown",
      source_platform: "去哪儿",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "示例"
    }
  ],
  missing_segments: [
    {
      scenario_ids: ["S3_HRG_DEP0930"],
      segment_key: "return",
      date: "2026-10-06",
      from_city_zh: "开罗",
      to_city_zh: "北京",
      status_zh: "待查询",
      reason_zh: "尚未录入具体中转候选"
    }
  ],
  hotels: [],
  activities: [],
  ground_transport: []
};

assert.equal(getAirportLabel(data.flight_candidates[0], "origin"), "北京首都/大兴 BJS");
assert.equal(getFlightRouteLabel(data.flight_candidates[0]), "北京 → 开罗");
assert.equal(getDirectLabel(data.flight_candidates[0]), "直飞");
assert.equal(getDirectLabel(data.flight_candidates[1]), "未找到直飞 · 1 次中转");

const summaries = summarizeScenarios(data);
const feasible = summaries.find((summary) => summary.id === "S3_SSH_DEP0929");
const missing = summaries.find((summary) => summary.id === "S3_HRG_DEP0930");
assert.equal(feasible.is_feasible, true);
assert.equal(feasible.total_flight_cny, 6600);
assert.equal(feasible.total_travel_minutes, 1720);
assert.deepEqual(feasible.no_direct_segment_keys, ["return"]);
assert.equal(missing.is_feasible, false);
assert.deepEqual(missing.missing_segment_keys, ["return"]);

const scored = scoreFeasibleScenarios(summaries);
assert.equal(scored[0].id, "S3_SSH_DEP0929");
assert.equal(scored[0].total_score, 100);
assert.equal(scored.find((summary) => summary.id === "S3_HRG_DEP0930").total_score, null);

const edited = setCandidatePrice(data, "return-a", 4200);
assert.equal(edited.flight_candidates.find((candidate) => candidate.id === "return-a").price_cny, 4200);
assert.equal(data.flight_candidates.find((candidate) => candidate.id === "return-a").price_cny, 3600);

const exported = JSON.parse(createItineraryExportPayload(edited));
assert.equal(exported.metadata.currency, "CNY");

console.log("itinerary_core tests passed");
```

- [ ] **Step 2: Run core test to verify it fails**

Run:

```bash
node tests/itinerary_core.test.mjs
```

Expected: FAIL with module not found for `app/itinerary-core.js`.

- [ ] **Step 3: Implement core module**

Create `app/itinerary-core.js`:

```js
function round1(value) {
  return Number(value.toFixed(1));
}

function scoreRatio(best, current) {
  if (!current || !best) return 0;
  return best / current * 100;
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

export function getAirportLabel(candidate, side) {
  if (side === "origin") return `${candidate.origin_airport_zh} ${candidate.origin_airport_code}`;
  return `${candidate.destination_airport_zh} ${candidate.destination_airport_code}`;
}

export function getFlightRouteLabel(candidate) {
  return `${candidate.from_city_zh} → ${candidate.to_city_zh}`;
}

export function getDirectLabel(candidate) {
  if (candidate.is_direct) return "直飞";
  const stopText = `${candidate.stops_count} 次中转`;
  if (candidate.direct_search_result === "not_found") return `未找到直飞 · ${stopText}`;
  return stopText;
}

export function summarizeScenarios(data) {
  const flightById = byId(data.flight_candidates);
  return data.scenarios.map((scenario) => {
    const selectedFlights = scenario.selected_candidate_ids.map((id) => flightById.get(id)).filter(Boolean);
    const selectedSegmentKeys = new Set(selectedFlights.map((flight) => flight.segment_key));
    const missingRecords = data.missing_segments.filter((segment) => segment.scenario_ids.includes(scenario.id));
    const missingSegmentKeys = scenario.required_segment_keys.filter((segmentKey) => !selectedSegmentKeys.has(segmentKey));
    const missingWithRecords = missingSegmentKeys.filter((segmentKey) =>
      missingRecords.some((record) => record.segment_key === segmentKey)
    );
    const isFeasible = missingSegmentKeys.length === 0;
    return {
      ...scenario,
      is_feasible: isFeasible,
      selected_flights: selectedFlights,
      missing_segments: missingRecords.filter((record) => missingSegmentKeys.includes(record.segment_key)),
      missing_segment_keys: missingWithRecords,
      no_direct_segment_keys: selectedFlights
        .filter((flight) => flight.direct_search_result === "not_found")
        .map((flight) => flight.segment_key),
      total_flight_cny: sum(selectedFlights, "price_cny"),
      total_hotel_cny: 0,
      total_activity_cny: 0,
      total_ground_transport_cny: 0,
      total_trip_cny: sum(selectedFlights, "price_cny"),
      total_trip_cny_per_person: Math.round(sum(selectedFlights, "price_cny") / 2),
      total_travel_minutes: sum(selectedFlights, "duration_minutes"),
      price_score: null,
      time_score: null,
      total_score: null
    };
  });
}

export function scoreFeasibleScenarios(summaries) {
  const feasible = summaries.filter((summary) => summary.is_feasible && summary.total_trip_cny > 0 && summary.total_travel_minutes > 0);
  const minPrice = feasible.length ? Math.min(...feasible.map((summary) => summary.total_trip_cny)) : 0;
  const minTime = feasible.length ? Math.min(...feasible.map((summary) => summary.total_travel_minutes)) : 0;
  return summaries.map((summary) => {
    if (!summary.is_feasible) return summary;
    const priceScore = scoreRatio(minPrice, summary.total_trip_cny);
    const timeScore = scoreRatio(minTime, summary.total_travel_minutes);
    return {
      ...summary,
      price_score: round1(priceScore),
      time_score: round1(timeScore),
      total_score: round1(priceScore * 0.5 + timeScore * 0.5)
    };
  }).sort((a, b) => {
    if (a.total_score === null) return 1;
    if (b.total_score === null) return -1;
    return b.total_score - a.total_score;
  });
}

export function setCandidatePrice(data, candidateId, price) {
  const next = structuredClone(data);
  const candidate = next.flight_candidates.find((item) => item.id === candidateId);
  if (candidate) candidate.price_cny = Number(price) || 0;
  return next;
}

export function createItineraryExportPayload(data) {
  return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 4: Run core test**

Run:

```bash
node tests/itinerary_core.test.mjs
```

Expected:

```text
itinerary_core tests passed
```

---

### Task 4: Chinese Itinerary UI

**Files:**
- Modify: `app/index.html`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Create: `tests/itinerary_app.test.mjs`
- Modify: `tests/dashboard_app.test.mjs`

**Interfaces:**
- Consumes: `window.ITINERARY_DATA`
- Consumes: `summarizeScenarios`, `scoreFeasibleScenarios`, `getAirportLabel`, `getFlightRouteLabel`, `getDirectLabel`, `setCandidatePrice`, `createItineraryExportPayload` from `app/itinerary-core.js`
- Produces: Chinese scenario controls, conclusion card, itinerary timeline, risk list, editable candidate prices.

- [ ] **Step 1: Write failing app test**

Create `tests/itinerary_app.test.mjs`:

```js
import assert from "node:assert/strict";

class FakeClassList {
  constructor(classes = "") {
    this.classes = new Set(classes.split(/\s+/).filter(Boolean));
  }

  contains(name) {
    return this.classes.has(name);
  }
}

class FakeElement {
  constructor(selector) {
    this.selector = selector;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.listeners = {};
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  querySelector() {
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map([
      ["#summary", new FakeElement("#summary")],
      ["#price-note", new FakeElement("#price-note")],
      ["#tab-buttons", new FakeElement("#tab-buttons")],
      ["#branch-filter", new FakeElement("#branch-filter")],
      ["#selected-filter", new FakeElement("#selected-filter")],
      ["#detail-table", new FakeElement("#detail-table")],
      ["#risk-list", new FakeElement("#risk-list")],
      ["#export-json", new FakeElement("#export-json")],
      ["#scenario-controls", new FakeElement("#scenario-controls")],
      ["#itinerary-timeline", new FakeElement("#itinerary-timeline")],
      ["#candidate-panel", new FakeElement("#candidate-panel")]
    ]);
  }

  querySelector(selector) {
    return this.elements.get(selector);
  }

  createElement() {
    return new FakeElement("created");
  }
}

const itineraryData = {
  metadata: { currency: "CNY", searched_at: "2026-07-29T20:00:00+08:00" },
  scenarios: [
    {
      id: "S3_SSH_DEP0929",
      label_zh: "9/29 出发 · 开罗 + 沙姆沙伊赫",
      departure_date: "2026-09-29",
      branch_id: "S3_SSH",
      required_segment_keys: ["out", "return"],
      selected_candidate_ids: ["out-a", "return-a"],
      selected_hotel_ids: [],
      selected_activity_ids: [],
      selected_ground_transport_ids: []
    },
    {
      id: "S3_SSH_DEP0930",
      label_zh: "9/30 出发 · 开罗 + 沙姆沙伊赫",
      departure_date: "2026-09-30",
      branch_id: "S3_SSH",
      required_segment_keys: ["out", "return"],
      selected_candidate_ids: ["out-b"],
      selected_hotel_ids: [],
      selected_activity_ids: [],
      selected_ground_transport_ids: []
    }
  ],
  flight_candidates: [
    {
      id: "out-a",
      scenario_ids: ["S3_SSH_DEP0929"],
      segment_key: "out",
      date: "2026-09-29",
      from_city_zh: "北京",
      to_city_zh: "开罗",
      origin_airport_zh: "北京首都/大兴",
      origin_airport_code: "BJS",
      destination_airport_zh: "开罗",
      destination_airport_code: "CAI",
      departure_time_local: "23:30",
      arrival_time_local: "05:20",
      arrival_date_offset: 1,
      airline_zh: "埃及航空",
      flight_numbers: ["MS956"],
      is_direct: true,
      direct_search_result: "found",
      stops_count: 0,
      stopover_summary_zh: "直飞",
      duration_minutes: 650,
      price_cny: 3000,
      checked_baggage_included: "unknown",
      source_platform: "携程",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "示例"
    },
    {
      id: "return-a",
      scenario_ids: ["S3_SSH_DEP0929"],
      segment_key: "return",
      date: "2026-10-06",
      from_city_zh: "开罗",
      to_city_zh: "北京",
      origin_airport_zh: "开罗",
      origin_airport_code: "CAI",
      destination_airport_zh: "北京首都/大兴",
      destination_airport_code: "BJS",
      departure_time_local: "14:20",
      arrival_time_local: "13:10",
      arrival_date_offset: 1,
      airline_zh: "阿联酋航空",
      flight_numbers: ["EK924", "EK306"],
      is_direct: false,
      direct_search_result: "not_found",
      stops_count: 1,
      stopover_summary_zh: "迪拜中转 3小时10分；未找到直飞",
      duration_minutes: 1070,
      price_cny: 3600,
      checked_baggage_included: "unknown",
      source_platform: "携程",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "10/6 未找到直飞"
    },
    {
      id: "out-b",
      scenario_ids: ["S3_SSH_DEP0930"],
      segment_key: "out",
      date: "2026-09-30",
      from_city_zh: "北京",
      to_city_zh: "开罗",
      origin_airport_zh: "北京首都/大兴",
      origin_airport_code: "BJS",
      destination_airport_zh: "开罗",
      destination_airport_code: "CAI",
      departure_time_local: "20:00",
      arrival_time_local: "08:00",
      arrival_date_offset: 1,
      airline_zh: "卡塔尔航空",
      flight_numbers: ["QR893", "QR1303"],
      is_direct: false,
      direct_search_result: "not_checked",
      stops_count: 1,
      stopover_summary_zh: "多哈中转",
      duration_minutes: 960,
      price_cny: 2800,
      checked_baggage_included: "unknown",
      source_platform: "去哪儿",
      source_url: "https://example.com",
      searched_at: "2026-07-29T20:00:00+08:00",
      confidence_level: "medium",
      notes_zh: "示例"
    }
  ],
  missing_segments: [
    {
      scenario_ids: ["S3_SSH_DEP0930"],
      segment_key: "return",
      date: "2026-10-06",
      from_city_zh: "开罗",
      to_city_zh: "北京",
      status_zh: "待查询",
      reason_zh: "尚未录入具体中转候选"
    }
  ],
  hotels: [],
  activities: [],
  ground_transport: []
};

const document = new FakeDocument();
globalThis.document = document;
globalThis.window = { ITINERARY_DATA: itineraryData, LIVE_PRICE_DATA: { metadata: {}, branches: [], flights: [], hotels: [], activities: [], ground_transport: [] } };
globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
globalThis.Blob = class {};
globalThis.URL = {
  createObjectURL() {
    return "blob:test";
  },
  revokeObjectURL() {}
};

await import("../app/app.js");

const summary = document.querySelector("#summary");
const controls = document.querySelector("#scenario-controls");
const timeline = document.querySelector("#itinerary-timeline");
const candidatePanel = document.querySelector("#candidate-panel");
const risks = document.querySelector("#risk-list");

assert.match(summary.innerHTML, /当前推荐/);
assert.match(summary.innerHTML, /9\/29 出发/);
assert.match(controls.innerHTML, /9\/30 出发/);
assert.match(timeline.innerHTML, /北京 → 开罗/);
assert.match(timeline.innerHTML, /北京首都\/大兴 BJS/);
assert.match(timeline.innerHTML, /23:30/);
assert.match(timeline.innerHTML, /未找到直飞/);
assert.match(candidatePanel.innerHTML, /携程/);
assert.match(risks.innerHTML, /10\/6/);

const scenarioButton = {
  dataset: { scenarioId: "S3_SSH_DEP0930" },
  closest() {
    return this;
  }
};
controls.listeners.click({ target: scenarioButton });
assert.match(timeline.innerHTML, /待查询/);
assert.match(summary.innerHTML, /不可评分/);

const editedRow = { dataset: { candidateId: "out-b" } };
const priceInput = {
  value: "3300",
  classList: new FakeClassList("itinerary-price-input"),
  closest() {
    return editedRow;
  }
};
candidatePanel.listeners.input({ target: priceInput });
assert.match(candidatePanel.innerHTML, /3300/);

console.log("itinerary_app tests passed");
```

- [ ] **Step 2: Run app test to verify it fails**

Run:

```bash
node tests/itinerary_app.test.mjs
```

Expected: FAIL because `app/app.js` does not render v2 sections.

- [ ] **Step 3: Update HTML shell**

Modify `app/index.html` inside `<main>` to include:

```html
<section class="toolbar scenario-toolbar" id="scenario-controls" aria-label="情景切换"></section>
<section id="summary" class="summary-grid" aria-label="方案总价对比"></section>
<section class="itinerary-layout">
  <section class="panel timeline-panel">
    <h2>中文行程日</h2>
    <div id="itinerary-timeline" class="timeline"></div>
  </section>
  <section class="panel candidate-panel">
    <h2>当前候选</h2>
    <div id="candidate-panel"></div>
  </section>
</section>
<section class="panel">
  <h2>风险与待查</h2>
  <ul id="risk-list" class="risk-list"></ul>
</section>
```

Keep the export button.

- [ ] **Step 4: Update app.js imports and state**

Replace the old `dashboard-core.js` imports in `app/app.js` with:

```js
import {
  getAirportLabel,
  getFlightRouteLabel,
  getDirectLabel,
  summarizeScenarios,
  scoreFeasibleScenarios,
  setCandidatePrice,
  createItineraryExportPayload
} from "./itinerary-core.js";
```

Set state:

```js
const state = {
  data: structuredClone(window.ITINERARY_DATA),
  activeScenarioId: window.ITINERARY_DATA.scenarios[0].id
};
```

- [ ] **Step 5: Implement v2 render functions**

In `app/app.js`, implement these functions:

```js
function activeSummary() {
  return scoreFeasibleScenarios(summarizeScenarios(state.data))
    .find((summary) => summary.id === state.activeScenarioId);
}

function renderScenarioControls() {
  scenarioControlsEl.innerHTML = state.data.scenarios.map((scenario) => `
    <button type="button" class="${scenario.id === state.activeScenarioId ? "active" : ""}" data-scenario-id="${escapeHtml(scenario.id)}">
      ${escapeHtml(scenario.label_zh)}
    </button>
  `).join("");
}

function renderConclusion() {
  const summaries = scoreFeasibleScenarios(summarizeScenarios(state.data));
  const active = activeSummary();
  const best = summaries.find((summary) => summary.is_feasible);
  const status = active.is_feasible ? `综合分 ${active.total_score}` : "不可评分：仍有必需段待查询";
  summaryEl.innerHTML = `
    <article class="summary-card is-best">
      <div class="summary-head">
        <p class="summary-title">${escapeHtml(active.label_zh)}</p>
        <span class="badge ${active.is_feasible ? "" : "danger"}">${escapeHtml(status)}</span>
      </div>
      <p class="muted">${best ? `当前推荐：${escapeHtml(best.label_zh)}` : "当前没有完整可评分情景。"}</p>
      <div class="metric-grid">
        <div class="metric"><span>总价</span><strong>${money(active.total_trip_cny)}</strong></div>
        <div class="metric"><span>人均</span><strong>${money(active.total_trip_cny_per_person)}</strong></div>
        <div class="metric"><span>移动时间</span><strong>${hours(active.total_travel_minutes)}</strong></div>
        <div class="metric"><span>待查段</span><strong>${active.missing_segment_keys.length}</strong></div>
      </div>
    </article>
  `;
}

function renderTimeline() {
  const active = activeSummary();
  const flightRows = active.selected_flights.map((flight) => `
    <article class="timeline-item">
      <div class="timeline-date">${escapeHtml(formatDateZh(flight.date))}</div>
      <div>
        <h3>${escapeHtml(getFlightRouteLabel(flight))}</h3>
        <p class="muted">${escapeHtml(getAirportLabel(flight, "origin"))} → ${escapeHtml(getAirportLabel(flight, "destination"))}</p>
        <p>${escapeHtml(flight.departure_time_local)} - ${escapeHtml(flight.arrival_time_local)} · ${escapeHtml(getDirectLabel(flight))} · ${escapeHtml(hours(flight.duration_minutes))}</p>
        <p class="muted">${escapeHtml(flight.airline_zh)} ${escapeHtml(flight.flight_numbers.join(" / "))} · ${escapeHtml(flight.stopover_summary_zh)}</p>
      </div>
      <strong>${money(flight.price_cny)}</strong>
    </article>
  `).join("");
  const missingRows = active.missing_segments.map((segment) => `
    <article class="timeline-item missing">
      <div class="timeline-date">${escapeHtml(formatDateZh(segment.date))}</div>
      <div>
        <h3>${escapeHtml(segment.from_city_zh)} → ${escapeHtml(segment.to_city_zh)}</h3>
        <p class="badge danger">待查询</p>
        <p class="muted">${escapeHtml(segment.reason_zh)}</p>
      </div>
    </article>
  `).join("");
  itineraryTimelineEl.innerHTML = flightRows + missingRows;
}

function renderCandidates() {
  const active = activeSummary();
  candidatePanelEl.innerHTML = active.selected_flights.map((flight) => `
    <article class="candidate-row" data-candidate-id="${escapeHtml(flight.id)}">
      <div>
        <strong>${escapeHtml(getFlightRouteLabel(flight))}</strong>
        <p class="muted">${escapeHtml(flight.source_platform)} · ${escapeHtml(flight.searched_at)}</p>
      </div>
      <input class="itinerary-price-input" type="number" min="0" step="1" value="${flight.price_cny}">
      ${safeUrl(flight.source_url) ? `<a href="${escapeHtml(safeUrl(flight.source_url))}" target="_blank" rel="noreferrer">打开来源</a>` : ""}
    </article>
  `).join("");
}
```

Define `formatDateZh(date)` as:

```js
function formatDateZh(date) {
  const [year, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}
```

- [ ] **Step 6: Wire events**

Add:

```js
scenarioControlsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-scenario-id]");
  if (!button) return;
  state.activeScenarioId = button.dataset.scenarioId;
  render();
});

candidatePanelEl.addEventListener("input", (event) => {
  const row = event.target.closest("[data-candidate-id]");
  if (!row) return;
  if (!event.target.classList.contains("itinerary-price-input")) return;
  state.data = setCandidatePrice(state.data, row.dataset.candidateId, event.target.value);
  renderConclusion();
  renderTimeline();
  renderCandidates();
  renderRisks();
});
```

Update export button to use `createItineraryExportPayload(state.data)`.

- [ ] **Step 7: Update CSS**

Add:

```css
.scenario-toolbar button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.itinerary-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
  gap: 14px;
}
.timeline {
  display: grid;
  gap: 10px;
}
.timeline-item,
.candidate-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.timeline-item.missing {
  border-color: var(--danger);
  background: var(--danger-bg);
}
.timeline-date {
  color: var(--muted);
  font-weight: 700;
}
.candidate-row {
  grid-template-columns: minmax(0, 1fr) 110px auto;
}
.itinerary-price-input {
  width: 110px;
  padding: 6px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
@media (max-width: 980px) {
  .itinerary-layout { grid-template-columns: 1fr; }
  .timeline-item,
  .candidate-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 8: Run app test**

Replace `tests/dashboard_app.test.mjs` with a compatibility smoke test that imports `./itinerary_app.test.mjs`:

```js
import "./itinerary_app.test.mjs";
```

Run:

```bash
node tests/itinerary_app.test.mjs
node tests/dashboard_app.test.mjs
```

Expected:

```text
itinerary_app tests passed
itinerary_app tests passed
```

---

### Task 5: Verification, README, And Browser Check

**Files:**
- Modify: `scripts/verify_dashboard.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: v2 scripts/tests from Tasks 1-4.
- Produces: complete verification command set and updated user instructions.

- [ ] **Step 1: Update verify script**

Modify `scripts/verify_dashboard.mjs` to also:

```js
const itineraryGenerated = fs.readFileSync(path.join(rootDir, "app", "itinerary-data.js"), "utf8");
if (!itineraryGenerated.startsWith("window.ITINERARY_DATA = ")) {
  throw new Error("Generated itinerary data is missing global assignment");
}
for (const text of ["scenario-controls", "itinerary-timeline", "candidate-panel", "未找到直飞", "待查询"]) {
  const combined = `${html}\n${app}\n${itineraryGenerated}`;
  if (!combined.includes(text)) throw new Error(`v2 dashboard missing ${text}`);
}
```

- [ ] **Step 2: Update README**

Replace the Dashboard description with:

```markdown
## 本地网页 Dashboard

生成页面数据：

```bash
node scripts/build_dashboard_data.mjs
node scripts/build_itinerary_data.mjs
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

Dashboard v2 支持：

- 用中文行程轴查看每天怎么走
- 查看具体航班候选的出发/到达时间、直飞/中转、价格和来源
- 明确标出“未找到直飞”和“待查询”段
- 切换 9/29 出发与 9/30 出发情景
- 修改人民币价格并即时重算
- 导出更新后的 JSON
```

- [ ] **Step 3: Run full verification**

Run:

```bash
node tests/validate_live_options.test.mjs
node tests/live_price_scoring.test.mjs
node tests/dashboard_core.test.mjs
node tests/dashboard_app.test.mjs
node tests/itinerary_validation.test.mjs
node tests/itinerary_build.test.mjs
node tests/itinerary_core.test.mjs
node tests/itinerary_app.test.mjs
node scripts/validate_live_options.mjs data/live_price_options.json
node scripts/validate_itinerary_scenarios.mjs data/itinerary_scenarios.json
node scripts/score_live_options.mjs
node scripts/build_dashboard_data.mjs
node scripts/build_itinerary_data.mjs
node scripts/verify_dashboard.mjs
```

Expected: all commands exit 0. Existing unknown-baggage warnings remain acceptable.

- [ ] **Step 4: Start local server**

Run:

```bash
python3 -m http.server 8000
```

Expected: server starts.

- [ ] **Step 5: Browser check**

Open:

```text
http://localhost:8000/app/
```

Verify:

- Chinese route labels are visible.
- `北京首都/大兴 BJS` appears only as helper text, not the main title.
- Scenario buttons include `9/29 出发` and `9/30 出发`.
- The 10/6 return gap displays `未找到直飞` or `待查询`.
- Changing a candidate price updates the displayed totals.
- Export button exists.

- [ ] **Step 6: Stop local server**

Stop the server with Ctrl-C.
