import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getOptionSummaries, getRecommendation } from "../app/egypt-itinerary-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(rootDir, "app", "index.html"), "utf8");
const app = fs.readFileSync(path.join(rootDir, "app", "app.js"), "utf8");
const generated = fs.readFileSync(path.join(rootDir, "app", "egypt-itinerary-data.js"), "utf8");

if (!generated.startsWith("window.EGYPT_ITINERARY_DATA = ")) {
  throw new Error("Generated Egypt itinerary data is missing global assignment");
}

for (const text of ["option-tabs", "recommendation", "daily-itinerary", "query-task-list", "risk-panel", "egypt-itinerary-data.js"]) {
  if (!html.includes(text)) throw new Error(`index.html missing ${text}`);
}

for (const text of ["待我查询", "实际订票/预订入口", "Trip.com", "Skyscanner", "助手保存候选", "标记未找到", "A1", "A2", "阿布辛贝", "createEgyptItineraryExportPayload"]) {
  const combined = `${html}\n${app}\n${generated}`;
  if (!combined.includes(text)) throw new Error(`Egypt planner missing ${text}`);
}

if (`${html}\n${app}\n${generated}`.includes("google.com/search")) {
  throw new Error("Planner must use booking platforms, not Google search links");
}

const data = JSON.parse(generated.replace(/^window\.EGYPT_ITINERARY_DATA = /, "").replace(/;\s*$/, ""));
const summaries = getOptionSummaries(data);
const recommendation = getRecommendation(data);
const optionIds = data.options.map((option) => option.id).sort();

if (JSON.stringify(optionIds) !== JSON.stringify(["A1_HRG_BALANCED", "A2_ABU_SIMBEL_HRG"])) {
  throw new Error("Egypt planner must render only A1 and A2 options");
}

if (!data.query_tasks.every((task) => task.owner === "assistant")) {
  throw new Error("Every query task must be owned by assistant");
}

if (recommendation.recommended_option_id !== "A1_HRG_BALANCED") {
  throw new Error("Default recommendation must be A1_HRG_BALANCED");
}

if (!summaries.find((summary) => summary.id === "A2_ABU_SIMBEL_HRG")?.risks.join(" ").includes("早班")) {
  throw new Error("A2 must expose early return risk");
}

if (`${html}\n${app}\n${generated}`.match(/用户自行查询|你自己查|请自行查询/)) {
  throw new Error("Page copy must not assign query work to user");
}

console.log("dashboard integration checks passed");
console.log("egypt dashboard verification passed");
