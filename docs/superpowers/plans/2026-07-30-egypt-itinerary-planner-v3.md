# Egypt Itinerary Planner v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Egypt-only itinerary planner for 2026-09-30 to 2026-10-07 that compares A1 and A2, makes assistant-owned query tasks explicit, and explains itinerary tradeoffs.

**Architecture:** Add a new Egypt-specific itinerary data model beside the old price/dashboard data, with validation and browser-safe core functions. Replace the static dashboard experience with an itinerary comparison workspace that renders daily plans, risks, assistant query tasks, and recommendation logic. Keep all query tasks owned by the assistant; user action is only required for login/captcha/final purchase blockers.

**Tech Stack:** Dependency-free Node.js ESM scripts; browser JavaScript modules; static HTML/CSS; Node `assert` tests; optional `python3 -m http.server` for local viewing.

## Global Constraints

- Do not plan China domestic segments.
- Fixed inbound: `2026-09-30 09:00` arrive Cairo.
- Fixed outbound: `2026-10-07 14:45` depart Cairo.
- A1 is `开罗 + 卢克索 + 赫尔格达`.
- A2 is `开罗 + 阿布辛贝 + 卢克索 + 赫尔格达`.
- If Aswan is included, Abu Simbel is mandatory.
- If Abu Simbel is included, default route order is `开罗 → 阿斯旺/阿布辛贝 → 卢克索 → 赫尔格达 → 开罗`.
- Query tasks are assistant-owned; page copy must not say the user should query by themselves.
- Do not save passwords, cookies, or tokens.
- User only handles login, captcha, SMS verification, and final booking confirmation.
- If a 10/7 Hurghada to Cairo arrival is later than `11:00`, mark A2 high risk.
- If no viable 10/7 early Hurghada to Cairo result is found, recommend returning to Cairo on 10/6.
- Keep the app dependency-free.
- Keep all currency in CNY.

---

## File Structure

- Create `data/egypt_itinerary_options.json`: A1/A2 options, day-by-day blocks, assistant query tasks, and optional researched candidates.
- Create `scripts/validate_egypt_itinerary.mjs`: schema validation for Egypt-only options, query task ownership, fixed dates, route order, and no domestic China leakage.
- Create `scripts/build_egypt_itinerary_data.mjs`: writes `app/egypt-itinerary-data.js` as `window.EGYPT_ITINERARY_DATA`.
- Create `app/egypt-itinerary-core.js`: pure functions for option summarization, scoring, risk generation, query task grouping, and query result application.
- Modify `app/index.html`: replace v2 dashboard shell with Egypt planner sections.
- Modify `app/app.js`: render v3 Egypt planner from `window.EGYPT_ITINERARY_DATA`.
- Modify `app/styles.css`: style comparison tabs, daily timeline, task queue, risk panels, and result notes.
- Create `tests/egypt_itinerary_validation.test.mjs`: validation regressions.
- Create `tests/egypt_itinerary_core.test.mjs`: pure logic regressions.
- Create `tests/egypt_itinerary_app.test.mjs`: fake-DOM rendering and interaction tests.
- Modify `tests/dashboard_app.test.mjs`: smoke wrapper importing `egypt_itinerary_app.test.mjs`.
- Modify `scripts/verify_dashboard.mjs`: verify v3 generated data and rendered integration checks.
- Modify `README.md`: document Egypt planner scope, commands, and assistant-owned query semantics.

---

### Task 1: Egypt Data Model And Validation

**Files:**
- Create: `data/egypt_itinerary_options.json`
- Create: `scripts/validate_egypt_itinerary.mjs`
- Create: `tests/egypt_itinerary_validation.test.mjs`

**Interfaces:**
- Produces: `validateEgyptItineraryData(data): { ok: true, warnings: string[] }`
- Produces: CLI `node scripts/validate_egypt_itinerary.mjs data/egypt_itinerary_options.json`
- Consumes: none.

- [ ] **Step 1: Write failing validation tests**

Create `tests/egypt_itinerary_validation.test.mjs`:

```js
import assert from "node:assert/strict";
import { validateEgyptItineraryData } from "../scripts/validate_egypt_itinerary.mjs";

const valid = {
  metadata: {
    currency: "CNY",
    fixed_arrival: { city_zh: "开罗", date: "2026-09-30", time: "09:00" },
    fixed_departure: { city_zh: "开罗", date: "2026-10-07", time: "14:45" },
    assistant_query_policy_zh: "待查询表示待助手查询，用户只处理登录、验证码和最终购买确认。"
  },
  options: [
    {
      id: "A1_HRG_BALANCED",
      name_zh: "A1 开罗 + 卢克索 + 赫尔格达",
      positioning_zh: "均衡推荐版",
      route_order_zh: ["开罗", "卢克索", "赫尔格达", "开罗"],
      includes_abu_simbel: false,
      default_recommendation: true,
      risk_level: "medium",
      hotel_nights: { "开罗": 3, "卢克索": 2, "赫尔格达": 1 },
      recommendation_zh: "默认推荐 A1，因为它保留完整红海日，并在 10/6 回开罗，10/7 国际返程风险低。"
    },
    {
      id: "A2_ABU_SIMBEL_HRG",
      name_zh: "A2 开罗 + 阿布辛贝 + 卢克索 + 赫尔格达",
      positioning_zh: "历史强化版",
      route_order_zh: ["开罗", "阿斯旺/阿布辛贝", "卢克索", "赫尔格达", "开罗"],
      includes_abu_simbel: true,
      default_recommendation: false,
      risk_level: "high",
      hotel_nights: { "开罗": 2, "阿斯旺": 1, "卢克索": 2, "赫尔格达": 1 },
      recommendation_zh: "A2 多阿布辛贝，但牺牲红海和缓冲，必须优先确认 10/7 赫尔格达早班飞开罗。"
    }
  ],
  days: [
    {
      option_id: "A1_HRG_BALANCED",
      date: "2026-09-30",
      city_zh: "开罗",
      blocks: [
        { period: "morning", title_zh: "抵达开罗", type: "arrival", risk_level: "low", must_book: false },
        { period: "afternoon", title_zh: "GEM 或市区轻量活动", type: "sight", risk_level: "low", must_book: false },
        { period: "evening", title_zh: "开罗入住休整", type: "hotel", risk_level: "low", must_book: true }
      ]
    },
    {
      option_id: "A2_ABU_SIMBEL_HRG",
      date: "2026-10-02",
      city_zh: "阿斯旺",
      blocks: [
        { period: "morning", title_zh: "阿布辛贝早出发", type: "sight", risk_level: "high", must_book: true },
        { period: "afternoon", title_zh: "阿布辛贝返回阿斯旺", type: "transfer", risk_level: "high", must_book: true },
        { period: "evening", title_zh: "阿斯旺休整", type: "hotel", risk_level: "medium", must_book: true }
      ]
    }
  ],
  query_tasks: [
    {
      id: "a2-hrg-cai-1007-early",
      option_ids: ["A2_ABU_SIMBEL_HRG"],
      category: "transport",
      title_zh: "10/7 赫尔格达 → 开罗早班",
      why_it_matters_zh: "决定 A2 是否可以当天衔接 14:45 国际航班",
      success_criteria_zh: "到达开罗不晚于 11:00",
      priority: "high",
      status: "assistant_pending",
      owner: "assistant"
    }
  ],
  researched_candidates: []
};

assert.deepEqual(validateEgyptItineraryData(valid), { ok: true, warnings: [] });

const domesticLeak = structuredClone(valid);
domesticLeak.days[0].blocks[0].title_zh = "北京到兰州";
assert.throws(() => validateEgyptItineraryData(domesticLeak), /China domestic segment leaked/);

const userOwnedTask = structuredClone(valid);
userOwnedTask.query_tasks[0].owner = "user";
assert.throws(() => validateEgyptItineraryData(userOwnedTask), /query task.*owner.*assistant/);

const wrongA2Order = structuredClone(valid);
wrongA2Order.options[1].route_order_zh = ["开罗", "卢克索", "阿斯旺/阿布辛贝", "赫尔格达", "开罗"];
assert.throws(() => validateEgyptItineraryData(wrongA2Order), /A2.*route order/);

const missingAbuSimbelDay = structuredClone(valid);
missingAbuSimbelDay.days = missingAbuSimbelDay.days.filter((day) => day.option_id !== "A2_ABU_SIMBEL_HRG");
assert.throws(() => validateEgyptItineraryData(missingAbuSimbelDay), /A2.*阿布辛贝/);

const badFixedDeparture = structuredClone(valid);
badFixedDeparture.metadata.fixed_departure.time = "15:00";
assert.throws(() => validateEgyptItineraryData(badFixedDeparture), /fixed_departure.*14:45/);

console.log("egypt_itinerary_validation tests passed");
```

