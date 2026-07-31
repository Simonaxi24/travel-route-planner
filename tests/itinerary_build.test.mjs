import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

execFileSync("node", ["scripts/build_itinerary_data.mjs"], { stdio: "pipe" });
const generated = fs.readFileSync("app/itinerary-data.js", "utf8");
assert.ok(generated.startsWith("window.ITINERARY_DATA = "));
assert.match(generated, /S3_SSH_DEP0929/);
assert.match(generated, /待查询/);

console.log("itinerary_build tests passed");
