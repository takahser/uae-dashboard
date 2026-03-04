import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../public/data.json");
const MODGOVAE_USER_ID = "272→ we'll resolve this at runtime";
const MODGOVAE_USERNAME = "modgovae";

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function xGet(url, bearerToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API error ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Resolve @modgovae user ID ───────────────────────────────────────────────

async function getUserId(bearerToken) {
  const data = await xGet(
    `https://api.twitter.com/2/users/by/username/${MODGOVAE_USERNAME}`,
    bearerToken
  );
  return data.data.id;
}

// ── Fetch tweets since lastTweetId ─────────────────────────────────────────

async function fetchNewTweets(userId, sinceId, bearerToken) {
  let url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,text`;
  if (sinceId) url += `&since_id=${sinceId}`;

  const data = await xGet(url, bearerToken);
  if (!data.data || data.data.length === 0) return [];

  // Filter to only MOD attack-related tweets
  return data.data.filter((t) =>
    /missile|drone|ballistic|cruise|intercept|attack|iranian/i.test(t.text)
  );
}

// ── Parse tweet with Claude ────────────────────────────────────────────────

async function parseTweetWithClaude(tweetText, currentData, anthropicClient) {
  const prompt = `You are parsing an official UAE Ministry of Defence tweet about Iranian attacks.
Extract the CUMULATIVE totals (since start of attack) from this tweet and return ONLY valid JSON.

Current known cumulative totals for reference:
${JSON.stringify(currentData.cumulative, null, 2)}

Tweet text:
"""
${tweetText}
"""

Return ONLY a JSON object with these exact fields (use null for any not mentioned):
{
  "hasCumulativeData": boolean,
  "cumulative": {
    "ballisticDetected": number|null,
    "ballisticIntercepted": number|null,
    "ballisticSea": number|null,
    "ballisticImpacted": number|null,
    "cruiseDetected": number|null,
    "cruiseIntercepted": number|null,
    "cruiseSea": number|null,
    "cruiseImpacted": number|null,
    "dronesDetected": number|null,
    "dronesIntercepted": number|null,
    "dronesSea": number|null,
    "dronesImpacted": number|null,
    "killed": number|null,
    "injured": number|null
  },
  "daily": {
    "ballisticDetected": number|null,
    "ballisticIntercepted": number|null,
    "ballisticSea": number|null,
    "ballisticImpacted": number|null,
    "cruiseDetected": number|null,
    "cruiseIntercepted": number|null,
    "dronesDetected": number|null,
    "dronesIntercepted": number|null,
    "dronesImpacted": number|null
  },
  "date": "YYYY-MM-DD"
}`;

  const message = await anthropicClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Merge parsed data into data.json ──────────────────────────────────────

function mergeData(currentData, parsed, tweet) {
  const updated = JSON.parse(JSON.stringify(currentData)); // deep clone

  // Update cumulative totals — only overwrite with non-null values
  if (parsed.hasCumulativeData && parsed.cumulative) {
    for (const [key, val] of Object.entries(parsed.cumulative)) {
      if (val !== null && val !== undefined) {
        updated.cumulative[key] = val;
      }
    }
  }

  // Add or update daily entry
  if (parsed.date && parsed.daily) {
    const dateLabel = new Date(parsed.date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

    const existingIdx = updated.daily.findIndex((d) => d.date === parsed.date);
    const dailyEntry = {
      date: parsed.date,
      label: dateLabel,
      ballisticDetected: parsed.daily.ballisticDetected ?? 0,
      ballisticIntercepted: parsed.daily.ballisticIntercepted ?? 0,
      ballisticSea: parsed.daily.ballisticSea ?? 0,
      ballisticImpacted: parsed.daily.ballisticImpacted ?? 0,
      cruiseDetected: parsed.daily.cruiseDetected ?? 0,
      cruiseIntercepted: parsed.daily.cruiseIntercepted ?? 0,
      dronesDetected: parsed.daily.dronesDetected ?? 0,
      dronesIntercepted: parsed.daily.dronesIntercepted ?? 0,
      dronesImpacted: parsed.daily.dronesImpacted ?? 0,
      total:
        (parsed.daily.ballisticDetected ?? 0) +
        (parsed.daily.cruiseDetected ?? 0) +
        (parsed.daily.dronesDetected ?? 0),
    };

    if (existingIdx >= 0) {
      updated.daily[existingIdx] = dailyEntry;
    } else {
      updated.daily.push(dailyEntry);
      // Keep sorted by date
      updated.daily.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  }

  updated.lastUpdated = new Date().toISOString();
  updated.lastTweetId = tweet.id;

  return updated;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!bearerToken || !anthropicKey) {
    throw new Error("Missing X_BEARER_TOKEN or ANTHROPIC_API_KEY env vars");
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Load current data
  const currentData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  log(`Loaded data.json. Last tweet ID: ${currentData.lastTweetId}`);

  // Resolve user ID
  const userId = await getUserId(bearerToken);
  log(`Resolved @modgovae user ID: ${userId}`);

  // Fetch new tweets
  const tweets = await fetchNewTweets(
    userId,
    currentData.lastTweetId,
    bearerToken
  );
  log(`Found ${tweets.length} new relevant tweet(s)`);

  if (tweets.length === 0) {
    log("Nothing to update.");
    return;
  }

  // Process each tweet oldest-first
  let updatedData = currentData;
  for (const tweet of tweets.reverse()) {
    log(`Parsing tweet ${tweet.id}: "${tweet.text.slice(0, 80)}..."`);
    try {
      const parsed = await parseTweetWithClaude(
        tweet.text,
        updatedData,
        anthropic
      );
      if (parsed.hasCumulativeData) {
        updatedData = mergeData(updatedData, parsed, tweet);
        log(`✅ Updated data from tweet ${tweet.id}`);
      } else {
        log(`⏭ Tweet ${tweet.id} had no attack statistics, skipping.`);
        // Still update lastTweetId so we don't reprocess it
        updatedData.lastTweetId = tweet.id;
      }
    } catch (err) {
      log(`⚠️ Failed to parse tweet ${tweet.id}: ${err.message}`);
    }
  }

  // Write updated data
  fs.writeFileSync(DATA_PATH, JSON.stringify(updatedData, null, 2));
  log("✅ data.json updated successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
