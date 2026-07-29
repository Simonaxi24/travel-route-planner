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
