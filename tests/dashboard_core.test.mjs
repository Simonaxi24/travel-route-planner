import assert from "node:assert/strict";
import {
  summarizeBranches,
  scoreBranches,
  getItemPrice,
  setItemPrice,
  getItemRisks,
  createExportPayload
} from "../app/dashboard-core.js";

const data = {
  metadata: { currency: "CNY" },
  branches: [
    { id: "S3_HRG", name: "HRG" },
    { id: "S3_SSH", name: "SSH" }
  ],
  flights: [
    { id: "shared", branch_ids: ["S3_HRG", "S3_SSH"], selected: true, price_cny: 1000, duration_minutes: 100, checked_baggage_included: "unknown", confidence_level: "low", notes: "confirm exact date" },
    { id: "hrg", branch_ids: ["S3_HRG"], selected: true, price_cny: 500, duration_minutes: 50, checked_baggage_included: "yes", confidence_level: "medium" },
    { id: "ssh", branch_ids: ["S3_SSH"], selected: false, price_cny: 100, duration_minutes: 20, checked_baggage_included: "yes", confidence_level: "high" }
  ],
  hotels: [
    { id: "hotel-hrg", branch_ids: ["S3_HRG"], selected: true, nights: 2, price_cny_total: 2000, meal_plan: "breakfast available", room_type: "confirm sea-view room", confidence_level: "medium" },
    { id: "hotel-ssh", branch_ids: ["S3_SSH"], selected: true, nights: 2, price_cny_total: 1500, meal_plan: "all-inclusive", confidence_level: "high" }
  ],
  activities: [
    { id: "act-hrg", branch_ids: ["S3_HRG"], selected: true, price_cny_total_for_2: 800, confidence_level: "high" },
    { id: "act-ssh", branch_ids: ["S3_SSH"], selected: true, price_cny_total_for_2: 600, confidence_level: "high" }
  ],
  ground_transport: [
    { id: "ground-hrg", branch_ids: ["S3_HRG"], selected: true, price_cny_total: 400, duration_minutes: 200, confidence_level: "low" },
    { id: "ground-ssh", branch_ids: ["S3_SSH"], selected: true, price_cny_total: 200, duration_minutes: 60, confidence_level: "medium" }
  ]
};

assert.equal(getItemPrice(data.flights[0], "flights"), 1000);
assert.equal(getItemPrice(data.hotels[0], "hotels"), 2000);
assert.equal(getItemPrice(data.activities[0], "activities"), 800);
assert.equal(getItemPrice(data.ground_transport[0], "ground_transport"), 400);

const editedFlight = setItemPrice(data.flights[0], "flights", 1234);
assert.equal(editedFlight.price_cny, 1234);
assert.notEqual(editedFlight, data.flights[0]);

const risks = getItemRisks(data.flights[0], "flights");
assert.ok(risks.includes("托运行李待确认"));
assert.ok(risks.includes("低置信度价格"));
assert.ok(risks.includes("需确认"));

const hotelRisks = getItemRisks(data.hotels[0], "hotels");
assert.ok(hotelRisks.includes("餐食/房型待确认"));

const summaries = summarizeBranches(data);
const hrg = summaries.find((summary) => summary.branch_id === "S3_HRG");
const ssh = summaries.find((summary) => summary.branch_id === "S3_SSH");
assert.equal(hrg.total_trip_cny, 4700);
assert.equal(hrg.total_travel_minutes, 350);
assert.equal(ssh.total_trip_cny, 3300);
assert.equal(ssh.total_travel_minutes, 160);

const scored = scoreBranches(summaries);
assert.equal(scored[0].branch_id, "S3_SSH");
assert.equal(scored[0].total_score, 100);

const exported = JSON.parse(createExportPayload(data));
assert.equal(exported.branches.length, 2);
assert.equal(exported.metadata.currency, "CNY");

console.log("dashboard_core tests passed");
