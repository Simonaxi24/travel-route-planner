import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getOptionSummaries,
  getRecommendation,
  getDaysForOption,
  getQueryTasksForOption,
  applyTransportCandidate,
  createEgyptItineraryExportPayload
} from "../app/egypt-itinerary-core.js";

const data = JSON.parse(fs.readFileSync("data/egypt_itinerary_options.json", "utf8"));

const summaries = getOptionSummaries(data);
assert.equal(summaries.length, 2);
assert.equal(summaries[0].id, "A1_HRG_BALANCED");
assert.equal(summaries.find((item) => item.id === "A2_ABU_SIMBEL_HRG").includes_abu_simbel, true);
assert.equal(summaries.find((item) => item.id === "A2_ABU_SIMBEL_HRG").red_sea_time_level_zh, "压缩");

const recommendation = getRecommendation(data);
assert.equal(recommendation.recommended_option_id, "A1_HRG_BALANCED");
assert.match(recommendation.reason_zh, /完整红海日/);
assert.match(recommendation.tradeoff_zh, /阿布辛贝/);

const a2Days = getDaysForOption(data, "A2_ABU_SIMBEL_HRG");
assert.equal(a2Days.length, 8);
assert.ok(a2Days.some((day) => day.blocks.some((block) => block.title_zh.includes("阿布辛贝"))));

const a2Tasks = getQueryTasksForOption(data, "A2_ABU_SIMBEL_HRG");
assert.equal(a2Tasks.every((task) => task.owner === "assistant"), true);
assert.equal(a2Tasks.find((task) => task.id === "a2-hrg-cai-1007-early").priority, "high");

const mediumRiskA2Data = structuredClone(data);
mediumRiskA2Data.options.find((option) => option.id === "A2_ABU_SIMBEL_HRG").risk_level = "medium";
const withLateCandidate = applyTransportCandidate(mediumRiskA2Data, "a2-hrg-cai-1007-early", {
  id: "candidate-hrg-cai-late",
  task_id: "a2-hrg-cai-1007-early",
  source_platform: "EgyptAir",
  source_url: "https://example.com",
  searched_at: "2026-07-30T10:00:00+08:00",
  type: "transport",
  from_city_zh: "赫尔格达",
  to_city_zh: "开罗",
  date: "2026-10-07",
  departure_time_local: "10:35",
  arrival_time_local: "11:35",
  duration_minutes: 60,
  price_cny: 800,
  notes_zh: "到达晚于 11:00"
});
const lateA2 = getOptionSummaries(withLateCandidate).find((item) => item.id === "A2_ABU_SIMBEL_HRG");
assert.equal(lateA2.risk_level, "high");
assert.ok(lateA2.risks.some((risk) => risk.includes("晚于 11:00")));

const withEarlyCandidate = applyTransportCandidate(data, "a2-hrg-cai-1007-early", {
  id: "candidate-hrg-cai-early",
  task_id: "a2-hrg-cai-1007-early",
  source_platform: "EgyptAir",
  source_url: "https://example.com",
  searched_at: "2026-07-30T10:00:00+08:00",
  type: "transport",
  from_city_zh: "赫尔格达",
  to_city_zh: "开罗",
  date: "2026-10-07",
  departure_time_local: "07:30",
  arrival_time_local: "08:30",
  duration_minutes: 60,
  price_cny: 800,
  notes_zh: "可衔接国际航班"
});
const earlyA2 = getOptionSummaries(withEarlyCandidate).find((item) => item.id === "A2_ABU_SIMBEL_HRG");
assert.equal(earlyA2.risks.some((risk) => risk.includes("晚于 11:00")), false);

const exported = JSON.parse(createEgyptItineraryExportPayload(withEarlyCandidate));
assert.ok(exported.researched_candidates.some((candidate) => candidate.id === "candidate-hrg-cai-early"));

console.log("egypt_itinerary_core tests passed");
