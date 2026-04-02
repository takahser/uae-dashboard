#!/usr/bin/env node
/**
 * backfill-attack-data.js
 * One-off script: query KB database for attack tweets (Mar 24 – today),
 * extract structured counts via regex, and merge into public/data-{country}.json.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DB_PATH = "/Users/chou/repos/xpost-automation/memory/kb.db";
const DRY_RUN = process.env.DRY_RUN === "true";
const CACHE_DIR = "/tmp/backfill-cache";

const ATTACK_KEYWORDS = /missile|drone|ballistic|intercept|strike|UAV|rocket|صاروخ|طائرة مسيرة|اعتراض|تعامل/i;

// --- Country mapping ---

const COUNTRY_QUERIES = {
  uae: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-03-24'
            AND author_handle IN ('modgovae')
          ORDER BY received_at`,
  },
  bahrain: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-03-24'
            AND author_handle IN ('BDF_Bahrain', 'dd_geopolitics')
          ORDER BY received_at`,
    contentFilter: /bahrain|manama/i,
  },
};

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

// --- Merge logic ---

function calculateTotal(entry) {
  if (entry.reportingType === "engaged") {
    let t = 0;
    if (typeof entry.ballisticEngaged === "number") t += entry.ballisticEngaged;
    if (typeof entry.cruiseEngaged === "number") t += entry.cruiseEngaged;
    if (typeof entry.dronesEngaged === "number") t += entry.dronesEngaged;
    return t || undefined;
  }
  let t = 0;
  if (typeof entry.ballisticIntercepted === "number") t += entry.ballisticIntercepted;
  if (typeof entry.cruiseIntercepted === "number") t += entry.cruiseIntercepted;
  if (typeof entry.dronesIntercepted === "number") t += entry.dronesIntercepted;
  return t || undefined;
}

function mergeIntoData(data, entries) {
  const existingDates = new Set(data.daily.map((e) => e.date));
  let added = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (existingDates.has(entry.date)) { skipped++; continue; }

    const daily = { date: entry.date, label: formatLabel(entry.date), source: entry.source };
    const fields = [
      "reportingType",
      "ballisticDetected", "ballisticIntercepted", "ballisticEngaged", "ballisticImpacted",
      "cruiseDetected", "cruiseIntercepted", "cruiseEngaged",
      "dronesDetected", "dronesIntercepted", "dronesEngaged", "dronesImpacted",
      "killed", "injured", "notes",
    ];
    for (const f of fields) {
      if (entry[f] !== undefined && entry[f] !== null) daily[f] = entry[f];
    }
    const total = calculateTotal(daily);
    if (total !== undefined) daily.total = total;

    data.daily.push(daily);
    existingDates.add(entry.date);
    added++;
  }

  data.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recalculate cumulative sums from daily
  if (!data.cumulative) data.cumulative = {};
  const sumFields = [
    "ballisticDetected", "ballisticIntercepted", "ballisticEngaged", "ballisticImpacted",
    "cruiseDetected", "cruiseIntercepted", "cruiseEngaged",
    "dronesDetected", "dronesIntercepted", "dronesEngaged", "dronesImpacted",
    "killed", "injured",
  ];
  for (const f of sumFields) {
    const sum = data.daily.reduce((a, e) => a + (typeof e[f] === "number" ? e[f] : 0), 0);
    if (sum > 0) data.cumulative[f] = sum;
  }

  return { added, skipped };
}

// --- Main ---

async function main() {
  console.log("=== backfill-attack-data.js (regex) ===");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);

  const db = new Database(DB_PATH, { readonly: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  for (const [country, cfg] of Object.entries(COUNTRY_QUERIES)) {
    console.log(`\n--- ${country} ---`);

    // 1. Query DB
    const rows = db.prepare(cfg.sql).all();
    console.log(`  DB rows: ${rows.length}`);

    // 2. Filter by content (if needed) and attack keywords
    let tweets = rows;
    if (cfg.contentFilter) {
      tweets = tweets.filter((r) => cfg.contentFilter.test(r.content));
      console.log(`  After country content filter: ${tweets.length}`);
    }
    tweets = tweets.filter((r) => ATTACK_KEYWORDS.test(r.content));
    console.log(`  After attack keyword filter: ${tweets.length}`);

    if (tweets.length === 0) {
      console.log(`  No matching tweets, skipping.`);
      continue;
    }

    // 3. Build cache format
    const account = `@${tweets[0].author_handle}`;
    const cacheTweets = tweets.map((r) => ({
      text: r.content,
      time: r.received_at,
      url: `https://x.com/${r.author_handle}/status/${r.tweet_id}`,
    }));

    const cacheData = {
      account,
      country,
      fetchedAt: new Date().toISOString(),
      tweets: cacheTweets,
    };

    // 4. Write temp cache
    const cachePath = path.join(CACHE_DIR, `${country}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2) + "\n");
    console.log(`  Wrote cache: ${cachePath} (${cacheTweets.length} tweets)`);

    // 5. Extract via regex
    const entries = [];
    let noMatch = 0;
    for (const tweet of cacheTweets) {
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

    // 6. Load existing data and merge
    const dataPath = path.join(ROOT, `public/data-${country}.json`);
    const data = fs.existsSync(dataPath)
      ? JSON.parse(fs.readFileSync(dataPath, "utf-8"))
      : { daily: [], cumulative: {}, lastUpdated: null };
    if (!data.daily) data.daily = [];
    if (!data.cumulative) data.cumulative = {};

    const before = data.daily.length;
    const { added, skipped } = mergeIntoData(data, entries);
    data.lastUpdated = new Date().toISOString();

    console.log(`  Merged: +${added} new, ${skipped} skipped (was ${before}, now ${data.daily.length})`);

    if (added > 0 && !DRY_RUN) {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
      console.log(`  Updated ${dataPath}`);
    } else if (DRY_RUN) {
      console.log(`  DRY_RUN — not writing`);
    }
  }

  db.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
