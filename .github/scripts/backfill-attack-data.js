#!/usr/bin/env node
/**
 * backfill-attack-data.js
 * One-off script: query KB database for attack tweets (Mar 24 - today),
 * extract structured counts via Claude CLI, and merge into public/data-{country}.json.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DB_PATH = "/Users/chou/repos/xpost-automation/memory/kb.db";
const DRY_RUN = process.env.DRY_RUN === "true";
const CACHE_DIR = "/tmp/backfill-cache";
const BATCH_SIZE = 20;

const ATTACK_KEYWORDS = /missile|drone|ballistic|intercept|strike|UAV|rocket|صاروخ|طائرة مسيرة|اعتراض|تعامل/i;

// --- Country mapping ---

const COUNTRY_QUERIES = {
  uae: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-02-28'
            AND author_handle IN ('modgovae')
          ORDER BY received_at`,
  },
  bahrain: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-02-28'
            AND author_handle IN ('BDF_Bahrain', 'dd_geopolitics')
          ORDER BY received_at`,
    contentFilter: /bahrain|manama/i,
  },
  kuwait: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-02-28'
            AND author_handle IN ('KuwaitArmyGHQ')
          ORDER BY received_at`,
  },
  oman: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-02-28'
            AND author_handle IN ('ONA_eng')
          ORDER BY received_at`,
  },
  iran: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-03-12'
            AND author_handle IN ('MKhamenei_ir', 'khamenei_ir')
          ORDER BY received_at`,
  },
  qatar: {
    sql: `SELECT tweet_id, author_handle, content, received_at
          FROM tweet_queue
          WHERE relevant = 1
            AND received_at >= '2026-02-28'
            AND author_handle IN ('MOD_Qatar', 'QNAEnglish')
          ORDER BY received_at`,
  },
};

// --- Claude CLI ---

function callClaude(prompt) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force Claude Code subscription
  const result = spawnSync("claude", ["--print", "--output-format", "json"], {
    input: prompt,
    encoding: "utf8",
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || "claude failed");
  const out = JSON.parse(result.stdout);
  return out.result || out.content || "";
}

const SYSTEM_PROMPT = `You are a military data extractor. Extract structured attack data from official MoD tweets. Return ONLY valid JSON — no prose. If a tweet has no numeric attack data, skip it.

IMPORTANT — Bahrain (BDF_Bahrain): Bahrain tweets report CUMULATIVE running totals (e.g. "اعتراض وتدمير X صاروخ و Y طائرة مسيرة"), NOT daily counts. Only extract an entry if the numbers are higher than the previous cumulative value in the existing data. Each entry should contain the new cumulative totals, not a delta.`;

function buildUserPrompt(country, tweets) {
  const schema = `{
  "entries": [
    {
      "date": "YYYY-MM-DD (from tweet timestamp)",
      "reportingType": "engaged" or "intercepted",
      "ballisticEngaged": number (omit if not present),
      "ballisticIntercepted": number (omit if not present),
      "cruiseEngaged": number (omit if not present),
      "cruiseIntercepted": number (omit if not present),
      "dronesEngaged": number (omit if not present),
      "dronesIntercepted": number (omit if not present),
      "total": sum of all detected/engaged/intercepted counts,
      "source": "tweet URL"
    }
  ],
  "skipped": ["url: reason", ...]
}`;

  const tweetBlock = tweets
    .map(
      (t, i) =>
        `Tweet ${i + 1}:\n  Date: ${t.time}\n  URL: ${t.url}\n  Text: ${t.text}`
    )
    .join("\n\n");

  return `Country: ${country}

Extract attack data from these tweets. Use "engaged" if the tweet says "engaged", use "intercepted" if it says "intercepted" or uses Arabic interception terms. Use the date from the tweet timestamp (YYYY-MM-DD). Include the tweet URL as source.

Expected JSON schema:
${schema}

Tweets:
${tweetBlock}`;
}

function extractBatch(country, tweets) {
  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(country, tweets)}`;
  const raw = callClaude(prompt);

  // Parse JSON from response (handle markdown code fences)
  let jsonStr = raw;
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1];
  jsonStr = jsonStr.trim();

  const parsed = JSON.parse(jsonStr);
  return parsed;
}

// --- Helpers ---

function formatLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
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
  console.log("=== backfill-attack-data.js (claude) ===");
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

    // 5. Extract via Claude in batches of BATCH_SIZE
    const allEntries = [];
    const allSkipped = [];
    for (let i = 0; i < cacheTweets.length; i += BATCH_SIZE) {
      const batch = cacheTweets.slice(i, i + BATCH_SIZE);
      console.log(`  Calling Claude for batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tweets)...`);
      const result = extractBatch(country, batch);
      if (result.entries) allEntries.push(...result.entries);
      if (result.skipped) allSkipped.push(...result.skipped);
    }
    console.log(`  Claude extracted ${allEntries.length} entries, ${allSkipped.length} skipped`);
    if (allSkipped.length > 0) {
      for (const s of allSkipped) console.log(`    Skipped: ${s}`);
    }

    // 6. Load existing data and merge
    const dataPath = path.join(ROOT, `public/data-${country}.json`);
    const data = fs.existsSync(dataPath)
      ? JSON.parse(fs.readFileSync(dataPath, "utf-8"))
      : { daily: [], cumulative: {}, lastUpdated: null };
    if (!data.daily) data.daily = [];
    if (!data.cumulative) data.cumulative = {};

    const before = data.daily.length;
    const { added, skipped } = mergeIntoData(data, allEntries);
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
