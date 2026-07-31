import fs from "node:fs";
import { fileURLToPath } from "node:url";

const allowedPeriods = new Set(["morning", "afternoon", "evening"]);
const allowedBlockTypes = new Set(["arrival", "departure", "sight", "transfer", "hotel", "meal", "rest", "activity"]);
const allowedRiskLevels = new Set(["low", "medium", "high"]);
const allowedTaskStatuses = new Set([
  "assistant_pending",
  "searching",
  "blocked_by_login",
  "blocked_by_captcha",
  "blocked_by_sms",
  "no_result_found",
  "found_candidates",
  "selected",
  "needs_retry"
]);
const allowedCandidateVerificationLevels = new Set([
  "baseline",
  "live_search",
  "schedule_cross_checked",
  "blocked",
  "final_verified"
]);
const allowedPriceStatuses = new Set([
  "exact_live",
  "live_price_blocked",
  "reference_only",
  "date_price_needed",
  "unknown"
]);
const allowedBaggageStatuses = new Set(["included", "unknown", "not_included"]);
const chinaDomesticPattern = /北京.*兰州|兰州.*长春|长春.*北京|LHW|CGQ|中国国内段/;

function assertArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
}

function assertPresent(object, field, context) {
  if (object[field] === undefined || object[field] === null || object[field] === "") {
    throw new Error(`${context} missing ${field}`);
  }
}

function assertNoDomesticLeak(value) {
  if (chinaDomesticPattern.test(String(value))) {
    throw new Error(`China domestic segment leaked: ${value}`);
  }
}

function assertRisk(value, context) {
  if (!allowedRiskLevels.has(value)) throw new Error(`${context} risk_level invalid`);
}

function validateFixedMetadata(metadata) {
  if (metadata.currency !== "CNY") throw new Error("metadata.currency must be CNY");
  if (metadata.fixed_arrival?.city_zh !== "开罗") throw new Error("fixed_arrival city must be 开罗");
  if (metadata.fixed_arrival?.date !== "2026-09-30") throw new Error("fixed_arrival date must be 2026-09-30");
  if (metadata.fixed_arrival?.time !== "09:00") throw new Error("fixed_arrival time must be 09:00");
  if (metadata.fixed_departure?.city_zh !== "开罗") throw new Error("fixed_departure city must be 开罗");
  if (metadata.fixed_departure?.date !== "2026-10-07") throw new Error("fixed_departure date must be 2026-10-07");
  if (metadata.fixed_departure?.time !== "14:45") throw new Error("fixed_departure time must be 14:45");
  if (!String(metadata.assistant_query_policy_zh || "").includes("待助手查询")) {
    throw new Error("assistant query policy must say 待助手查询");
  }
}

function validateOption(option) {
  for (const field of ["id", "name_zh", "positioning_zh", "route_order_zh", "includes_abu_simbel", "default_recommendation", "risk_level", "hotel_nights", "recommendation_zh"]) {
    assertPresent(option, field, option.id || "option");
  }
  assertArray(option.route_order_zh, `${option.id}.route_order_zh`);
  assertRisk(option.risk_level, option.id);
  for (const value of [option.name_zh, option.positioning_zh, option.recommendation_zh, option.route_order_zh.join(" → ")]) {
    assertNoDomesticLeak(value);
  }
  if (option.id === "A2_ABU_SIMBEL_HRG") {
    const expectedOrder = ["开罗", "阿斯旺/阿布辛贝", "卢克索", "赫尔格达", "开罗"];
    if (option.route_order_zh.join("|") !== expectedOrder.join("|")) {
      throw new Error("A2 route order must be 开罗 → 阿斯旺/阿布辛贝 → 卢克索 → 赫尔格达 → 开罗");
    }
    if (!option.includes_abu_simbel) throw new Error("A2 must include 阿布辛贝");
  }
}

function validateDay(day, optionIds) {
  for (const field of ["option_id", "date", "city_zh", "blocks"]) {
    assertPresent(day, field, day.option_id || "day");
  }
  if (!optionIds.has(day.option_id)) throw new Error(`day has unknown option ${day.option_id}`);
  assertArray(day.blocks, `${day.option_id}.${day.date}.blocks`);
  assertNoDomesticLeak(day.city_zh);
  for (const block of day.blocks) {
    for (const field of ["period", "title_zh", "type", "risk_level", "must_book"]) {
      assertPresent(block, field, `${day.option_id}.${day.date}.block`);
    }
    if (!allowedPeriods.has(block.period)) throw new Error(`${block.title_zh} period invalid`);
    if (!allowedBlockTypes.has(block.type)) throw new Error(`${block.title_zh} type invalid`);
    assertRisk(block.risk_level, block.title_zh);
    if (typeof block.must_book !== "boolean") throw new Error(`${block.title_zh} must_book must be boolean`);
    assertNoDomesticLeak(block.title_zh);
  }
}

function validateQueryTask(task, optionIds) {
  for (const field of ["id", "option_ids", "category", "title_zh", "why_it_matters_zh", "success_criteria_zh", "priority", "status", "owner"]) {
    assertPresent(task, field, task.id || "query task");
  }
  assertArray(task.option_ids, `${task.id}.option_ids`);
  for (const optionId of task.option_ids) {
    if (!optionIds.has(optionId)) throw new Error(`${task.id} has unknown option ${optionId}`);
  }
  if (task.owner !== "assistant") throw new Error(`query task ${task.id} owner must be assistant`);
  if (!allowedTaskStatuses.has(task.status)) throw new Error(`${task.id} status invalid`);
  assertNoDomesticLeak(`${task.title_zh} ${task.why_it_matters_zh} ${task.success_criteria_zh}`);
}

