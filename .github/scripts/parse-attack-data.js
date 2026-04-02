#!/usr/bin/env node
/**
 * parse-attack-data.js
 * Parse tweet cache and extract structured attack data using Groq LLM.
 * See tasks/spec-attack-data-parser.md for full specification.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DRY_RUN = process.env.DRY_RUN === "true";

const COUNTRIES = ["uae", "bahrain", "qatar", "saudi", "israel", "iran"];

const ARABIC_NUMERALS = {
  "\u0660": "0", "\u0661": "1", "\u0662": "2", "\u0663": "3", "\u0664": "4",
  "\u0665": "5", "\u0666": "6", "\u0667": "7", "\u0668": "8", "\u0669": "9"
};

function convertArabicNumerals(text) {
  return text.replace(/[\u0660-\u0669]/g, char => ARABIC_NUMERALS[char]);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function calculateTotal(entry) {
  let total = 0;
  const countFields = [
    "ballisticDetected", "ballisticEngaged",
    "cruiseDetected", "cruiseEngaged",
    "dronesDetected", "dronesEngaged"
  ];
  // For "engaged" reporting, use engaged fields
  if (entry.reportingType === "engaged") {
    if (typeof entry.ballisticEngaged === "number") total += entry.ballisticEngaged;
    if (typeof entry.cruiseEngaged === "number") total += entry.cruiseEngaged;
    if (typeof entry.dronesEngaged === "number") total += entry.dronesEngaged;
  } else {
    // For "intercepted" reporting, use detected fields
    if (typeof entry.ballisticDetected === "number") total += entry.ballisticDetected;
    if (typeof entry.cruiseDetected === "number") total += entry.cruiseDetected;
    if (typeof entry.dronesDetected === "number") total += entry.dronesDetected;
  }
  // Fallback: if total is still 0, try summing whatever numeric fields exist
  if (total === 0) {
    for (const f of countFields) {
      if (typeof entry[f] === "number") total += entry[f];
    }
  }
  return total || undefined;
}

// --- Prompt Engineering ---

const SYSTEM_PROMPT = `You are a military data extraction assistant. Extract ONLY explicitly stated numbers from official Ministry of Defence tweets. Never interpolate, estimate, or infer values.

CRITICAL RULES:
1. Only extract numbers that are explicitly written in the tweet
2. If a number is ambiguous or unclear, omit that field entirely
3. Never use 0 as a placeholder for missing data — omit the field
4. Return valid JSON only — no prose, no markdown
5. Arabic numerals (٠١٢٣٤٥٦٧٨٩) must be converted to Western numerals
6. Handle both Arabic and English text
7. Distinguish between DAILY counts (for a specific date) and CUMULATIVE totals (running total)
8. If a tweet only mentions "engaged" or "intercepted" without breakdown, use the sum as the engaged/intercepted count`;

function buildUserPrompt(country, tweets) {
  const countryHints = {
    uae: `Country: UAE
Account: @modgovae
Reporting format change: From 2026-03-13 onwards, UAE MoD reports "engaged" counts instead of intercepted/impacted breakdown.
For post-Mar 13: reportingType should be "engaged", use ballisticEngaged and dronesEngaged fields.
For pre-Mar 13: reportingType should be "intercepted", use full detected/intercepted/impacted breakdown.
Key Arabic: تعاملت = engaged, اعترضت = intercepted, رصدت = detected, صاروخ باليستي = ballistic, طائرة مسيرة = drone/UAV, صاروخ جوال = cruise missile`,

    bahrain: `Country: Bahrain
Account: @BDF_Bahrain
Bahrain reports cumulative totals in each infographic tweet. Calculate daily delta from cumulative changes if possible.
Look for total missiles and drones intercepted numbers.`,

    qatar: `Country: Qatar
Account: @MOaborki
Look for any defense-related statistics or attack data.`,

    saudi: `Country: Saudi Arabia
Account: @modgovksa
Arabic tweets, similar format to UAE. Look for missile and drone interception reports.`,

    israel: `Country: Israel
Account: @IDF
Sparse data — often no daily breakdown. Look for "intercepted X missiles/drones" phrases.`,

    iran: `Country: Iran
Account: @khamenei_ir
Claims of attacks launched, not defenses. Different schema: missilesLaunched, dronesLaunched.
Look for claims about strikes or attacks carried out.`
  };

  const header = countryHints[country] || `Country: ${country}`;

  const tweetBlocks = tweets.map((t, i) => {
    const text = convertArabicNumerals(t.text);
    return `---
[Tweet ${i + 1}]
Time: ${t.time}
URL: ${t.url}
Text: ${text}
---`;
  }).join("\n");

  return `${header}

Extract attack data from these tweets. Return JSON with this structure:
{
  "entries": [
    {
      "type": "daily",
      "date": "YYYY-MM-DD",
      "reportingType": "engaged" | "intercepted",
      "ballisticDetected": <number or omit>,
      "ballisticIntercepted": <number or omit>,
      "ballisticEngaged": <number or omit>,
      "ballisticImpacted": <number or omit>,
      "cruiseDetected": <number or omit>,
      "cruiseIntercepted": <number or omit>,
      "dronesDetected": <number or omit>,
      "dronesIntercepted": <number or omit>,
      "dronesEngaged": <number or omit>,
      "dronesImpacted": <number or omit>,
      "killed": <number or omit>,
      "injured": <number or omit>,
      "source": "<tweet URL>"
    }
  ],
  "cumulative": {
    "ballistic": <number or omit>,
    "cruise": <number or omit>,
    "drones": <number or omit>,
    "killed": <number or omit>,
    "injured": <number or omit>,
    "source": "<tweet URL if stated>"
  },
  "skipped": ["<tweet URL>: <reason>", ...]
}

If no extractable data, return: {"entries": [], "cumulative": null, "skipped": [...]}

TWEETS:
${tweetBlocks}`;
}

// --- Groq API ---

async function callGroqExtractor(country, tweets, existingData, retries = 3) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }

  const userPrompt = buildUserPrompt(country, tweets);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  [${country}] Groq API attempt ${attempt}/${retries} (${tweets.length} tweets)...`);

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ],
          temperature: 0,
          response_format: { type: "json_object" }
        })
      });

      if (response.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`  [${country}] Rate limited. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Groq API error ${response.status}: ${body.slice(0, 300)}`);
      }

      const json = await response.json();
      const content = json.choices[0].message.content;

      // Parse and validate JSON
      try {
        const extracted = JSON.parse(content);
        if (!extracted.entries || !Array.isArray(extracted.entries)) {
          throw new Error("Invalid response structure — missing entries array");
        }
        return extracted;
      } catch (parseErr) {
        console.error(`  [${country}] Failed to parse Groq response: ${parseErr.message}`);
        console.error(`  Raw content: ${content.slice(0, 500)}`);
        return { entries: [], cumulative: null, skipped: ["parse_error"] };
      }

    } catch (err) {
      console.error(`  [${country}] Attempt ${attempt} error: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}

// --- Validation ---

function validateEntry(entry) {
  if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    return { valid: false, reason: "invalid_date" };
  }

  if (!entry.source || !entry.source.startsWith("https://x.com/")) {
    return { valid: false, reason: "missing_source" };
  }

  const numericFields = [
    "ballisticDetected", "ballisticIntercepted", "ballisticEngaged",
    "dronesDetected", "dronesIntercepted", "dronesEngaged",
    "cruiseDetected", "cruiseIntercepted", "killed", "injured"
  ];
  const hasNumeric = numericFields.some(f => typeof entry[f] === "number");
  if (!hasNumeric) {
    return { valid: false, reason: "no_numeric_data" };
  }

  return { valid: true };
}

// --- Merge Logic ---

function mergeEntries(data, extracted) {
  const existingDates = new Set(data.daily.map(e => e.date));
  let added = 0, skipped = 0;
  const invalidEntries = [];

  for (const entry of extracted.entries) {
    if (entry.type !== "daily") continue;

    // Validate
    const validation = validateEntry(entry);
    if (!validation.valid) {
      invalidEntries.push(`${entry.source || entry.date}: ${validation.reason}`);
      skipped++;
      continue;
    }

    if (existingDates.has(entry.date)) {
      skipped++;
      continue; // Never overwrite existing entries
    }

    // Build entry with only present fields
    const dailyEntry = {
      date: entry.date,
      label: formatLabel(entry.date),
      source: entry.source
    };

    // Copy only non-null fields
    const fields = [
      "reportingType",
      "ballisticDetected", "ballisticIntercepted", "ballisticEngaged", "ballisticImpacted",
      "cruiseDetected", "cruiseIntercepted",
      "dronesDetected", "dronesIntercepted", "dronesEngaged", "dronesImpacted",
      "killed", "injured", "notes"
    ];

    for (const field of fields) {
      if (entry[field] !== undefined && entry[field] !== null) {
        dailyEntry[field] = entry[field];
      }
    }

    // Calculate total
    const total = calculateTotal(dailyEntry);
    if (total !== undefined) {
      dailyEntry.total = total;
    }

    data.daily.push(dailyEntry);
    existingDates.add(entry.date);
    added++;
  }

  // Sort by date
  data.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Handle cumulative updates
  if (extracted.cumulative) {
    updateCumulativeIfHigher(data.cumulative, extracted.cumulative);
  }

  return { added, skipped, invalidEntries, skippedReasons: extracted.skipped || [] };
}

function updateCumulativeIfHigher(cumulative, newCum) {
  const fields = ["ballistic", "cruise", "drones", "killed", "injured"];
  for (const field of fields) {
    if (typeof newCum[field] === "number") {
      if (typeof cumulative[field] !== "number" || newCum[field] > cumulative[field]) {
        cumulative[field] = newCum[field];
      }
    }
  }
}

// --- Cumulative Recalculation ---

function recalculateCumulative(data) {
  const cum = {};

  const sumFields = [
    "ballisticDetected", "ballisticIntercepted", "ballisticImpacted",
    "cruiseDetected", "cruiseIntercepted", "cruiseImpacted",
    "dronesDetected", "dronesIntercepted", "dronesImpacted",
    "killed", "injured"
  ];

  for (const field of sumFields) {
    const hasValue = data.daily.some(e => typeof e[field] === "number");
    if (hasValue) {
      cum[field] = data.daily.reduce((acc, e) =>
        acc + (typeof e[field] === "number" ? e[field] : 0), 0);
    }
  }

  // For "engaged" reporting, sum engaged fields
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

  // Preserve cumulative fields that were set from tweet cumulative data
  // (only if higher than computed sums)
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

  // 4. Call Groq API
  let extracted;
  try {
    extracted = await callGroqExtractor(country, newTweets, data);
  } catch (err) {
    console.error(`  ERROR calling Groq for ${country}: ${err.message}`);
    return { country, status: "error", reason: err.message };
  }

  console.log(`  Groq returned ${extracted.entries.length} entries, ${(extracted.skipped || []).length} skipped`);

  // 5. Merge entries (idempotent)
  const updates = mergeEntries(data, extracted);
  console.log(`  Merged: ${updates.added} added, ${updates.skipped} skipped`);

  if (updates.invalidEntries.length > 0) {
    console.log(`  Invalid entries: ${updates.invalidEntries.join(", ")}`);
  }

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

  return { country, status: "updated", ...updates };
}

// --- Main ---

async function main() {
  console.log("=== parse-attack-data.js ===");
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Groq API key: ${GROQ_API_KEY ? "set (" + GROQ_API_KEY.slice(0, 8) + "...)" : "NOT SET"}`);

  if (!GROQ_API_KEY) {
    console.error("ERROR: GROQ_API_KEY is not set. Exiting.");
    process.exit(1);
  }

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

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