- [ ] **Step 2: Run validation test to verify it fails**

Run:

```bash
node tests/egypt_itinerary_validation.test.mjs
```

Expected: FAIL with module not found for `scripts/validate_egypt_itinerary.mjs`.

- [ ] **Step 3: Implement validator**

Create `scripts/validate_egypt_itinerary.mjs`:

```js
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const allowedPeriods = new Set(["morning", "afternoon", "evening"]);
const allowedBlockTypes = new Set(["arrival", "departure", "sight", "transfer", "hotel", "meal", "rest", "activity"]);
const allowedRiskLevels = new Set(["low", "medium", "high"]);
const allowedTaskStatuses = new Set([
  "assistant_pending",
  "searching",
  "blocked_by_login",
  "blocked_by_captcha",
  "no_result_found",
  "found_candidates",
  "selected",
  "needs_retry"
]);
const chinaDomesticPattern = /北京.*兰州|兰州.*长春|长春.*北京|LHW|CGQ|中国国内段/;

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function assertPresent(object, field, context) {
  if (object[field] === undefined || object[field] === null || object[field] === "") {
    throw new Error(`${context} missing ${field}`);
  }
}

function assertNoDomesticLeak(value) {
  if (chinaDomesticPattern.test(String(value))) {
    throw new Error(`China domestic segment leaked: ${value}`);
  }
}

function assertRisk(value, context) {
  if (!allowedRiskLevels.has(value)) throw new Error(`${context} risk_level invalid`);
}

function validateFixedMetadata(metadata) {
  if (metadata.currency !== "CNY") throw new Error("metadata.currency must be CNY");
  if (metadata.fixed_arrival?.city_zh !== "开罗") throw new Error("fixed_arrival city must be 开罗");
  if (metadata.fixed_arrival?.date !== "2026-09-30") throw new Error("fixed_arrival date must be 2026-09-30");
  if (metadata.fixed_arrival?.time !== "09:00") throw new Error("fixed_arrival time must be 09:00");
  if (metadata.fixed_departure?.city_zh !== "开罗") throw new Error("fixed_departure city must be 开罗");
  if (metadata.fixed_departure?.date !== "2026-10-07") throw new Error("fixed_departure date must be 2026-10-07");
  if (metadata.fixed_departure?.time !== "14:45") throw new Error("fixed_departure time must be 14:45");
  if (!String(metadata.assistant_query_policy_zh || "").includes("待助手查询")) {
    throw new Error("assistant query policy must say 待助手查询");
  }
}

function validateOption(option) {
  for (const field of ["id", "name_zh", "positioning_zh", "route_order_zh", "includes_abu_simbel", "default_recommendation", "risk_level", "hotel_nights", "recommendation_zh"]) {
    assertPresent(option, field, option.id || "option");
  }
  assertArray(option.route_order_zh, `${option.id}.route_order_zh`);
  assertRisk(option.risk_level, option.id);
  for (const value of [option.name_zh, option.positioning_zh, option.recommendation_zh, option.route_order_zh.join(" → ")]) {
    assertNoDomesticLeak(value);
  }
  if (option.id === "A2_ABU_SIMBEL_HRG") {
    const expectedOrder = ["开罗", "阿斯旺/阿布辛贝", "卢克索", "赫尔格达", "开罗"];
    if (option.route_order_zh.join("|") !== expectedOrder.join("|")) {
      throw new Error("A2 route order must be 开罗 → 阿斯旺/阿布辛贝 → 卢克索 → 赫尔格达 → 开罗");
    }
    if (!option.includes_abu_simbel) throw new Error("A2 must include 阿布辛贝");
  }
}

function validateDay(day, optionIds) {
  for (const field of ["option_id", "date", "city_zh", "blocks"]) {
    assertPresent(day, field, day.option_id || "day");
  }
  if (!optionIds.has(day.option_id)) throw new Error(`day has unknown option ${day.option_id}`);
  assertArray(day.blocks, `${day.option_id}.${day.date}.blocks`);
  assertNoDomesticLeak(day.city_zh);
  for (const block of day.blocks) {
    for (const field of ["period", "title_zh", "type", "risk_level", "must_book"]) {
      assertPresent(block, field, `${day.option_id}.${day.date}.block`);
    }
    if (!allowedPeriods.has(block.period)) throw new Error(`${block.title_zh} period invalid`);
    if (!allowedBlockTypes.has(block.type)) throw new Error(`${block.title_zh} type invalid`);
    assertRisk(block.risk_level, block.title_zh);
    if (typeof block.must_book !== "boolean") throw new Error(`${block.title_zh} must_book must be boolean`);
    assertNoDomesticLeak(block.title_zh);
  }
}

function validateQueryTask(task, optionIds) {
  for (const field of ["id", "option_ids", "category", "title_zh", "why_it_matters_zh", "success_criteria_zh", "priority", "status", "owner"]) {
    assertPresent(task, field, task.id || "query task");
  }
  assertArray(task.option_ids, `${task.id}.option_ids`);
  for (const optionId of task.option_ids) {
    if (!optionIds.has(optionId)) throw new Error(`${task.id} has unknown option ${optionId}`);
  }
  if (task.owner !== "assistant") throw new Error(`query task ${task.id} owner must be assistant`);
  if (!allowedTaskStatuses.has(task.status)) throw new Error(`${task.id} status invalid`);
  assertNoDomesticLeak(`${task.title_zh} ${task.why_it_matters_zh} ${task.success_criteria_zh}`);
}

export function validateEgyptItineraryData(data) {
  if (!data.metadata) throw new Error("metadata missing");
  validateFixedMetadata(data.metadata);
  for (const field of ["options", "days", "query_tasks", "researched_candidates"]) {
    assertArray(data[field], field);
  }

  const optionIds = new Set();
  for (const option of data.options) {
    validateOption(option);
    optionIds.add(option.id);
  }
  if (!optionIds.has("A1_HRG_BALANCED")) throw new Error("A1 option missing");
  if (!optionIds.has("A2_ABU_SIMBEL_HRG")) throw new Error("A2 option missing");

  for (const day of data.days) validateDay(day, optionIds);
  for (const task of data.query_tasks) validateQueryTask(task, optionIds);

  const a2DayText = data.days
    .filter((day) => day.option_id === "A2_ABU_SIMBEL_HRG")
    .flatMap((day) => day.blocks.map((block) => block.title_zh))
    .join(" ");
  if (!a2DayText.includes("阿布辛贝")) throw new Error("A2 days must include 阿布辛贝");

  const warnings = [];
  const a2EarlyReturn = data.query_tasks.find((task) => task.id === "a2-hrg-cai-1007-early");
  if (!a2EarlyReturn) throw new Error("A2 must include 10/7 Hurghada to Cairo early query task");
  if (a2EarlyReturn.priority !== "high") throw new Error("A2 10/7 early return task must be high priority");

  return { ok: true, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inputPath = process.argv[2];
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(JSON.stringify(validateEgyptItineraryData(data), null, 2));
}
```

