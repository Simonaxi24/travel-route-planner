import fs from "node:fs";
import { fileURLToPath } from "node:url";

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

const requiredScenarioFields = [
  "id",
  "label_zh",
  "departure_date",
  "branch_id",
  "required_segment_keys",
  "selected_candidate_ids",
  "selected_hotel_ids",
  "selected_activity_ids",
  "selected_ground_transport_ids"
];

const requiredMissingSegmentFields = [
  "scenario_ids",
  "segment_key",
  "date",
  "from_city_zh",
  "to_city_zh",
  "status_zh",
  "reason_zh"
];

const allowedBaggage = new Set(["yes", "no", "unknown"]);
const allowedConfidence = new Set(["high", "medium", "low"]);
const allowedDirectSearchResult = new Set(["found", "not_found", "not_checked"]);
const placeholderPattern = /target|placeholder|direct or one-stop|TBD|待定|待人工确认|待查询/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoLikeTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function assertPresent(object, field, context) {
  if (object[field] === undefined || object[field] === null || object[field] === "") {
    throw new Error(`${context} missing ${field}`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function assertNoPlaceholder(value, field, context) {
  if (placeholderPattern.test(String(value))) {
    throw new Error(`${context} has placeholder ${field}: ${value}`);
  }
}

function assertStringPattern(value, field, context, pattern, formatDescription) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${context} ${field} must be ${formatDescription}`);
  }
}

function assertBoolean(value, field, context) {
  if (typeof value !== "boolean") {
    throw new Error(`${context} ${field} must be boolean`);
  }
}

function assertFiniteNumber(value, field, context) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} ${field} must be a finite number`);
  }
}

function assertNonNegativeInteger(value, field, context) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${context} ${field} must be a non-negative integer`);
  }
}

function assertPositiveNumber(value, field, context) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${context} ${field} must be positive`);
  }
}

function assertHttpUrl(value, field, context) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return;
  } catch {
    // Throw the shared validation message below.
  }
  throw new Error(`${context} ${field} must be an HTTP(S) URL`);
}

