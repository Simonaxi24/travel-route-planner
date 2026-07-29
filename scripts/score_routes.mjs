import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "..", "data", "route_candidates.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const weights = data.metadata.weights;
const candidates = data.candidates;
const minPrice = Math.min(...candidates.map((candidate) => candidate.price_usd));
const minTime = Math.min(...candidates.map((candidate) => candidate.travel_hours));

const scored = candidates
  .map((candidate) => {
    const priceScore = (minPrice / candidate.price_usd) * 100;
    const timeScore = (minTime / candidate.travel_hours) * 100;
    const totalScore = priceScore * weights.price + timeScore * weights.time;
    return {
      id: candidate.id,
      name: candidate.name,
      price_usd: candidate.price_usd,
      travel_hours: candidate.travel_hours,
      price_score: Number(priceScore.toFixed(1)),
      time_score: Number(timeScore.toFixed(1)),
      total_score: Number(totalScore.toFixed(1))
    };
  })
  .sort((a, b) => b.total_score - a.total_score);

console.table(scored);
