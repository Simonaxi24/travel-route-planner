import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEgyptItineraryData } from "./validate_egypt_itinerary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const inputPath = path.join(rootDir, "data", "egypt_itinerary_options.json");
const outputPath = path.join(rootDir, "app", "egypt-itinerary-data.js");

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
validateEgyptItineraryData(data);
const source = `window.EGYPT_ITINERARY_DATA = ${JSON.stringify(data, null, 2)};\n`;
fs.writeFileSync(outputPath, source);
console.log(`Wrote ${outputPath}`);
