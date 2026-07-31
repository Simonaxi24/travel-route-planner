import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

execFileSync("node", ["scripts/build_egypt_itinerary_data.mjs"], { stdio: "pipe" });
const generated = fs.readFileSync("app/egypt-itinerary-data.js", "utf8");
const html = fs.readFileSync("app/index.html", "utf8");
const data = JSON.parse(generated.replace(/^window\.EGYPT_ITINERARY_DATA = /, "").replace(/;\s*$/, ""));

assert.ok(generated.startsWith("window.EGYPT_ITINERARY_DATA = "));
assert.match(generated, /A1_HRG_BALANCED/);
assert.match(generated, /A2_ABU_SIMBEL_HRG/);
assert.match(generated, /待助手查询/);
assert.deepEqual(data.options.map((option) => option.id).sort(), ["A1_HRG_BALANCED", "A2_ABU_SIMBEL_HRG"]);
assert.equal(data.query_tasks.every((task) => task.owner === "assistant"), true);
assert.match(html, /query-workbench/);
assert.match(html, /app\.js\?v=/);
assert.match(html, /styles\.css\?v=/);
assert.doesNotMatch(html, /<script src="\.\/itinerary-data\.js"><\/script>/);
assert.match(html, /<script src="\.\/egypt-itinerary-data\.js"><\/script>\s*<script type="module" src="\.\/app\.js\?v=[^"]+"><\/script>/);
assert.match(html, /<script type="module" src="\.\/app\.js\?v=[^"]+"><\/script>/);

console.log("egypt_itinerary_build tests passed");
