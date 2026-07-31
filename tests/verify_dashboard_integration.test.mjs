import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const output = execFileSync("node", ["scripts/verify_dashboard.mjs"], { encoding: "utf8" });

assert.match(output, /dashboard integration checks passed/);
assert.match(output, /dashboard verification passed/);

console.log("verify_dashboard integration tests passed");