- [ ] **Step 4: Create baseline data**

Create `data/egypt_itinerary_options.json` with this complete initial structure:

```json
{
  "metadata": {
    "currency": "CNY",
    "fixed_arrival": { "city_zh": "开罗", "date": "2026-09-30", "time": "09:00" },
    "fixed_departure": { "city_zh": "开罗", "date": "2026-10-07", "time": "14:45" },
    "assistant_query_policy_zh": "待查询表示待助手查询，用户只处理登录、验证码和最终购买确认。"
  },
  "options": [
    {
      "id": "A1_HRG_BALANCED",
      "name_zh": "A1 开罗 + 卢克索 + 赫尔格达",
      "positioning_zh": "均衡推荐版",
      "route_order_zh": ["开罗", "卢克索", "赫尔格达", "开罗"],
      "includes_abu_simbel": false,
      "default_recommendation": true,
      "risk_level": "medium",
      "hotel_nights": { "开罗": 3, "卢克索": 2, "赫尔格达": 1 },
      "recommendation_zh": "默认推荐 A1，因为它保留完整红海日，并在 10/6 回开罗，10/7 国际返程风险低。"
    },
    {
      "id": "A2_ABU_SIMBEL_HRG",
      "name_zh": "A2 开罗 + 阿布辛贝 + 卢克索 + 赫尔格达",
      "positioning_zh": "历史强化版",
      "route_order_zh": ["开罗", "阿斯旺/阿布辛贝", "卢克索", "赫尔格达", "开罗"],
      "includes_abu_simbel": true,
      "default_recommendation": false,
      "risk_level": "high",
      "hotel_nights": { "开罗": 2, "阿斯旺": 1, "卢克索": 2, "赫尔格达": 1 },
      "recommendation_zh": "A2 多阿布辛贝，但牺牲红海和缓冲，必须优先确认 10/7 赫尔格达早班飞开罗。"
    }
  ],
  "days": [
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-09-30",
      "city_zh": "开罗",
      "blocks": [
        { "period": "morning", "title_zh": "09:00 到达开罗，入境和取行李", "type": "arrival", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "GEM 或开罗市区轻量活动", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "开罗入住休整", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-01",
      "city_zh": "开罗",
      "blocks": [
        { "period": "morning", "title_zh": "金字塔 + 狮身人面像", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "开罗市区或埃及文明博物馆", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "开罗第二晚", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-02",
      "city_zh": "卢克索",
      "blocks": [
        { "period": "morning", "title_zh": "开罗 → 卢克索交通", "type": "transfer", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "卡尔纳克神庙", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "卢克索神庙 + 卢克索入住", "type": "sight", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-03",
      "city_zh": "卢克索",
      "blocks": [
        { "period": "morning", "title_zh": "帝王谷", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "哈特谢普苏特神庙 + 门农巨像", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "卢克索第二晚", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-04",
      "city_zh": "赫尔格达",
      "blocks": [
        { "period": "morning", "title_zh": "卢克索 → 赫尔格达包车", "type": "transfer", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "赫尔格达入住红海酒店", "type": "hotel", "risk_level": "low", "must_book": true },
        { "period": "evening", "title_zh": "海边休整", "type": "rest", "risk_level": "low", "must_book": false }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-05",
      "city_zh": "赫尔格达",
      "blocks": [
        { "period": "morning", "title_zh": "红海一日游或浮潜", "type": "activity", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "红海一日游继续或酒店海滩", "type": "activity", "risk_level": "medium", "must_book": true },
        { "period": "evening", "title_zh": "赫尔格达第二晚", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-06",
      "city_zh": "开罗",
      "blocks": [
        { "period": "morning", "title_zh": "赫尔格达 → 开罗交通", "type": "transfer", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "开罗返程缓冲", "type": "rest", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "开罗最后一晚", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A1_HRG_BALANCED",
      "date": "2026-10-07",
      "city_zh": "开罗",
      "blocks": [
        { "period": "morning", "title_zh": "开罗轻量活动或直接去机场", "type": "rest", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "14:45 开罗起飞返程", "type": "departure", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "国际航班返程中", "type": "departure", "risk_level": "low", "must_book": false }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-09-30",
      "city_zh": "开罗",
      "blocks": [
        { "period": "morning", "title_zh": "09:00 到达开罗，入境和取行李", "type": "arrival", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "GEM 或开罗市区轻量活动", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "开罗入住休整", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-01",
      "city_zh": "开罗/阿斯旺",
      "blocks": [
        { "period": "morning", "title_zh": "金字塔 + 狮身人面像", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "开罗补充游览", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "开罗 → 阿斯旺交通", "type": "transfer", "risk_level": "high", "must_book": true }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-02",
      "city_zh": "阿斯旺",
      "blocks": [
        { "period": "morning", "title_zh": "阿布辛贝早出发", "type": "sight", "risk_level": "high", "must_book": true },
        { "period": "afternoon", "title_zh": "阿布辛贝返回阿斯旺", "type": "transfer", "risk_level": "high", "must_book": true },
        { "period": "evening", "title_zh": "阿斯旺休整", "type": "hotel", "risk_level": "medium", "must_book": true }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-03",
      "city_zh": "卢克索",
      "blocks": [
        { "period": "morning", "title_zh": "阿斯旺 → 卢克索交通", "type": "transfer", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "卡尔纳克神庙", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "卢克索神庙 + 卢克索入住", "type": "sight", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-04",
      "city_zh": "卢克索",
      "blocks": [
        { "period": "morning", "title_zh": "帝王谷", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "afternoon", "title_zh": "哈特谢普苏特神庙 + 门农巨像", "type": "sight", "risk_level": "low", "must_book": false },
        { "period": "evening", "title_zh": "卢克索第二晚", "type": "hotel", "risk_level": "low", "must_book": true }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-05",
      "city_zh": "赫尔格达",
      "blocks": [
        { "period": "morning", "title_zh": "卢克索 → 赫尔格达包车", "type": "transfer", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "赫尔格达入住红海酒店", "type": "hotel", "risk_level": "low", "must_book": true },
        { "period": "evening", "title_zh": "海边休整", "type": "rest", "risk_level": "low", "must_book": false }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-06",
      "city_zh": "赫尔格达",
      "blocks": [
        { "period": "morning", "title_zh": "红海半日或一日游", "type": "activity", "risk_level": "medium", "must_book": true },
        { "period": "afternoon", "title_zh": "红海活动或提前回开罗备选", "type": "activity", "risk_level": "high", "must_book": true },
        { "period": "evening", "title_zh": "住赫尔格达或晚回开罗", "type": "hotel", "risk_level": "high", "must_book": true }
      ]
    },
    {
      "option_id": "A2_ABU_SIMBEL_HRG",
      "date": "2026-10-07",
      "city_zh": "开罗",
      "blocks": [
        { "period": "morning", "title_zh": "一早赫尔格达 → 开罗", "type": "transfer", "risk_level": "high", "must_book": true },
        { "period": "afternoon", "title_zh": "14:45 开罗起飞返程", "type": "departure", "risk_level": "medium", "must_book": false },
        { "period": "evening", "title_zh": "国际航班返程中", "type": "departure", "risk_level": "low", "must_book": false }
      ]
    }
  ],
  "query_tasks": [
    { "id": "a1-cai-lxr-1002", "option_ids": ["A1_HRG_BALANCED"], "category": "transport", "title_zh": "10/2 开罗 → 卢克索交通", "why_it_matters_zh": "决定 A1 是否能按时进入卢克索", "success_criteria_zh": "上午或中午前到达卢克索", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a1-lxr-hrg-1004", "option_ids": ["A1_HRG_BALANCED"], "category": "transport", "title_zh": "10/4 卢克索 → 赫尔格达包车", "why_it_matters_zh": "决定红海入住时间", "success_criteria_zh": "下午前到达赫尔格达酒店", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a1-hrg-cai-1006", "option_ids": ["A1_HRG_BALANCED"], "category": "transport", "title_zh": "10/6 赫尔格达 → 开罗交通", "why_it_matters_zh": "为 10/7 国际航班留缓冲", "success_criteria_zh": "10/6 当天回到开罗", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a1-cairo-hotel", "option_ids": ["A1_HRG_BALANCED"], "category": "hotel", "title_zh": "A1 开罗酒店", "why_it_matters_zh": "影响金字塔/GEM和返程机场动线", "success_criteria_zh": "交通便利、干净、适合 3 晚", "priority": "medium", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a1-luxor-hotel", "option_ids": ["A1_HRG_BALANCED"], "category": "hotel", "title_zh": "A1 卢克索酒店", "why_it_matters_zh": "影响东西岸游览效率", "success_criteria_zh": "干净、交通便利、适合 2 晚", "priority": "medium", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a1-hurghada-hotel", "option_ids": ["A1_HRG_BALANCED"], "category": "hotel", "title_zh": "A1 赫尔格达红海酒店", "why_it_matters_zh": "决定红海体验质量", "success_criteria_zh": "环境好，优先含早晚饭", "priority": "medium", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a1-red-sea-day-trip", "option_ids": ["A1_HRG_BALANCED"], "category": "activity", "title_zh": "A1 赫尔格达红海一日游", "why_it_matters_zh": "决定红海体验是否完整", "success_criteria_zh": "浮潜或海岛一日游，评价稳定", "priority": "medium", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-cai-asw-1001", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "transport", "title_zh": "10/1 开罗 → 阿斯旺交通", "why_it_matters_zh": "决定 10/2 是否能早出发去阿布辛贝", "success_criteria_zh": "10/1 晚上或 10/2 很早到阿斯旺", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-abu-simbel-1002", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "activity", "title_zh": "10/2 阿布辛贝一日安排", "why_it_matters_zh": "阿斯旺方案的核心目的", "success_criteria_zh": "能完成阿布辛贝并回到阿斯旺", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-asw-lxr-1003", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "transport", "title_zh": "10/3 阿斯旺 → 卢克索交通", "why_it_matters_zh": "决定卢克索东岸是否还能安排", "success_criteria_zh": "10/3 中午或下午前到卢克索", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-lxr-hrg-1005", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "transport", "title_zh": "10/5 卢克索 → 赫尔格达包车", "why_it_matters_zh": "决定 A2 是否保留红海时间", "success_criteria_zh": "10/5 下午前到达赫尔格达", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-hrg-cai-1007-early", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "transport", "title_zh": "10/7 赫尔格达 → 开罗早班", "why_it_matters_zh": "决定 A2 是否可以当天衔接 14:45 国际航班", "success_criteria_zh": "到达开罗不晚于 11:00", "priority": "high", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-hurghada-hotel", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "hotel", "title_zh": "A2 赫尔格达红海酒店", "why_it_matters_zh": "红海时间被压缩，酒店体验更重要", "success_criteria_zh": "环境好，优先含早晚饭，适合短住", "priority": "medium", "status": "assistant_pending", "owner": "assistant" },
    { "id": "a2-red-sea-half-day", "option_ids": ["A2_ABU_SIMBEL_HRG"], "category": "activity", "title_zh": "A2 赫尔格达半日或一日游", "why_it_matters_zh": "在压缩时间里保留红海体验", "success_criteria_zh": "半日可行，或一日游不影响 10/7 返程", "priority": "medium", "status": "assistant_pending", "owner": "assistant" }
  ],
  "researched_candidates": []
}
```

