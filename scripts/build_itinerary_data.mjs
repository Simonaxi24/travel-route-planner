import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateItineraryData } from "./validate_itinerary_scenarios.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const inputPath = path.join(rootDir, "data", "itinerary_scenarios.json");
const outputDir = path.join(rootDir, "app");
const outputPath = path.join(outputDir, "itinerary-data.js");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateItineraryData(data);

const generated = `window.ITINERARY_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, generated);
console.log(`Wrote ${outputPath}`);