export function validateItineraryData(data) {
  if (!data.metadata || data.metadata.currency !== "CNY") {
    throw new Error("metadata.currency must be CNY");
  }
  for (const field of requiredRootArrays) {
    assertArray(data[field], field);
  }

  const scenarioIds = new Set();
  for (const scenario of data.scenarios) {
    for (const field of requiredScenarioFields) {
      assertPresent(scenario, field, scenario.id || "scenario");
    }
    for (const field of ["required_segment_keys", "selected_candidate_ids", "selected_hotel_ids", "selected_activity_ids", "selected_ground_transport_ids"]) {
      assertArray(scenario[field], `${scenario.id}.${field}`);
    }
    scenarioIds.add(scenario.id);
  }

  for (const candidate of data.flight_candidates) {
    for (const field of requiredFlightFields) {
      assertPresent(candidate, field, candidate.id || "flight candidate");
      if (typeof candidate[field] === "string") assertNoPlaceholder(candidate[field], field, candidate.id);
    }
    assertArray(candidate.scenario_ids, `${candidate.id}.scenario_ids`);
    if (candidate.scenario_ids.length === 0) {
      throw new Error(`${candidate.id} scenario_ids must be non-empty`);
    }
    for (const scenarioId of candidate.scenario_ids) {
      if (!scenarioIds.has(scenarioId)) {
        throw new Error(`${candidate.id} has unknown scenario ${scenarioId}`);
      }
    }
    assertArray(candidate.flight_numbers, `${candidate.id}.flight_numbers`);
    if (candidate.flight_numbers.length === 0) {
      throw new Error(`${candidate.id} flight_numbers must be non-empty`);
    }
    for (const flightNumber of candidate.flight_numbers) {
      if (typeof flightNumber !== "string" || flightNumber === "") {
        throw new Error(`${candidate.id} flight_numbers must contain non-empty strings`);
      }
      assertNoPlaceholder(flightNumber, "flight_numbers", candidate.id);
    }
    assertStringPattern(candidate.date, "date", candidate.id, datePattern, "YYYY-MM-DD");
    assertStringPattern(candidate.departure_time_local, "departure_time_local", candidate.id, timePattern, "HH:MM");
    assertStringPattern(candidate.arrival_time_local, "arrival_time_local", candidate.id, timePattern, "HH:MM");
    assertStringPattern(candidate.searched_at, "searched_at", candidate.id, isoLikeTimestampPattern, "an ISO-like timestamp");
    assertHttpUrl(candidate.source_url, "source_url", candidate.id);
    assertBoolean(candidate.is_direct, "is_direct", candidate.id);
    assertNonNegativeInteger(candidate.stops_count, "stops_count", candidate.id);
    assertFiniteNumber(candidate.arrival_date_offset, "arrival_date_offset", candidate.id);
    if (!allowedDirectSearchResult.has(candidate.direct_search_result)) {
      throw new Error(`${candidate.id} direct_search_result invalid`);
    }
    if (
      candidate.direct_search_result === "not_found" &&
      (candidate.is_direct || candidate.stops_count < 1)
    ) {
      throw new Error(`${candidate.id} direct_search_result not_found requires a non-direct candidate with stops`);
    }
    if (
      candidate.direct_search_result === "not_found" &&
      !`${candidate.stopover_summary_zh} ${candidate.notes_zh}`.includes("未找到直飞")
    ) {
      throw new Error(`${candidate.id} direct_search_result not_found requires 未找到直飞 in stopover_summary_zh or notes_zh`);
    }
    if (!allowedBaggage.has(candidate.checked_baggage_included)) {
      throw new Error(`${candidate.id} checked_baggage_included invalid`);
    }
    if (!allowedConfidence.has(candidate.confidence_level)) {
      throw new Error(`${candidate.id} confidence_level invalid`);
    }
    if (candidate.is_direct && candidate.stops_count !== 0) {
      throw new Error(`${candidate.id} direct flight cannot have stops`);
    }
    if (!candidate.is_direct && candidate.stops_count < 1) {
      throw new Error(`${candidate.id} non-direct flight must have at least 1 stops`);
    }
    assertPositiveNumber(candidate.price_cny, "price_cny", candidate.id);
    assertPositiveNumber(candidate.duration_minutes, "duration_minutes", candidate.id);
  }

  const missingByScenarioAndSegment = new Set();
  for (const segment of data.missing_segments) {
    for (const field of requiredMissingSegmentFields) {
      assertPresent(segment, field, segment.segment_key || "missing segment");
    }
    assertArray(segment.scenario_ids, `${segment.segment_key}.scenario_ids`);
    if (segment.status_zh !== "待查询") {
      throw new Error(`${segment.segment_key} missing segment status_zh must be 待查询`);
    }
    for (const scenarioId of segment.scenario_ids) {
      if (!scenarioIds.has(scenarioId)) {
        throw new Error(`${segment.segment_key} has unknown scenario ${scenarioId}`);
      }
      missingByScenarioAndSegment.add(`${scenarioId}:${segment.segment_key}`);
    }
  }

  const candidatesById = new Map(data.flight_candidates.map((candidate) => [candidate.id, candidate]));
  const warnings = [];

  for (const scenario of data.scenarios) {
    const selectedSegmentKeys = new Set();
    const requiredSegmentKeys = new Set(scenario.required_segment_keys);
    for (const candidateId of scenario.selected_candidate_ids) {
      const candidate = candidatesById.get(candidateId);
      if (!candidate) throw new Error(`${scenario.id} selected missing candidate ${candidateId}`);
      if (!candidate.scenario_ids.includes(scenario.id)) {
        throw new Error(`${scenario.id} selected candidate ${candidateId} is not linked to scenario`);
      }
      if (!requiredSegmentKeys.has(candidate.segment_key)) {
        throw new Error(`${scenario.id} selected candidate ${candidateId} segment ${candidate.segment_key} is outside required_segment_keys`);
      }
      if (selectedSegmentKeys.has(candidate.segment_key)) {
        throw new Error(`${scenario.id} has duplicate selected segment ${candidate.segment_key}`);
      }
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inputPath = process.argv[2];
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(JSON.stringify(validateItineraryData(data), null, 2));
}
