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
  if (category === "hotels" && /unknown|confirm/i.test(`${item.meal_plan || ""} ${item.room_type || ""}`)) risks.push("餐食/房型待确认");
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
