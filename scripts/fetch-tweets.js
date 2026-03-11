import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Shared keyword patterns ─────────────────────────────────────────────────
const ATTACK_KW = /missile|drone|UAV|ballistic|cruise|intercept|defen[cs]e|attack|iranian|صاروخ|طائرة مسيّرة|اعتراض|إيران|باليستي|هجوم|دفاعات جوية/i;
const ATTACK_KW_HEB = /missile|drone|UAV|ballistic|cruise|intercept|defen[cs]e|attack|iranian|טיל|מזל"ט|יירוט|איראן|בליסטי|התקפה|הגנה אווירית|صاروخ|طائرة مسيّرة|اعتراض|إيران|باليستي|هجوم|دفاعات جوية/i;

// ── Country config with hardcoded user IDs to save API calls ────────────────
const COUNTRIES = [
  {
    code: "uae",
    file: "data-uae.json",
    source: "modgovae",
    userId: "495832726", // @modgovae
    keywords: ATTACK_KW,
  },
  {
    code: "qatar",
    file: "data-qatar.json",
    source: "MOD_Qatar",
    userId: null, // resolve at runtime
    keywords: ATTACK_KW,
  },
  {
    code: "kuwait",
    file: "data-kuwait.json",
    source: "MOD_KW",
    userId: "282194628", // @MOD_KW
    keywords: ATTACK_KW,
  },
  {
    code: "bahrain",
    file: "data-bahrain.json",
    source: "BDF_Bahrain",
    userId: "491055921", // @BDF_Bahrain
    keywords: ATTACK_KW,
  },
  {
    code: "israel",
    file: "data-israel.json",
    source: "IDF",
    userId: null, // resolve at runtime
    keywords: ATTACK_KW_HEB,
  },
  {
    code: "saudi_arabia",
    file: "data-saudi.json",
    source: "AlArabiya_Eng",
    userId: null, // resolve at runtime
    keywords: ATTACK_KW,
  },
];

// ── Multi-country aggregator sources ────────────────────────────────────────
// These accounts report on multiple countries. Tweets are parsed by Claude to
// identify which country the data belongs to, then routed to the right file.
const AGGREGATOR_SOURCES = [
  {
    source: "LucasFoxNews",
    userId: null,
    keywords: ATTACK_KW,
    label: "Lucas Tomlinson (Fox News Pentagon)",
  },
  {
    source: "CENTCOM",
    userId: null,
    keywords: ATTACK_KW,
    label: "US Central Command",
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
  const json = await res.json();
  if (json.errors) {
    log(`WARNING: X API returned errors: ${JSON.stringify(json.errors)}`);
  }
  return json;
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
  const baseUrl = `https://api.twitter.com/2/users/${userId}/tweets?max_results=100&tweet.fields=created_at,text,attachments&expansions=attachments.media_keys&media.fields=url,type`;

  let allTweets = [];
  const media = {};
  let paginationToken = null;

  // Paginate through all tweets since sinceId
  do {
    let url = baseUrl;
    if (sinceId) url += `&since_id=${sinceId}`;
    if (paginationToken) url += `&pagination_token=${paginationToken}`;

    const data = await xGet(url, bearerToken);
    if (!data.data || data.data.length === 0) break;

    // Build media lookup
    if (data.includes?.media) {
      for (const m of data.includes.media) {
        media[m.media_key] = m;
      }
    }

    allTweets = allTweets.concat(data.data);
    paginationToken = data.meta?.next_token || null;

    log(`  Fetched ${data.data.length} tweets (total so far: ${allTweets.length})${paginationToken ? ", fetching next page..." : ""}`);
  } while (paginationToken);

  // Filter to attack-related tweets by keywords OR if tweet has images (stats often posted as images)
  const tweets = allTweets.filter((t) =>
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

// ── Parse aggregator tweet — identifies country + stats ─────────────────────

const COUNTRY_FILE_MAP = {
  uae: "data-uae.json",
  qatar: "data-qatar.json",
  kuwait: "data-kuwait.json",
  bahrain: "data-bahrain.json",
  israel: "data-israel.json",
  saudi_arabia: "data-saudi.json",
};

async function parseAggregatorTweet(tweetText, imageUrls, anthropicClient) {
  const content = [
    {
      type: "text",
      text: `You are parsing a tweet from a journalist or military command account that may contain attack/intercept statistics for one or more countries in the Middle East.

The tweet may reference: UAE, Qatar, Kuwait, Bahrain, Israel, Saudi Arabia, or others.
Extract ONLY clearly stated numbers — do NOT estimate or infer.

Tweet text:
"""
${tweetText}
"""

Return ONLY a JSON array. Each element represents one country mentioned with stats:
[
  {
    "country": "uae"|"qatar"|"kuwait"|"bahrain"|"israel"|"saudi_arabia",
    "hasCumulativeData": boolean,
    "cumulative": {
      "ballisticDetected": number|null,
      "ballisticIntercepted": number|null,
      "cruiseDetected": number|null,
      "cruiseIntercepted": number|null,
      "dronesDetected": number|null,
      "dronesIntercepted": number|null,
      "totalStrikes": number|null,
      "killed": number|null,
      "injured": number|null
    },
    "date": "YYYY-MM-DD"
  }
]

If the tweet contains no quantitative attack data, return an empty array [].`,
    },
  ];
  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls) {
      content.push({ type: "image", source: { type: "url", url } });
    }
  }

  const message = await anthropicClient.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content }],
  });

  const raw = message.content[0].text.trim();
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── Process an aggregator source ────────────────────────────────────────────

