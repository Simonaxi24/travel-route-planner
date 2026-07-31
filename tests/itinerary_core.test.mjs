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

const unrecordedMissingData = structuredClone(data);
unrecordedMissingData.scenarios.push({
  id: "S3_UNRECORDED_MISSING",
  label_zh: "缺少未记录航段",
  departure_date: "2026-10-01",
  branch_id: "S3_SSH",
  required_segment_keys: ["out", "return", "domestic"],
  selected_candidate_ids: ["out-a"],
  selected_hotel_ids: [],
  selected_activity_ids: [],
  selected_ground_transport_ids: []
});
const unrecordedMissing = summarizeScenarios(unrecordedMissingData).find(
  (summary) => summary.id === "S3_UNRECORDED_MISSING"
);
assert.equal(unrecordedMissing.is_feasible, false);
assert.deepEqual(unrecordedMissing.missing_segment_keys, ["return", "domestic"]);
assert.deepEqual(unrecordedMissing.missing_segments, []);

const scored = scoreFeasibleScenarios(summaries);
assert.equal(scored[0].id, "S3_SSH_DEP0929");
assert.equal(scored[0].total_score, 100);
assert.equal(scored.find((summary) => summary.id === "S3_HRG_DEP0930").total_score, null);

const scoredWithStaleInfeasible = scoreFeasibleScenarios([
  {
    id: "stale-infeasible",
    is_feasible: false,
    total_trip_cny: 1,
    total_travel_minutes: 1,
    price_score: 999,
    time_score: 999,
    total_score: 999
  },
  {
    id: "fresh-feasible",
    is_feasible: true,
    total_trip_cny: 1000,
    total_travel_minutes: 100,
    price_score: null,
    time_score: null,
    total_score: null
  }
]);
assert.equal(scoredWithStaleInfeasible[0].id, "fresh-feasible");
assert.equal(scoredWithStaleInfeasible.find((summary) => summary.id === "stale-infeasible").price_score, null);
assert.equal(scoredWithStaleInfeasible.find((summary) => summary.id === "stale-infeasible").time_score, null);
assert.equal(scoredWithStaleInfeasible.find((summary) => summary.id === "stale-infeasible").total_score, null);

const edited = setCandidatePrice(data, "return-a", 4200);
assert.equal(edited.flight_candidates.find((candidate) => candidate.id === "return-a").price_cny, 4200);
assert.equal(data.flight_candidates.find((candidate) => candidate.id === "return-a").price_cny, 3600);

const editedFromString = setCandidatePrice(data, "return-a", "4200");
assert.equal(editedFromString.flight_candidates.find((candidate) => candidate.id === "return-a").price_cny, 4200);

for (const invalidPrice of ["", "0", "-1"]) {
  const rejected = setCandidatePrice(data, "return-a", invalidPrice);
  assert.equal(
    rejected.flight_candidates.find((candidate) => candidate.id === "return-a").price_cny,
    3600
  );
}

const exported = JSON.parse(createItineraryExportPayload(edited));
assert.equal(exported.metadata.currency, "CNY");

console.log("itinerary_core tests passed");
