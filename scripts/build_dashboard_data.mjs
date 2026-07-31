import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateLiveOptions } from "./validate_live_options.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const inputPath = path.join(rootDir, "data", "live_price_options.json");
const outputDir = path.join(rootDir, "app");
const outputPath = path.join(outputDir, "live-price-data.js");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateLiveOptions(data);

const generated = `window.LIVE_PRICE_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, generated);
console.log(`Wrote ${outputPath}`);
