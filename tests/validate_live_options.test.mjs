import assert from "node:assert/strict";
import { validateLiveOptions } from "../scripts/validate_live_options.mjs";

const validData = {
  metadata: {
    created_at: "2026-07-29",
    last_checked_at: "2026-07-29T12:00:00+08:00",
    currency: "CNY",
    exchange_rates: [{ pair: "USD_CNY", rate: 7.2, source: "manual", checked_at: "2026-07-29" }]
  },
  branches: [
    { id: "S3_HRG", name: "方案3：开罗+卢克索+赫尔格达" },
    { id: "S3_SSH", name: "方案3：开罗+沙姆沙伊赫" }
  ],
  flights: [
    {
      id: "flight-domestic-bjs-lhw",
      branch_ids: ["S3_HRG", "S3_SSH"],
      date: "2026-09-24",
      origin: "BJS",
      destination: "LHW",
      platform: "Ctrip",
      carrier: "public-search",
      departure_time: "evening",
      arrival_time: "night",
      duration_minutes: 165,
      price_cny: 900,
      checked_baggage_included: "unknown",
      booking_url_or_search_url: "https://www.ctrip.com/",
      confidence_level: "low"
    }
  ],
  hotels: [],
  activities: [],
  ground_transport: [],
  source_notes: []
};

assert.equal(validateLiveOptions(validData).ok, true);

const invalidData = structuredClone(validData);
delete invalidData.metadata.currency;
assert.throws(() => validateLiveOptions(invalidData), /metadata.currency/);

const invalidBranch = structuredClone(validData);
invalidBranch.flights[0].branch_ids = ["BAD_BRANCH"];
assert.throws(() => validateLiveOptions(invalidBranch), /Unknown branch id BAD_BRANCH/);

console.log("validate_live_options tests passed");