- [ ] **Step 5: Verify validation passes**

Run:

```bash
node tests/egypt_itinerary_validation.test.mjs
node scripts/validate_egypt_itinerary.mjs data/egypt_itinerary_options.json
```

Expected: both exit 0 and print `egypt_itinerary_validation tests passed` plus `{ "ok": true, "warnings": [] }`.

---

### Task 2: Core Itinerary Logic

**Files:**
- Create: `app/egypt-itinerary-core.js`
- Create: `tests/egypt_itinerary_core.test.mjs`

**Interfaces:**
- Consumes: valid Egypt data from Task 1.
- Produces: `getOptionSummaries(data): Array<OptionSummary>`
- Produces: `getRecommendation(data): Recommendation`
- Produces: `getDaysForOption(data, optionId): Array<Day>`
- Produces: `getQueryTasksForOption(data, optionId): Array<QueryTask>`
- Produces: `applyTransportCandidate(data, taskId, candidate): EgyptData`
- Produces: `createEgyptItineraryExportPayload(data): string`

- [ ] **Step 1: Write failing core tests**

Create `tests/egypt_itinerary_core.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getOptionSummaries,
  getRecommendation,
  getDaysForOption,
  getQueryTasksForOption,
  applyTransportCandidate,
  createEgyptItineraryExportPayload
} from "../app/egypt-itinerary-core.js";

const data = JSON.parse(fs.readFileSync("data/egypt_itinerary_options.json", "utf8"));

const summaries = getOptionSummaries(data);
assert.equal(summaries.length, 2);
assert.equal(summaries[0].id, "A1_HRG_BALANCED");
assert.equal(summaries.find((item) => item.id === "A2_ABU_SIMBEL_HRG").includes_abu_simbel, true);
assert.equal(summaries.find((item) => item.id === "A2_ABU_SIMBEL_HRG").red_sea_time_level_zh, "压缩");

const recommendation = getRecommendation(data);
assert.equal(recommendation.recommended_option_id, "A1_HRG_BALANCED");
assert.match(recommendation.reason_zh, /完整红海日/);
assert.match(recommendation.tradeoff_zh, /阿布辛贝/);

const a2Days = getDaysForOption(data, "A2_ABU_SIMBEL_HRG");
assert.equal(a2Days.length, 8);
assert.ok(a2Days.some((day) => day.blocks.some((block) => block.title_zh.includes("阿布辛贝"))));

const a2Tasks = getQueryTasksForOption(data, "A2_ABU_SIMBEL_HRG");
assert.equal(a2Tasks.every((task) => task.owner === "assistant"), true);
assert.equal(a2Tasks.find((task) => task.id === "a2-hrg-cai-1007-early").priority, "high");

const withLateCandidate = applyTransportCandidate(data, "a2-hrg-cai-1007-early", {
  id: "candidate-hrg-cai-late",
  task_id: "a2-hrg-cai-1007-early",
  source_platform: "EgyptAir",
  source_url: "https://example.com",
  searched_at: "2026-07-30T10:00:00+08:00",
  type: "transport",
  from_city_zh: "赫尔格达",
  to_city_zh: "开罗",
  date: "2026-10-07",
  departure_time_local: "10:35",
  arrival_time_local: "11:35",
  duration_minutes: 60,
  price_cny: 800,
  notes_zh: "到达晚于 11:00"
});
const lateA2 = getOptionSummaries(withLateCandidate).find((item) => item.id === "A2_ABU_SIMBEL_HRG");
assert.equal(lateA2.risk_level, "high");
assert.ok(lateA2.risks.some((risk) => risk.includes("晚于 11:00")));

const withEarlyCandidate = applyTransportCandidate(data, "a2-hrg-cai-1007-early", {
  id: "candidate-hrg-cai-early",
  task_id: "a2-hrg-cai-1007-early",
  source_platform: "EgyptAir",
  source_url: "https://example.com",
  searched_at: "2026-07-30T10:00:00+08:00",
  type: "transport",
  from_city_zh: "赫尔格达",
  to_city_zh: "开罗",
  date: "2026-10-07",
  departure_time_local: "07:30",
  arrival_time_local: "08:30",
  duration_minutes: 60,
  price_cny: 800,
  notes_zh: "可衔接国际航班"
});
const earlyA2 = getOptionSummaries(withEarlyCandidate).find((item) => item.id === "A2_ABU_SIMBEL_HRG");
assert.equal(earlyA2.risks.some((risk) => risk.includes("晚于 11:00")), false);

const exported = JSON.parse(createEgyptItineraryExportPayload(withEarlyCandidate));
assert.equal(exported.researched_candidates[0].id, "candidate-hrg-cai-early");

console.log("egypt_itinerary_core tests passed");
```

