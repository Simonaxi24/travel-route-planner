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
    },
    {
      id: "S3_HRG_DEP0929",
      label_zh: "9/29 出发 · 开罗 + 卢克索 + 赫尔格达",
      departure_date: "2026-09-29",
      branch_id: "S3_HRG",
      required_segment_keys: ["out", "cai-lxr", "lxr-hrg", "hrg-cai", "return"],
      selected_candidate_ids: ["out-a", "return-a"],
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
      reason_zh: "用户已查到 10/6 无直飞；仍需录入具体中转候选"
    },
    {
      scenario_ids: ["S3_HRG_DEP0929"],
      segment_key: "cai-lxr",
      date: "2026-10-01",
      from_city_zh: "开罗",
      to_city_zh: "卢克索",
      status_zh: "待查询",
      reason_zh: "尚未录入具体候选"
    },
    {
      scenario_ids: ["S3_HRG_DEP0929"],
      segment_key: "lxr-hrg",
      date: "2026-10-03",
      from_city_zh: "卢克索",
      to_city_zh: "赫尔格达",
      status_zh: "待查询",
      reason_zh: "尚未录入具体候选"
    },
    {
      scenario_ids: ["S3_HRG_DEP0929"],
      segment_key: "hrg-cai",
      date: "2026-10-05",
      from_city_zh: "赫尔格达",
      to_city_zh: "开罗",
      status_zh: "待查询",
      reason_zh: "尚未录入具体候选"
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

const hrgScenarioButton = {
  dataset: { scenarioId: "S3_HRG_DEP0929" },
  closest() {
    return this;
  }
};
controls.listeners.click({ target: hrgScenarioButton });
assert.ok(
  timeline.innerHTML.indexOf("10月1日") < timeline.innerHTML.indexOf("10月6日"),
  "HRG timeline should render 10月1日 before 10月6日"
);

const scenarioButton = {
  dataset: { scenarioId: "S3_SSH_DEP0930" },
  closest() {
    return this;
  }
};
controls.listeners.click({ target: scenarioButton });
assert.match(timeline.innerHTML, /待查询/);
assert.match(`${timeline.innerHTML}\n${risks.innerHTML}`, /未找到直飞/);
assert.match(summary.innerHTML, /不可评分/);

const editedRow = { dataset: { candidateId: "out-b" } };
const priceInput = {
  value: "3300",
  classList: new FakeClassList("itinerary-price-input"),
  closest() {
    return editedRow;
  }
};
const candidatePanelHtmlBeforeInput = candidatePanel.innerHTML;
candidatePanel.listeners.input({ target: priceInput });
assert.equal(candidatePanel.innerHTML, candidatePanelHtmlBeforeInput);
assert.match(timeline.innerHTML, /¥3,300/);

console.log("itinerary_app tests passed");
