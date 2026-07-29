import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveOptions } from "./validate_live_options.mjs";
import { summarizeBranches, scoreBranches } from "./live_price_scoring.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = process.argv[2] || path.join(__dirname, "..", "data", "live_price_options.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const validation = validateLiveOptions(data);
const summaries = summarizeBranches(data);
const scored = scoreBranches(summaries);

console.table(scored.map((summary) => ({
  branch: summary.branch_id,
  total_cny: summary.total_trip_cny,
  per_person_cny: summary.total_trip_cny_per_person,
  travel_hours: Number((summary.total_travel_minutes / 60).toFixed(1)),
  baggage_risks: summary.checked_baggage_risk_count,
  price_score: summary.price_score,
  time_score: summary.time_score,
  total_score: summary.total_score
})));

if (validation.warnings.length) {
  console.log("Warnings:");
  for (const warning of validation.warnings) console.log(`- ${warning}`);
}