- [ ] **Step 2: Run core test to verify it fails**

Run:

```bash
node tests/egypt_itinerary_core.test.mjs
```

Expected: FAIL with module not found for `app/egypt-itinerary-core.js`.

- [ ] **Step 3: Implement core module**

Create `app/egypt-itinerary-core.js`:

```js
const periodOrder = { morning: 1, afternoon: 2, evening: 3 };

function clone(data) {
  return structuredClone(data);
}

function timeToMinutes(time) {
  const [hour, minute] = String(time || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function byOptionId(data) {
  return new Map(data.options.map((option) => [option.id, option]));
}

function selectedCandidatesForOption(data, optionId) {
  const taskIds = new Set(data.query_tasks.filter((task) => task.option_ids.includes(optionId)).map((task) => task.id));
  return data.researched_candidates.filter((candidate) => taskIds.has(candidate.task_id));
}

function deriveOptionRisks(data, option) {
  const risks = [];
  if (option.id === "A2_ABU_SIMBEL_HRG") {
    risks.push("A2 依赖 10/7 赫尔格达 → 开罗早班，必须优先确认。");
    risks.push("阿布辛贝会压缩红海时间。");
  }
  const candidates = selectedCandidatesForOption(data, option.id);
  const hrgCai = candidates.find((candidate) => candidate.task_id === "a2-hrg-cai-1007-early");
  if (hrgCai && hrgCai.arrival_time_local && timeToMinutes(hrgCai.arrival_time_local) > timeToMinutes("11:00")) {
    risks.push("10/7 到达开罗晚于 11:00，衔接 14:45 国际航班高风险。");
  }
  return risks;
}

function scoreOption(option, risks) {
  const stability = option.id === "A1_HRG_BALANCED" ? 90 : 68;
  const experience = option.includes_abu_simbel ? 96 : 84;
  const transfer = option.id === "A1_HRG_BALANCED" ? 82 : 62;
  const cost = option.id === "A1_HRG_BALANCED" ? 80 : 72;
  const riskPenalty = risks.some((risk) => risk.includes("晚于 11:00")) ? 18 : 0;
  return Math.round(stability * 0.35 + experience * 0.35 + transfer * 0.2 + cost * 0.1 - riskPenalty);
}

export function getDaysForOption(data, optionId) {
  return data.days
    .filter((day) => day.option_id === optionId)
    .map((day) => ({
      ...day,
      blocks: [...day.blocks].sort((a, b) => periodOrder[a.period] - periodOrder[b.period])
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getQueryTasksForOption(data, optionId) {
  return data.query_tasks
    .filter((task) => task.option_ids.includes(optionId))
    .sort((a, b) => {
      if (a.priority === b.priority) return a.id.localeCompare(b.id);
      return a.priority === "high" ? -1 : 1;
    });
}

export function getOptionSummaries(data) {
  return data.options.map((option) => {
    const days = getDaysForOption(data, option.id);
    const tasks = getQueryTasksForOption(data, option.id);
    const candidates = selectedCandidatesForOption(data, option.id);
    const risks = deriveOptionRisks(data, option);
    const score = scoreOption(option, risks);
    return {
      ...option,
      day_count: days.length,
      query_task_count: tasks.length,
      researched_candidate_count: candidates.length,
      risks,
      score,
      red_sea_time_level_zh: option.id === "A1_HRG_BALANCED" ? "完整" : "压缩"
    };
  }).sort((a, b) => {
    if (a.default_recommendation !== b.default_recommendation) return a.default_recommendation ? -1 : 1;
    return b.score - a.score;
  });
}

export function getRecommendation(data) {
  const summaries = getOptionSummaries(data);
  const recommended = summaries.find((summary) => summary.default_recommendation) || summaries[0];
  return {
    recommended_option_id: recommended.id,
    reason_zh: "推荐 A1，因为它保留完整红海日，并在 10/6 回开罗，10/7 国际返程风险低。",
    tradeoff_zh: "A2 可以覆盖阿布辛贝，但会压缩红海，并依赖 10/7 赫尔格达早班飞开罗。",
    next_action_zh: "如果更想要阿布辛贝，优先由助手查询 10/7 赫尔格达 → 开罗早班和阿布辛贝一日交通。"
  };
}

export function applyTransportCandidate(data, taskId, candidate) {
  const next = clone(data);
  const task = next.query_tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Unknown query task ${taskId}`);
  const existingIndex = next.researched_candidates.findIndex((item) => item.id === candidate.id);
  const normalized = {
    ...candidate,
    task_id: taskId,
    status: "found_candidates"
  };
  if (existingIndex >= 0) next.researched_candidates[existingIndex] = normalized;
  else next.researched_candidates.push(normalized);
  task.status = "found_candidates";
  return next;
}