function validateDayTaskLinks(days, queryTaskIds) {
  for (const day of days) {
    for (const block of day.blocks) {
      if (block.query_task_ids === undefined) continue;
      assertArray(block.query_task_ids, `${day.option_id}.${day.date}.${block.title_zh}.query_task_ids`);
      for (const taskId of block.query_task_ids) {
        if (!queryTaskIds.has(taskId)) {
          throw new Error(`unknown query task link ${taskId}`);
        }
      }
    }
  }
}

function optionHasAswan(option, days) {
  const routeText = option.route_order_zh.join(" ");
  const hotelText = Object.keys(option.hotel_nights).join(" ");
  const dayText = days
    .filter((day) => day.option_id === option.id)
    .flatMap((day) => [day.city_zh, ...day.blocks.map((block) => block.title_zh)])
    .join(" ");
  return `${routeText} ${hotelText} ${dayText}`.includes("阿斯旺");
}

function optionHasAbuSimbelDay(option, days) {
  return days
    .filter((day) => day.option_id === option.id)
    .some((day) => `${day.city_zh} ${day.blocks.map((block) => block.title_zh).join(" ")}`.includes("阿布辛贝"));
}

function validateAswanRequiresAbuSimbel(option, days) {
  if (!optionHasAswan(option, days)) return;
  if (!option.includes_abu_simbel) {
    throw new Error(`${option.id} includes 阿斯旺, so includes_abu_simbel must be true and days must include 阿布辛贝`);
  }
  if (!optionHasAbuSimbelDay(option, days)) {
    throw new Error(`${option.id} includes 阿斯旺, so days must include 阿布辛贝`);
  }
}

function validateNoResultFallback(a2Option, a2EarlyReturn) {
  if (a2EarlyReturn.status !== "no_result_found") return;
  const fallbackCopy = `${a2Option.recommendation_zh || ""} ${a2Option.fallback_zh || ""}`;
  if (!fallbackCopy.includes("10/6") || !fallbackCopy.includes("回开罗")) {
    throw new Error("A2 no_result_found fallback must include 10/6 and 回开罗 guidance");
  }
}

function validateCandidate(candidate, queryTaskIds) {
  for (const field of ["id", "task_id", "title_zh", "source_platform", "searched_at", "type", "date", "notes_zh"]) {
    assertPresent(candidate, field, candidate.id || "candidate");
  }
  if (!queryTaskIds.has(candidate.task_id)) throw new Error(`${candidate.id} has unknown task_id`);
  if (candidate.verification_level && !allowedCandidateVerificationLevels.has(candidate.verification_level)) {
    throw new Error(`${candidate.id} verification_level invalid`);
  }
  if (candidate.price_status && !allowedPriceStatuses.has(candidate.price_status)) {
    throw new Error(`${candidate.id} price_status invalid`);
  }
  if (candidate.checked_baggage_included && !allowedBaggageStatuses.has(candidate.checked_baggage_included)) {
    throw new Error(`${candidate.id} checked_baggage_included invalid`);
  }
  if (candidate.flight_numbers !== undefined) assertArray(candidate.flight_numbers, `${candidate.id}.flight_numbers`);
  if (candidate.verification_level === "baseline" && candidate.price_status === "exact_live") {
    throw new Error(`${candidate.id} cannot be baseline and exact_live`);
  }
  assertNoDomesticLeak(`${candidate.title_zh} ${candidate.notes_zh}`);
}

export function validateEgyptItineraryData(data) {
  if (!data.metadata) throw new Error("metadata missing");
  validateFixedMetadata(data.metadata);
  for (const field of ["options", "days", "query_tasks", "researched_candidates"]) {
    assertArray(data[field], field);
  }

  const optionIds = new Set();
  const optionById = new Map();
  for (const option of data.options) {
    validateOption(option);
    optionIds.add(option.id);
    optionById.set(option.id, option);
  }
  if (!optionIds.has("A1_HRG_BALANCED")) throw new Error("A1 option missing");
  if (!optionIds.has("A2_ABU_SIMBEL_HRG")) throw new Error("A2 option missing");

  for (const day of data.days) validateDay(day, optionIds);
  for (const task of data.query_tasks) validateQueryTask(task, optionIds);
  const queryTaskIds = new Set(data.query_tasks.map((task) => task.id));
  validateDayTaskLinks(data.days, queryTaskIds);
  for (const candidate of data.researched_candidates) validateCandidate(candidate, queryTaskIds);
  for (const option of data.options) validateAswanRequiresAbuSimbel(option, data.days);

  const warnings = [];
  const a2EarlyReturn = data.query_tasks.find((task) => task.id === "a2-hrg-cai-1007-early");
  if (!a2EarlyReturn) throw new Error("A2 must include 10/7 Hurghada to Cairo early query task");
  if (a2EarlyReturn.priority !== "high") throw new Error("A2 10/7 early return task must be high priority");
  validateNoResultFallback(optionById.get("A2_ABU_SIMBEL_HRG"), a2EarlyReturn);

  return { ok: true, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inputPath = process.argv[2];
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  console.log(JSON.stringify(validateEgyptItineraryData(data), null, 2));
}
