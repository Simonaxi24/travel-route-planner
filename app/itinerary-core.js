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
    const isFeasible = missingSegmentKeys.length === 0;
    return {
      ...scenario,
      is_feasible: isFeasible,
      selected_flights: selectedFlights,
      missing_segments: missingRecords.filter((record) => missingSegmentKeys.includes(record.segment_key)),
      missing_segment_keys: missingSegmentKeys,
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
    if (!summary.is_feasible) {
      return {
        ...summary,
        price_score: null,
        time_score: null,
        total_score: null
      };
    }
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
  const parsedPrice = Number(price);
  if (candidate && Number.isFinite(parsedPrice) && parsedPrice > 0) {
    candidate.price_cny = parsedPrice;
  }
  return next;
}

export function createItineraryExportPayload(data) {
  return JSON.stringify(data, null, 2);
}
