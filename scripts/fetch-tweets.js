import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Country config with hardcoded user IDs to save API calls ────────────────
const COUNTRIES = [
  {
    code: "uae",
    file: "data-uae.json",
    source: "modgovae",
    userId: "495832726", // @modgovae
    keywords: /missile|drone|ballistic|cruise|intercept|attack|iranian|صاروخ|طائرة مسيّرة|اعتراض|إيران|باليستي|هجوم|دفاعات جوية/i,
  },
  {
    code: "qatar",
    file: "data-qatar.json",
    source: "MOD_Qatar",
    userId: null, // resolve at runtime
    keywords: /missile|drone|ballistic|cruise|intercept|attack|iranian|صاروخ|طائرة مسيّرة|اعتراض|إيران|باليستي|هجوم|دفاعات جوية/i,
  },
  {
    code: "kuwait",
    file: "data-kuwait.json",
    source: "MOD_KW",
    userId: "282194628", // @MOD_KW
    keywords: /missile|drone|ballistic|cruise|intercept|attack|iranian|صاروخ|طائرة مسيّرة|اعتراض|إيران|باليستي|هجوم|دفاعات جوية/i,
  },
  {
    code: "bahrain",
    file: "data-bahrain.json",
    source: "BDF_Bahrain",
    userId: "491055921", // @BDF_Bahrain
    keywords: /missile|drone|ballistic|cruise|intercept|attack|iranian|صاروخ|طائرة مسيّرة|اعتراض|إيران|باليستي|هجوم|دفاعات جوية/i,
  },
];

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

// ── Resolve user ID by username (only if not hardcoded) ───────────────────

async function getUserId(username, bearerToken) {
  const data = await xGet(
    `https://api.twitter.com/2/users/by/username/${username}`,
    bearerToken
  );
  return data.data.id;
}

// ── Fetch tweets since lastTweetId with media expansions ──────────────────

async function fetchNewTweets(userId, sinceId, keywords, bearerToken) {
  let url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=10&tweet.fields=created_at,text,attachments&expansions=attachments.media_keys&media.fields=url,type`;
  if (sinceId) url += `&since_id=${sinceId}`;

  const data = await xGet(url, bearerToken);
  if (!data.data || data.data.length === 0) return { tweets: [], media: {} };

  // Build media lookup
  const media = {};
  if (data.includes?.media) {
    for (const m of data.includes.media) {
      media[m.media_key] = m;
    }
  }

  // Filter to attack-related tweets by keywords OR if tweet has images (stats often posted as images)
  const tweets = data.data.filter((t) =>
    keywords.test(t.text) || (t.attachments?.media_keys?.length > 0)
  );
  return { tweets, media };
}

// ── Parse tweet with Claude (text + optional image) ───────────────────────

async function parseTweetWithClaude(tweetText, imageUrls, currentData, countryCode, anthropicClient) {
  const prompt = `You are parsing an official ${countryCode.toUpperCase()} Ministry of Defence tweet about Iranian attacks.
The tweet may be in English OR Arabic. If Arabic, translate and extract the numbers.
Extract the CUMULATIVE totals (since start of attack) from this tweet and return ONLY valid JSON.

Note: Some countries may not distinguish between missile types or may use different categories.
If the tweet only mentions generic "missiles" without specifying ballistic/cruise, put the count in ballisticDetected/ballisticIntercepted.
If data is truly not available for a field, use null.

Current known cumulative totals for reference:
${JSON.stringify(currentData.cumulative, null, 2)}

Tweet text:
"""
${tweetText}
"""

Return ONLY a JSON object with these exact fields (use null for any not mentioned):
{
  "hasCumulativeData": boolean,
  "hasNoStats": boolean,
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

  // Build message content with text + optional images
  const content = [{ type: "text", text: prompt }];
  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls) {
      content.push({
        type: "image",
        source: { type: "url", url },
      });
    }
  }

  const message = await anthropicClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content }],
  });

  const raw = message.content[0].text.trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Merge parsed data into country data ───────────────────────────────────

function mergeData(currentData, parsed, tweet, sourceName) {
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
      updated.daily.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  }

  updated.lastUpdated = new Date().toISOString();
  // Update source-specific lastTweetId
  if (!updated.sources) updated.sources = {};
  if (!updated.sources[sourceName]) updated.sources[sourceName] = {};
  updated.sources[sourceName].lastTweetId = tweet.id;

  return updated;
}

// ── Process a single country ──────────────────────────────────────────────

async function processCountry(country, bearerToken, anthropic) {
  const dataPath = path.join(__dirname, "../public", country.file);

  // Load country data
  const currentData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const sinceId = currentData.sources?.[country.source]?.lastTweetId || null;
  log(`[${country.code}] Loaded ${country.file}. Last tweet ID: ${sinceId}`);

  // Resolve user ID if not hardcoded
  let userId = country.userId;
  if (!userId) {
    userId = await getUserId(country.source, bearerToken);
    log(`[${country.code}] Resolved @${country.source} user ID: ${userId}`);
  }

  // Fetch new tweets with media
  const { tweets, media } = await fetchNewTweets(userId, sinceId, country.keywords, bearerToken);
  log(`[${country.code}] Found ${tweets.length} new relevant tweet(s)`);

  if (tweets.length === 0) {
    log(`[${country.code}] Nothing to update.`);
    return;
  }

  // Process each tweet oldest-first
  let updatedData = currentData;
  for (const tweet of tweets.reverse()) {
    log(`[${country.code}] Parsing tweet ${tweet.id}: "${tweet.text.slice(0, 80)}..."`);
    try {
      // Extract image URLs from tweet media
      const imageUrls = [];
      if (tweet.attachments?.media_keys) {
        for (const key of tweet.attachments.media_keys) {
          const m = media[key];
          if (m && m.type === "photo" && m.url) {
            imageUrls.push(m.url);
          }
        }
      }

      const parsed = await parseTweetWithClaude(
        tweet.text,
        imageUrls,
        updatedData,
        country.code,
        anthropic
      );
      if (parsed.hasCumulativeData) {
        updatedData = mergeData(updatedData, parsed, tweet, country.source);
        log(`[${country.code}] Updated data from tweet ${tweet.id}`);
      } else if (parsed.hasNoStats) {
        log(`[${country.code}] Tweet ${tweet.id} has no statistics, advancing.`);
        if (!updatedData.sources) updatedData.sources = {};
        if (!updatedData.sources[country.source]) updatedData.sources[country.source] = {};
        updatedData.sources[country.source].lastTweetId = tweet.id;
      } else {
        log(`[${country.code}] Tweet ${tweet.id} might contain stats but parsing returned no data, will retry next run.`);
      }
    } catch (err) {
      log(`[${country.code}] Failed to parse tweet ${tweet.id}: ${err.message}`);
    }
  }

  // Write updated data
  fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
  log(`[${country.code}] ${country.file} updated successfully.`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const bearerToken = process.env.X_BEARER_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!bearerToken || !anthropicKey) {
    throw new Error("Missing X_BEARER_TOKEN or ANTHROPIC_API_KEY env vars");
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Process each country independently — one failure doesn't block others
  for (const country of COUNTRIES) {
    try {
      await processCountry(country, bearerToken, anthropic);
    } catch (err) {
      log(`[${country.code}] ERROR: ${err.message}`);
      // Continue to next country
    }
  }

  log("Done processing all countries.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
