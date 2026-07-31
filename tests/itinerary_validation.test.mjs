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

const malformedDate = structuredClone(valid);
malformedDate.flight_candidates[0].date = "2026/09/29";
assert.throws(
  () => validateItineraryData(malformedDate),
  /flight-bjs-cai-a.*date/
);

const malformedDepartureTime = structuredClone(valid);
malformedDepartureTime.flight_candidates[0].departure_time_local = "soon";
assert.throws(
  () => validateItineraryData(malformedDepartureTime),
  /flight-bjs-cai-a.*departure_time_local/
);

const malformedSearchedAt = structuredClone(valid);
malformedSearchedAt.flight_candidates[0].searched_at = "later";
assert.throws(
  () => validateItineraryData(malformedSearchedAt),
  /flight-bjs-cai-a.*searched_at/
);

const nonBooleanDirect = structuredClone(valid);
nonBooleanDirect.flight_candidates[0].is_direct = 0;
assert.throws(
  () => validateItineraryData(nonBooleanDirect),
  /flight-bjs-cai-a.*is_direct/
);

const stringStopsCount = structuredClone(valid);
stringStopsCount.flight_candidates[1].stops_count = "1";
assert.throws(
  () => validateItineraryData(stringStopsCount),
  /flight-cai-bjs-a.*stops_count/
);

const fractionalStopsCount = structuredClone(valid);
fractionalStopsCount.flight_candidates[1].stops_count = 1.5;
assert.throws(
  () => validateItineraryData(fractionalStopsCount),
  /flight-cai-bjs-a.*stops_count/
);

const negativeStopsCount = structuredClone(valid);
negativeStopsCount.flight_candidates[1].stops_count = -1;
assert.throws(
  () => validateItineraryData(negativeStopsCount),
  /flight-cai-bjs-a.*stops_count/
);

const indirectWithoutStops = structuredClone(valid);
indirectWithoutStops.flight_candidates[1].stops_count = 0;
assert.throws(
  () => validateItineraryData(indirectWithoutStops),
  /flight-cai-bjs-a.*non-direct.*stops/
);

const notFoundOnDirectFlight = structuredClone(valid);
notFoundOnDirectFlight.flight_candidates[0].direct_search_result = "not_found";
notFoundOnDirectFlight.flight_candidates[0].stopover_summary_zh = "未找到直飞";
notFoundOnDirectFlight.flight_candidates[0].notes_zh = "未找到直飞";
assert.throws(
  () => validateItineraryData(notFoundOnDirectFlight),
  /flight-bjs-cai-a.*not_found.*non-direct/
);

const stringArrivalOffset = structuredClone(valid);
stringArrivalOffset.flight_candidates[1].arrival_date_offset = "1";
assert.throws(
  () => validateItineraryData(stringArrivalOffset),
  /flight-cai-bjs-a.*arrival_date_offset/
);

const emptyFlightNumbers = structuredClone(valid);
emptyFlightNumbers.flight_candidates[0].flight_numbers = [];
assert.throws(
  () => validateItineraryData(emptyFlightNumbers),
  /flight-bjs-cai-a.*flight_numbers/
);

const notFoundWithoutExplicitWording = structuredClone(valid);
notFoundWithoutExplicitWording.flight_candidates[1].stopover_summary_zh = "迪拜中转 3小时10分";
notFoundWithoutExplicitWording.flight_candidates[1].notes_zh = "计入中转候选";
assert.throws(
  () => validateItineraryData(notFoundWithoutExplicitWording),
  /flight-cai-bjs-a.*未找到直飞/
);

const invalidSourceUrl = structuredClone(valid);
invalidSourceUrl.flight_candidates[0].source_url = "ftp://example.com/flight";
assert.throws(
  () => validateItineraryData(invalidSourceUrl),
  /flight-bjs-cai-a.*source_url/
);

const malformedSourceUrl = structuredClone(valid);
malformedSourceUrl.flight_candidates[0].source_url = "not a url";
assert.throws(
  () => validateItineraryData(malformedSourceUrl),
  /flight-bjs-cai-a.*source_url/
);

const duplicateSelectedSegment = structuredClone(valid);
duplicateSelectedSegment.scenarios[0].selected_candidate_ids = [
  "flight-bjs-cai-a",
  "flight-bjs-cai-a",
  "flight-cai-bjs-a"
];
assert.throws(
  () => validateItineraryData(duplicateSelectedSegment),
  /S3_SSH_DEP0929.*duplicate selected segment.*bjs-cai-outbound/
);

const selectedOutsideRequiredRoute = structuredClone(valid);
selectedOutsideRequiredRoute.scenarios[0].selected_candidate_ids.push("flight-extra-domestic");
selectedOutsideRequiredRoute.flight_candidates.push({
  ...structuredClone(valid.flight_candidates[0]),
  id: "flight-extra-domestic",
  segment_key: "extra-domestic",
  date: "2026-10-01",
  from_city_zh: "开罗",
  to_city_zh: "卢克索",
  origin_airport_zh: "开罗",
  origin_airport_code: "CAI",
  destination_airport_zh: "卢克索",
  destination_airport_code: "LXR",
  departure_time_local: "08:00",
  arrival_time_local: "09:00",
  arrival_date_offset: 0,
  flight_numbers: ["MS060"],
  price_cny: 500,
  duration_minutes: 60,
  notes_zh: "额外航段"
});
assert.throws(
  () => validateItineraryData(selectedOutsideRequiredRoute),
  /S3_SSH_DEP0929.*extra-domestic.*required_segment_keys/
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
