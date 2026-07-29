import assert from "node:assert/strict";
import { summarizeBranches, scoreBranches } from "../scripts/live_price_scoring.mjs";

const data = {
  branches: [
    { id: "S3_HRG", name: "HRG" },
    { id: "S3_SSH", name: "SSH" }
  ],
  flights: [
    { branch_ids: ["S3_HRG", "S3_SSH"], price_cny: 1000, duration_minutes: 120, checked_baggage_included: "yes" },
    { branch_ids: ["S3_HRG"], price_cny: 500, duration_minutes: 60, checked_baggage_included: "unknown" },
    { branch_ids: ["S3_SSH"], price_cny: 300, duration_minutes: 40, checked_baggage_included: "yes" }
  ],
  hotels: [
    { branch_ids: ["S3_HRG"], price_cny_total: 2000 },
    { branch_ids: ["S3_HRG"], price_cny_total: 9999, selected: false },
    { branch_ids: ["S3_SSH"], price_cny_total: 1500 }
  ],
  activities: [
    { branch_ids: ["S3_HRG"], price_cny_total_for_2: 800 },
    { branch_ids: ["S3_SSH"], price_cny_total_for_2: 600 },
    { branch_ids: ["S3_SSH"], price_cny_total_for_2: 9999, selected: false }
  ],
  ground_transport: [
    { branch_ids: ["S3_HRG"], price_cny_total: 400, duration_minutes: 240 },
    { branch_ids: ["S3_SSH"], price_cny_total: 200, duration_minutes: 60 }
  ]
};

const summaries = summarizeBranches(data);
const hrg = summaries.find((summary) => summary.branch_id === "S3_HRG");
const ssh = summaries.find((summary) => summary.branch_id === "S3_SSH");

assert.equal(hrg.total_trip_cny, 4700);
assert.equal(hrg.total_travel_minutes, 420);
assert.equal(hrg.checked_baggage_risk_count, 1);
assert.equal(ssh.total_trip_cny, 3600);
assert.equal(ssh.total_travel_minutes, 220);

const scored = scoreBranches(summaries);
assert.equal(scored[0].branch_id, "S3_SSH");
assert.equal(scored[0].price_score, 100);
assert.equal(scored[0].time_score, 100);
assert.ok(scored[1].total_score < 100);

console.log("live_price_scoring tests passed");
