function includesBranch(item, branchId) {
  return item.branch_ids.includes(branchId);
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function selectedItems(items) {
  return items.filter((item) => item.selected !== false);
}

function round1(value) {
  return Number(value.toFixed(1));
}

function scoreRatio(best, current) {
  if (!current || !best) return 0;
  return best / current * 100;
}

export function summarizeBranches(data) {
  return data.branches.map((branch) => {
    const flights = data.flights.filter((item) => includesBranch(item, branch.id));
    const hotels = data.hotels.filter((item) => includesBranch(item, branch.id));
    const activities = data.activities.filter((item) => includesBranch(item, branch.id));
    const groundTransport = data.ground_transport.filter((item) => includesBranch(item, branch.id));

    const selectedFlights = selectedItems(flights);
    const selectedHotels = selectedItems(hotels);
    const selectedActivities = selectedItems(activities);
    const selectedGroundTransport = selectedItems(groundTransport);

    const totalFlightCny = sum(selectedFlights, "price_cny");
    const totalHotelCny = sum(selectedHotels, "price_cny_total");
    const totalActivityCny = sum(selectedActivities, "price_cny_total_for_2");
    const totalGroundTransportCny = sum(selectedGroundTransport, "price_cny_total");
    const totalTripCny = totalFlightCny + totalHotelCny + totalActivityCny + totalGroundTransportCny;
    const totalTravelMinutes = sum(selectedFlights, "duration_minutes") + sum(selectedGroundTransport, "duration_minutes");

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
      hotel_nights: sum(selectedHotels, "nights"),
      checked_baggage_risk_count: selectedFlights.filter((flight) => flight.checked_baggage_included !== "yes").length,
      self_transfer_risk_count: selectedFlights.filter((flight) => String(flight.layover_summary || "").includes("self-transfer")).length,
      experience_summary: branch.experience_summary || ""
    };
  });
}

export function scoreBranches(summaries) {
  const priced = summaries.filter((summary) => summary.total_trip_cny > 0);
  const timed = summaries.filter((summary) => summary.total_travel_minutes > 0);
  const minPrice = priced.length ? Math.min(...priced.map((summary) => summary.total_trip_cny)) : 0;
  const minTime = timed.length ? Math.min(...timed.map((summary) => summary.total_travel_minutes)) : 0;

  return summaries
    .map((summary) => {
      const priceScore = scoreRatio(minPrice, summary.total_trip_cny);
      const timeScore = scoreRatio(minTime, summary.total_travel_minutes);
      return {
        ...summary,
        price_score: round1(priceScore),
        time_score: round1(timeScore),
        total_score: round1(priceScore * 0.5 + timeScore * 0.5)
      };
    })
    .sort((a, b) => b.total_score - a.total_score);
}
