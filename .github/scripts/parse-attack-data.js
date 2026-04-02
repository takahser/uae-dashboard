#!/usr/bin/env node
/**
 * parse-attack-data.js
 * Parse tweet cache and extract structured attack data using regex patterns.
 * Runs daily via CI to process new tweets from tweet-cache/{country}.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DRY_RUN = process.env.DRY_RUN === "true";

const COUNTRIES = ["uae", "bahrain", "qatar", "saudi", "israel", "iran"];

// --- Helpers ---

function arabicToWestern(s) {
  return s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
}

function formatLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function tweetDate(timeStr) {
  return timeStr.slice(0, 10); // "YYYY-MM-DD"
}

function calculateTotal(entry) {
  let total = 0;
  if (entry.reportingType === "engaged") {
    if (typeof entry.ballisticEngaged === "number") total += entry.ballisticEngaged;
    if (typeof entry.cruiseEngaged === "number") total += entry.cruiseEngaged;
    if (typeof entry.dronesEngaged === "number") total += entry.dronesEngaged;
  } else {
    if (typeof entry.ballisticIntercepted === "number") total += entry.ballisticIntercepted;
    if (typeof entry.cruiseIntercepted === "number") total += entry.cruiseIntercepted;
    if (typeof entry.dronesIntercepted === "number") total += entry.dronesIntercepted;
  }
  // Fallback: try detected fields
  if (total === 0) {
    if (typeof entry.ballisticDetected === "number") total += entry.ballisticDetected;
    if (typeof entry.cruiseDetected === "number") total += entry.cruiseDetected;
    if (typeof entry.dronesDetected === "number") total += entry.dronesDetected;
  }
  return total || undefined;
}

// --- Regex extraction ---

function extractUae(text) {
  const t = arabicToWestern(text);

  // New format (post Mar 13): "engaged X Ballistic missiles, Y Cruise Missiles and Z UAVs"
  const engagedWithCruise = t.match(/engaged\s+(\d+)\s+ballistic\s+missiles?\s*,\s*(\d+)\s+cruise\s+missiles?\s+and\s+(\d+)\s+UAVs?/i);
  if (engagedWithCruise) {
    return {
      reportingType: "engaged",
      ballisticEngaged: parseInt(engagedWithCruise[1]),
      cruiseEngaged: parseInt(engagedWithCruise[2]),
      dronesEngaged: parseInt(engagedWithCruise[3]),
    };
  }

  // New format: "engaged X Ballistic missiles and Y UAVs" (comma or no comma variants)
  const engaged = t.match(/engaged\s+(\d+)\s+ballistic\s+missiles?\s*(?:,\s*|\s+and\s+)(\d+)\s+UAVs?/i);
  if (engaged) {
    return {
      reportingType: "engaged",
      ballisticEngaged: parseInt(engaged[1]),
      dronesEngaged: parseInt(engaged[2]),
    };
  }

  // Old format (pre Mar 13): "intercepted X ballistic missiles" ... "Y UAVs"
  const ballisticMatch = t.match(/intercepted\s+(\d+)\s+ballistic\s+missiles?/i);
  const uavMatch = t.match(/(\d+)\s+UAVs?/i);
  if (ballisticMatch) {
    const entry = {
      reportingType: "intercepted",
      ballisticIntercepted: parseInt(ballisticMatch[1]),
    };
    if (uavMatch) entry.dronesIntercepted = parseInt(uavMatch[1]);
    return entry;
  }

  return null;
}

function extractBahrain(text) {
  const t = arabicToWestern(text);

  const ballisticMatch = t.match(/(\d+)\s*صاروخ/);
  const droneMatch = t.match(/(\d+)\s*طائر(?:ة|ات)\s*مسيرة/);

  if (!ballisticMatch && !droneMatch) return null;

  const entry = { reportingType: "intercepted" };
  if (ballisticMatch) entry.ballisticIntercepted = parseInt(ballisticMatch[1]);
  if (droneMatch) entry.dronesIntercepted = parseInt(droneMatch[1]);
  return entry;
}

const EXTRACTORS = {
  uae: extractUae,
  bahrain: extractBahrain,
};

function extractFromTweet(country, tweet) {
  const extractor = EXTRACTORS[country];
  if (!extractor) return null;
  return extractor(tweet.text);
}

// --- Merge Logic ---

function mergeEntries(data, entries) {
  const existingDates = new Set(data.daily.map(e => e.date));
  let added = 0, skipped = 0;

  for (const entry of entries) {
    if (existingDates.has(entry.date)) {
      skipped++;
      continue;
    }

    const dailyEntry = {
      date: entry.date,
      label: formatLabel(entry.date),
      source: entry.source,
    };

    const fields = [
      "reportingType",
      "ballisticDetected", "ballisticIntercepted", "ballisticEngaged", "ballisticImpacted",
      "cruiseDetected", "cruiseIntercepted", "cruiseEngaged",
      "dronesDetected", "dronesIntercepted", "dronesEngaged", "dronesImpacted",
      "killed", "injured", "notes",
    ];

    for (const field of fields) {
      if (entry[field] !== undefined && entry[field] !== null) {
        dailyEntry[field] = entry[field];
      }
    }

    const total = calculateTotal(dailyEntry);
    if (total !== undefined) dailyEntry.total = total;

    data.daily.push(dailyEntry);
    existingDates.add(entry.date);
    added++;
  }

  data.daily.sort((a, b) => a.date.localeCompare(b.date));
  return { added, skipped };
}

// --- Cumulative Recalculation ---

function recalculateCumulative(data) {
  const cum = {};

  const sumFields = [
    "ballisticDetected", "ballisticIntercepted", "ballisticEngaged", "ballisticImpacted",
    "cruiseDetected", "cruiseIntercepted", "cruiseEngaged", "cruiseImpacted",
    "dronesDetected", "dronesIntercepted", "dronesEngaged", "dronesImpacted",
    "killed", "injured",
  ];

  for (const field of sumFields) {
    const hasValue = data.daily.some(e => typeof e[field] === "number");
    if (hasValue) {
      cum[field] = data.daily.reduce((acc, e) =>
        acc + (typeof e[field] === "number" ? e[field] : 0), 0);
    }
  }

  // Aggregate totals for ballistic/drones across reporting types
  const ballisticEngagedSum = data.daily.reduce((acc, e) =>
    acc + (typeof e.ballisticEngaged === "number" ? e.ballisticEngaged : 0), 0);
  const dronesEngagedSum = data.daily.reduce((acc, e) =>
    acc + (typeof e.dronesEngaged === "number" ? e.dronesEngaged : 0), 0);

  if (ballisticEngagedSum > 0) {
    cum.ballistic = (cum.ballisticDetected || 0) + ballisticEngagedSum;
  }
  if (dronesEngagedSum > 0) {
    cum.drones = (cum.dronesDetected || 0) + dronesEngagedSum;
  }

  // Preserve fields not derived from daily entries
  const preserveFields = ["notes", "killedMilitary", "killedCivilian", "ballisticSea", "cruiseSea", "dronesSea"];
  for (const field of preserveFields) {
    if (data.cumulative && data.cumulative[field] !== undefined) {
      cum[field] = data.cumulative[field];
    }
  }

  // Preserve cumulative fields set from tweet cumulative data (only if higher)
  const cumulativeOnlyFields = ["ballistic", "cruise", "drones"];
  for (const field of cumulativeOnlyFields) {
    if (data.cumulative && typeof data.cumulative[field] === "number") {
      if (typeof cum[field] !== "number" || data.cumulative[field] > cum[field]) {
        cum[field] = data.cumulative[field];
      }
    }
  }

  data.cumulative = cum;
}

// --- Per-Country Processing ---

function processCountry(country) {
  console.log(`\nProcessing ${country}...`);

  // 1. Load tweet cache
  const cachePath = path.join(ROOT, `.github/scripts/tweet-cache/${country}.json`);
  if (!fs.existsSync(cachePath)) {
    console.log(`  Skipped: no cache file`);
    return { country, status: "skipped", reason: "no cache file" };
  }
  const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));

  // 2. Load country data
  const dataPath = path.join(ROOT, `public/data-${country}.json`);
  const data = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath, "utf-8"))
    : { daily: [], cumulative: {}, lastUpdated: null };

  if (!data.cumulative) data.cumulative = {};
  if (!data.daily) data.daily = [];

  // 3. Filter new tweets (after lastUpdated)
  const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : new Date(0);
  const newTweets = cache.tweets.filter(t => new Date(t.time) > lastUpdated);

  if (newTweets.length === 0) {
    console.log(`  Skipped: no new tweets (lastUpdated: ${data.lastUpdated})`);
    return { country, status: "skipped", reason: "no new tweets" };
  }

  console.log(`  Found ${newTweets.length} new tweets (after ${data.lastUpdated || "epoch"})`);

  // 4. Extract via regex
  const entries = [];
  let noMatch = 0;
  for (const tweet of newTweets) {
    const extracted = extractFromTweet(country, tweet);
    if (extracted) {
      entries.push({
        ...extracted,
        date: tweetDate(tweet.time),
        source: tweet.url,
      });
    } else {
      noMatch++;
    }
  }
  console.log(`  Regex extracted ${entries.length} entries, ${noMatch} unmatched`);

  if (entries.length === 0) {
    console.log(`  No extractable data`);
    return { country, status: "skipped", reason: "no regex matches" };
  }

  // 5. Merge entries (idempotent)
  const { added, skipped } = mergeEntries(data, entries);
  console.log(`  Merged: ${added} added, ${skipped} skipped`);

  // 6. Recalculate cumulative
  recalculateCumulative(data);

  // 7. Update lastUpdated
  data.lastUpdated = new Date().toISOString();

  // 8. Write back
  if (DRY_RUN) {
    console.log(`  DRY RUN — would write to ${dataPath}`);
    console.log(`  New daily entries: ${JSON.stringify(data.daily.slice(-3), null, 2)}`);
  } else {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`  Wrote ${dataPath}`);
  }

  return { country, status: "updated", added, skipped };
}

// --- Main ---

function main() {
  console.log("=== parse-attack-data.js (regex) ===");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);

  const log = [];

  for (const country of COUNTRIES) {
    const result = processCountry(country);
    log.push(result);
  }

  // Write processing log
  const logPath = path.join(ROOT, ".github/scripts/parse-attack-data.log");
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + "\n");
  console.log(`\nLog written to ${logPath}`);

  // Summary
  console.log("\n=== Summary ===");
  for (const entry of log) {
    const detail = entry.added !== undefined ? ` (+${entry.added} entries)` : "";
    console.log(`  ${entry.country}: ${entry.status}${detail}`);
  }
}

main();