export function createEgyptItineraryExportPayload(data) {
  return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 4: Verify core tests pass**

Run:

```bash
node tests/egypt_itinerary_core.test.mjs
```

Expected: PASS and print `egypt_itinerary_core tests passed`.

---

### Task 3: Build Script And Generated Browser Data

**Files:**
- Create: `scripts/build_egypt_itinerary_data.mjs`
- Create: `tests/egypt_itinerary_build.test.mjs`
- Generate: `app/egypt-itinerary-data.js`
- Modify: `app/index.html`

**Interfaces:**
- Consumes: `validateEgyptItineraryData(data)` from Task 1.
- Produces: `node scripts/build_egypt_itinerary_data.mjs`
- Produces: `window.EGYPT_ITINERARY_DATA = ...;`

- [ ] **Step 1: Write failing build test**

Create `tests/egypt_itinerary_build.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

execFileSync("node", ["scripts/build_egypt_itinerary_data.mjs"], { stdio: "pipe" });
const generated = fs.readFileSync("app/egypt-itinerary-data.js", "utf8");

assert.ok(generated.startsWith("window.EGYPT_ITINERARY_DATA = "));
assert.match(generated, /A1_HRG_BALANCED/);
assert.match(generated, /A2_ABU_SIMBEL_HRG/);
assert.match(generated, /待助手查询/);

console.log("egypt_itinerary_build tests passed");
```

- [ ] **Step 2: Run build test to verify it fails**

Run:

```bash
node tests/egypt_itinerary_build.test.mjs
```

Expected: FAIL with module not found for `scripts/build_egypt_itinerary_data.mjs`.

- [ ] **Step 3: Implement build script**

Create `scripts/build_egypt_itinerary_data.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEgyptItineraryData } from "./validate_egypt_itinerary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const inputPath = path.join(rootDir, "data", "egypt_itinerary_options.json");
const outputPath = path.join(rootDir, "app", "egypt-itinerary-data.js");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateEgyptItineraryData(data);
const source = `window.EGYPT_ITINERARY_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(outputPath, source);
console.log(`Wrote ${outputPath}`);
```

- [ ] **Step 4: Update HTML data script**

Modify `app/index.html` to load:

```html
<script src="./egypt-itinerary-data.js"></script>
<script type="module" src="./app.js"></script>
```

Remove the old v2 `live-price-data.js` and `itinerary-data.js` script tags from the active page.

- [ ] **Step 5: Verify build test passes**

Run:

```bash
node tests/egypt_itinerary_build.test.mjs
```

Expected: PASS and print `egypt_itinerary_build tests passed`.

---

### Task 4: Egypt Planner UI

**Files:**
- Modify: `app/index.html`
- Modify: `app/app.js`
- Modify: `app/styles.css`
- Create: `tests/egypt_itinerary_app.test.mjs`
- Modify: `tests/dashboard_app.test.mjs`

**Interfaces:**
- Consumes: `window.EGYPT_ITINERARY_DATA`.
- Consumes from `app/egypt-itinerary-core.js`:
  - `getOptionSummaries`
  - `getRecommendation`
  - `getDaysForOption`
  - `getQueryTasksForOption`
  - `createEgyptItineraryExportPayload`
- Produces: static page with `#option-tabs`, `#recommendation`, `#daily-itinerary`, `#query-task-list`, `#risk-panel`, `#export-json`.

- [ ] **Step 1: Write failing app tests**

Create `tests/egypt_itinerary_app.test.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";

class FakeElement {
  constructor(selector) {
    this.selector = selector;
    this.innerHTML = "";
    this.textContent = "";
    this.listeners = {};
    this.dataset = {};
    this.download = "";
    this.clicked = false;
  }
  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }
  querySelector() {
    return null;
  }
  closest() {
    return null;
  }
  click() {
    this.clicked = true;
  }
}

class FakeDocument {
  constructor() {
    this.createdElements = [];
    this.elements = new Map([
      ["#option-tabs", new FakeElement("#option-tabs")],
      ["#recommendation", new FakeElement("#recommendation")],
      ["#daily-itinerary", new FakeElement("#daily-itinerary")],
      ["#query-task-list", new FakeElement("#query-task-list")],
      ["#risk-panel", new FakeElement("#risk-panel")],
      ["#export-json", new FakeElement("#export-json")]
    ]);
  }
  querySelector(selector) {
    return this.elements.get(selector) || null;
  }
  createElement(selector) {
    const element = new FakeElement(selector);
    this.createdElements.push(element);
    return element;
  }
}

const data = JSON.parse(fs.readFileSync("data/egypt_itinerary_options.json", "utf8"));
const document = new FakeDocument();
const previousGlobals = {
  document: globalThis.document,
  window: globalThis.window,
  Blob: globalThis.Blob,
  URL: globalThis.URL
};
const OriginalURL = globalThis.URL;
globalThis.document = document;
globalThis.window = { EGYPT_ITINERARY_DATA: structuredClone(data) };
globalThis.Blob = class {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
  }
};
globalThis.URL = class FakeURL extends OriginalURL {
  static createObjectURL() {
    return "blob:egypt-itinerary";
  }
  static revokeObjectURL() {}
};

try {
  await import(`../app/app.js?egypt-test=${Date.now()}`);

  const tabs = document.querySelector("#option-tabs");
  const recommendation = document.querySelector("#recommendation");
  const daily = document.querySelector("#daily-itinerary");
  const tasks = document.querySelector("#query-task-list");
  const risks = document.querySelector("#risk-panel");
  const exportButton = document.querySelector("#export-json");

  assert.match(tabs.innerHTML, /A1 开罗 \+ 卢克索 \+ 赫尔格达/);
  assert.match(tabs.innerHTML, /A2 开罗 \+ 阿布辛贝 \+ 卢克索 \+ 赫尔格达/);
  assert.match(recommendation.innerHTML, /默认推荐 A1/);
  assert.match(recommendation.innerHTML, /完整红海日/);
  assert.match(daily.innerHTML, /9月30日/);
  assert.match(daily.innerHTML, /金字塔/);
  assert.match(tasks.innerHTML, /待助手查询/);
  assert.doesNotMatch(tasks.innerHTML, /用户自行查询|你自己查|请自行查询/);

  tabs.listeners.click({
    target: {
      dataset: { optionId: "A2_ABU_SIMBEL_HRG" },
      closest() {
        return this;
      }
    }
  });

  assert.match(daily.innerHTML, /阿布辛贝/);
  assert.match(risks.innerHTML, /10\/7 赫尔格达.*开罗|早班/);
  assert.match(tasks.innerHTML, /10\/7 赫尔格达 → 开罗早班/);

  exportButton.listeners.click();
  const exportedLink = document.createdElements.find((item) => item.download === "egypt_itinerary.updated.json");
  assert.ok(exportedLink);
  assert.equal(exportedLink.clicked, true);
} finally {
  globalThis.document = previousGlobals.document;
  globalThis.window = previousGlobals.window;
  globalThis.Blob = previousGlobals.Blob;
  globalThis.URL = previousGlobals.URL;
}

console.log("egypt_itinerary_app tests passed");
```

Modify `tests/dashboard_app.test.mjs` to:

```js
import "./egypt_itinerary_app.test.mjs";
```

- [ ] **Step 2: Run app tests to verify they fail**

Run:

```bash
node tests/egypt_itinerary_app.test.mjs
node tests/dashboard_app.test.mjs
```

Expected: FAIL because `app/app.js` still expects v2 data/selectors.

- [ ] **Step 3: Update HTML shell**

Modify `app/index.html` body to:

```html
<main class="page-shell egypt-planner">
  <header class="topbar">
    <div>
      <p class="eyebrow">Egypt Itinerary Planner</p>
      <h1>埃及段行程规划</h1>
      <p class="muted">9/30 09:00 到达开罗 · 10/7 14:45 开罗起飞</p>
    </div>
    <button id="export-json" type="button">导出 JSON</button>
  </header>

  <section id="recommendation" class="recommendation-panel" aria-label="推荐结论"></section>
  <section id="option-tabs" class="option-tabs" aria-label="方案切换"></section>

  <section class="planner-grid">
    <section class="panel">
      <h2>每日行程</h2>
      <div id="daily-itinerary" class="daily-itinerary"></div>
    </section>
    <aside class="side-stack">
      <section class="panel">
        <h2>助手查询队列</h2>
        <div id="query-task-list" class="query-task-list"></div>
      </section>
      <section class="panel">
        <h2>风险与取舍</h2>
        <div id="risk-panel" class="risk-panel"></div>
      </section>
    </aside>
  </section>
</main>
<script src="./egypt-itinerary-data.js"></script>
<script type="module" src="./app.js"></script>
```

- [ ] **Step 4: Implement app renderer**

Replace `app/app.js` with:

```js
import {
  getOptionSummaries,
  getRecommendation,
  getDaysForOption,
  getQueryTasksForOption,
  createEgyptItineraryExportPayload
} from "./egypt-itinerary-core.js";

const state = {
  data: structuredClone(window.EGYPT_ITINERARY_DATA),
  activeOptionId: window.EGYPT_ITINERARY_DATA.options.find((option) => option.default_recommendation)?.id || window.EGYPT_ITINERARY_DATA.options[0].id
};

const optionTabsEl = document.querySelector("#option-tabs");
const recommendationEl = document.querySelector("#recommendation");
const dailyItineraryEl = document.querySelector("#daily-itinerary");
const queryTaskListEl = document.querySelector("#query-task-list");
const riskPanelEl = document.querySelector("#risk-panel");
const exportButton = document.querySelector("#export-json");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateZh(date) {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function statusLabel(status) {
  const labels = {
    assistant_pending: "待助手查询",
    searching: "正在查询",
    blocked_by_login: "需要你完成登录后继续",
    blocked_by_captcha: "需要你完成验证后继续",
    no_result_found: "未找到可用结果",
    found_candidates: "已查到候选",
    selected: "已纳入方案",
    needs_retry: "助手需要换来源重试"
  };
  return labels[status] || status;
}

function activeSummary() {
  return getOptionSummaries(state.data).find((summary) => summary.id === state.activeOptionId);
}

function renderRecommendation() {
  const recommendation = getRecommendation(state.data);
  const active = activeSummary();
  recommendationEl.innerHTML = `
    <article class="summary-card">
      <div>
        <p class="summary-title">${escapeHtml(active.name_zh)}</p>
        <p>${escapeHtml(recommendation.reason_zh)}</p>
        <p class="muted">${escapeHtml(recommendation.tradeoff_zh)}</p>
      </div>
      <div class="score-pill">行程适配分 ${escapeHtml(active.score)}</div>
    </article>
  `;
}

function renderTabs() {
  optionTabsEl.innerHTML = getOptionSummaries(state.data).map((summary) => `
    <button type="button" class="${summary.id === state.activeOptionId ? "active" : ""}" data-option-id="${escapeHtml(summary.id)}">
      <strong>${escapeHtml(summary.name_zh)}</strong>
      <span>${escapeHtml(summary.positioning_zh)} · 红海${escapeHtml(summary.red_sea_time_level_zh)}</span>
    </button>
  `).join("");
}

function renderDailyItinerary() {
  const days = getDaysForOption(state.data, state.activeOptionId);
  dailyItineraryEl.innerHTML = days.map((day) => `
    <article class="day-card">
      <div class="day-head">
        <strong>${escapeHtml(formatDateZh(day.date))}</strong>
        <span>${escapeHtml(day.city_zh)}</span>
      </div>
      <div class="day-blocks">
        ${day.blocks.map((block) => `
          <div class="day-block risk-${escapeHtml(block.risk_level)}">
            <span>${block.period === "morning" ? "上午" : block.period === "afternoon" ? "下午" : "晚上"}</span>
            <strong>${escapeHtml(block.title_zh)}</strong>
            <em>${block.must_book ? "需预订" : "可现场/灵活"}</em>
          </div>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function renderQueryTasks() {
  const tasks = getQueryTasksForOption(state.data, state.activeOptionId);
  queryTaskListEl.innerHTML = tasks.map((task) => `
    <article class="task-card priority-${escapeHtml(task.priority)}">
      <div>
        <strong>${escapeHtml(task.title_zh)}</strong>
        <p>${escapeHtml(task.why_it_matters_zh)}</p>
        <p class="muted">${escapeHtml(task.success_criteria_zh)}</p>
      </div>
      <span>${escapeHtml(statusLabel(task.status))}</span>
    </article>
  `).join("");
}

function renderRisks() {
  const active = activeSummary();
  riskPanelEl.innerHTML = active.risks.map((risk) => `<p class="risk-line">${escapeHtml(risk)}</p>`).join("");
}

function render() {
  renderRecommendation();
  renderTabs();
  renderDailyItinerary();
  renderQueryTasks();
  renderRisks();
}

optionTabsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-option-id]");
  if (!button) return;
  state.activeOptionId = button.dataset.optionId;
  render();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([createEgyptItineraryExportPayload(state.data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "egypt_itinerary.updated.json";
  link.click();
  URL.revokeObjectURL(url);
});

render();
```

- [ ] **Step 5: Update CSS**

Modify `app/styles.css` to include these class groups:

```css
.egypt-planner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px;
}

.recommendation-panel,
.option-tabs,
.planner-grid,
.side-stack {
  margin-top: 16px;
}

.option-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.option-tabs button {
  border: 1px solid #d8dee8;
  background: #fff;
  border-radius: 8px;
  padding: 14px;
  text-align: left;
}

.option-tabs button.active {
  border-color: #1167b1;
  background: #eef6ff;
}

.option-tabs span,
.muted {
  color: #667085;
}

.planner-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.75fr);
  gap: 16px;
}

.side-stack {
  display: grid;
  gap: 16px;
}

.day-card,
.task-card,
.summary-card {
  border: 1px solid #e3e8ef;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
}

.day-card + .day-card,
.task-card + .task-card {
  margin-top: 10px;
}

.day-head,
.summary-card,
.task-card {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.day-blocks {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.day-block {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
}

.risk-high {
  background: #fff1f0;
}

.priority-high {
  border-color: #f04438;
}

.score-pill {
  white-space: nowrap;
  align-self: start;
  border-radius: 999px;
  background: #eef6ff;
  padding: 6px 10px;
}

@media (max-width: 820px) {
  .option-tabs,
  .planner-grid {
    grid-template-columns: 1fr;
  }
}
```

If existing CSS contains conflicting old table styles, leave them only if harmless; do not keep old table-first layout as the primary visual hierarchy.

- [ ] **Step 6: Verify app tests pass**

Run:

```bash
node tests/egypt_itinerary_app.test.mjs
node tests/dashboard_app.test.mjs
```

Expected: both PASS and print `egypt_itinerary_app tests passed`.

---

### Task 5: Verification And Documentation

**Files:**
- Modify: `scripts/verify_dashboard.mjs`
- Modify: `README.md`
- Test: all Egypt planner tests.

**Interfaces:**
- Consumes: v3 data/build/core/app from Tasks 1-4.
- Produces: full verification command set.

- [ ] **Step 1: Update dashboard verifier**

Modify `scripts/verify_dashboard.mjs` to verify v3 instead of v2 as the primary dashboard:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getOptionSummaries, getRecommendation } from "../app/egypt-itinerary-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const generated = fs.readFileSync(path.join(rootDir, "app", "egypt-itinerary-data.js"), "utf8");

if (!generated.startsWith("window.EGYPT_ITINERARY_DATA = ")) {
  throw new Error("Generated Egypt itinerary data is missing global assignment");
}

for (const text of ["option-tabs", "recommendation", "daily-itinerary", "query-task-list", "risk-panel", "egypt-itinerary-data.js"]) {
  if (!html.includes(text)) throw new Error(`index.html missing ${text}`);
}

for (const text of ["待助手查询", "A1", "A2", "阿布辛贝", "createEgyptItineraryExportPayload"]) {
  const combined = `${html}\n${app}\n${generated}`;
  if (!combined.includes(text)) throw new Error(`Egypt planner missing ${text}`);
}

const data = JSON.parse(generated.replace(/^window\.EGYPT_ITINERARY_DATA = /, "").replace(/;\s*$/, ""));
const summaries = getOptionSummaries(data);
const recommendation = getRecommendation(data);

if (recommendation.recommended_option_id !== "A1_HRG_BALANCED") {
  throw new Error("Default recommendation must be A1_HRG_BALANCED");
}
if (!summaries.find((summary) => summary.id === "A2_ABU_SIMBEL_HRG")?.risks.join(" ").includes("早班")) {
  throw new Error("A2 must expose early return risk");
}
if (`${html}\n${app}`.match(/用户自行查询|你自己查|请自行查询/)) {
  throw new Error("Page copy must not assign query work to user");
}

console.log("egypt dashboard verification passed");
```

- [ ] **Step 2: Update README**

Replace the dashboard section in `README.md` with:

```markdown
## 埃及段行程规划器

当前项目已收敛为埃及段规划：不再处理中国国内段。

固定约束：

- 2026-09-30 09:00 到达开罗
- 2026-10-07 14:45 从开罗起飞

生成页面数据：

```bash
node scripts/build_egypt_itinerary_data.mjs
```

启动本地页面：

```bash
cd /Users/xixinyu.simona/projects/路径规划/.worktrees/live-price-comparison
python3 -m http.server 8000
```

访问：

```text
http://localhost:8000/app/
```

Planner v3 支持：

- 对比 A1「开罗 + 卢克索 + 赫尔格达」和 A2「开罗 + 阿布辛贝 + 卢克索 + 赫尔格达」
- 按天展示上午、下午、晚上怎么安排
- 明确说明为什么阿布辛贝方案先去阿斯旺再去卢克索
- 标出 A2 的 10/7 赫尔格达早班回开罗风险
- 把查询任务标记为「待助手查询」，不是让用户自己查
- 不保存密码、cookie、token
```

- [ ] **Step 3: Run full verification**

Run:

```bash
node tests/egypt_itinerary_validation.test.mjs
node tests/egypt_itinerary_core.test.mjs
node tests/egypt_itinerary_build.test.mjs
node tests/egypt_itinerary_app.test.mjs
node tests/dashboard_app.test.mjs
node scripts/validate_egypt_itinerary.mjs data/egypt_itinerary_options.json
node scripts/build_egypt_itinerary_data.mjs
node scripts/verify_dashboard.mjs
```

Expected: all commands exit 0.

- [ ] **Step 4: Start local server**

Run:

```bash
python3 -m http.server 8000
```

Expected: server starts and `curl -I http://localhost:8000/app/` returns `200 OK`.

- [ ] **Step 5: Browser or equivalent visual check**

Open:

```text
http://localhost:8000/app/
```

If browser policy blocks localhost, do not bypass it. Report that browser visual inspection was blocked and rely on:

```bash
curl -I http://localhost:8000/app/
node scripts/verify_dashboard.mjs
node tests/egypt_itinerary_app.test.mjs
```

Expected page evidence:

- Header says `埃及段行程规划`.
- A1 and A2 tabs are visible.
- A1 is the default recommendation.
- A2 contains `阿布辛贝`.
- Query task copy says `待助手查询`.
- No copy says the user should query by themselves.