async function processAggregator(agg, bearerToken, anthropic) {
  const sourceName = agg.source;
  log(`[agg:${sourceName}] Processing aggregator source: ${agg.label}`);

  // Resolve user ID
  let userId = agg.userId;
  if (!userId) {
    userId = await getUserId(agg.source, bearerToken);
    log(`[agg:${sourceName}] Resolved @${agg.source} user ID: ${userId}`);
  }

  // Use a state file to track last tweet ID per aggregator
  const statePath = path.join(__dirname, "../public", `.agg-state-${sourceName}.json`);
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  } catch {
    // first run, no state yet
  }
  const sinceId = state.lastTweetId || null;

  const { tweets, media } = await fetchNewTweets(userId, sinceId, agg.keywords, bearerToken);
  log(`[agg:${sourceName}] Found ${tweets.length} relevant tweet(s)`);

  if (tweets.length === 0) {
    log(`[agg:${sourceName}] Nothing to update.`);
    return;
  }

  let latestTweetId = sinceId;

  for (const tweet of tweets.reverse()) {
    log(`[agg:${sourceName}] Parsing tweet ${tweet.id}: "${tweet.text.slice(0, 80)}..."`);
    try {
      const imageUrls = [];
      if (tweet.attachments?.media_keys) {
        for (const key of tweet.attachments.media_keys) {
          const m = media[key];
          if (m && m.type === "photo" && m.url) imageUrls.push(m.url);
        }
      }

      const entries = await parseAggregatorTweet(tweet.text, imageUrls, anthropic);

      if (!Array.isArray(entries) || entries.length === 0) {
        log(`[agg:${sourceName}] Tweet ${tweet.id} — no country stats found, skipping.`);
      } else {
        for (const entry of entries) {
          const countryFile = COUNTRY_FILE_MAP[entry.country];
          if (!countryFile) {
            log(`[agg:${sourceName}] Unknown country "${entry.country}", skipping.`);
            continue;
          }
          if (!entry.hasCumulativeData) continue;

          const dataPath = path.join(__dirname, "../public", countryFile);
          const currentData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

          // Merge cumulative totals (only non-null values)
          if (entry.cumulative) {
            for (const [key, val] of Object.entries(entry.cumulative)) {
              if (val !== null && val !== undefined) {
                currentData.cumulative[key] = val;
              }
            }
          }

          currentData.lastUpdated = new Date().toISOString();
          if (!currentData.sources) currentData.sources = {};
          if (!currentData.sources[sourceName]) currentData.sources[sourceName] = {};
          currentData.sources[sourceName].lastTweetId = tweet.id;

          fs.writeFileSync(dataPath, JSON.stringify(currentData, null, 2));
          log(`[agg:${sourceName}] Updated ${countryFile} for ${entry.country}`);
        }
      }

      latestTweetId = tweet.id;
    } catch (err) {
      log(`[agg:${sourceName}] Failed to parse tweet ${tweet.id}: ${err.message}`);
    }
  }

  // Persist aggregator state
  if (latestTweetId) {
    fs.writeFileSync(statePath, JSON.stringify({ lastTweetId: latestTweetId }, null, 2));
  }
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

  // Process aggregator sources (LucasFoxNews, CENTCOM, etc.)
  for (const agg of AGGREGATOR_SOURCES) {
    try {
      await processAggregator(agg, bearerToken, anthropic);
    } catch (err) {
      log(`[agg:${agg.source}] ERROR: ${err.message}`);
      // Continue to next source
    }
  }

  log("Done processing all countries and aggregator sources.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
