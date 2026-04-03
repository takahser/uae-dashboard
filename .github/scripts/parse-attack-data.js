#!/usr/bin/env node
/**
 * parse-attack-data.js
 * Parse tweet cache and extract structured attack data using Claude CLI.
 * Runs daily via CI to process new tweets from tweet-cache/{country}.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const DRY_RUN = process.env.DRY_RUN === "true";
const BATCH_SIZE = 20;

const COUNTRIES = ["uae", "bahrain", "qatar", "saudi", "israel", "iran"];

// --- LLM caller: Claude CLI with Groq fallback ---

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function callClaudeCLI(prompt) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force Claude Code subscription
  const result = spawnSync("claude", ["--print", "--model", "haiku", "--output-format", "json"], {
    input: prompt,
    encoding: "utf8",
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || "claude failed");
  const out = JSON.parse(result.stdout);
  return out.result || out.content || "";
}

async function callClaude(prompt) {
  // On GH Actions, claude CLI is not available — use Groq
  if (process.env.CI) return callGroq(prompt);
  try {
    return callClaudeCLI(prompt);
  } catch (e) {
    console.warn("  Claude CLI failed, falling back to Groq:", e.message);
    return callGroq(prompt);
  }
}

const SYSTEM_PROMPT = `You are a military data extractor. Extract structured attack data from official MoD tweets. Return ONLY valid JSON — no prose. If a tweet has no numeric attack data, skip it.`;

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

async function extractBatch(country, tweets) {
  const prompt = `${SYSTEM_PROMPT}\n\n${buildUserPrompt(country, tweets)}`;
  const raw = await callClaude(prompt);

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

async function processCountry(country) {
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

  // 4. Extract via Claude in batches
  const allEntries = [];
  const allSkipped = [];
  for (let i = 0; i < newTweets.length; i += BATCH_SIZE) {
    const batch = newTweets.slice(i, i + BATCH_SIZE);
    console.log(`  Calling Claude for batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} tweets)...`);
    const result = await extractBatch(country, batch);
    if (result.entries) allEntries.push(...result.entries);
    if (result.skipped) allSkipped.push(...result.skipped);
  }
  console.log(`  Claude extracted ${allEntries.length} entries, ${allSkipped.length} skipped`);
  if (allSkipped.length > 0) {
    for (const s of allSkipped) console.log(`    Skipped: ${s}`);
  }

  if (allEntries.length === 0) {
    console.log(`  No extractable data`);
    return { country, status: "skipped", reason: "no Claude matches" };
  }

  // 5. Merge entries (idempotent)
  const { added, skipped } = mergeEntries(data, allEntries);
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

async function main() {
  console.log("=== parse-attack-data.js (claude) ===");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);

  const log = [];

  for (const country of COUNTRIES) {
    const result = await processCountry(country);
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
