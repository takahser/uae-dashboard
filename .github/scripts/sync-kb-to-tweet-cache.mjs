#!/usr/bin/env node
/**
 * sync-kb-to-tweet-cache.mjs
 *
 * Replaces fetch-tweets-playwright.js for the attack data pipeline.
 * Reads MoD account tweets directly from the xpost-automation KB database
 * (which is kept current by the local Playwright session on the Mac Mini),
 * then writes them into tweet-cache/{country}.json in the format expected
 * by parse-attack-data.js.
 *
 * Why this exists:
 *   - fetch-tweets-playwright.js fails on GH Actions (X.com login wall)
 *   - The KB pipeline runs locally with a saved X session — same tweets,
 *     no login wall
 *   - This script bridges the two: run it locally via cron, commit the
 *     cache files, then GH Actions parse-attack-data.js works as usual.
 *
 * Runs on: Mac Mini (local) — requires kb.db access
 * Schedule: daily via openclaw cron (after KB pipeline runs)
 */

import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../..');
const CACHE_DIR = join(REPO_ROOT, '.github/scripts/tweet-cache');
const KB_DB = '/Users/chou/repos/xpost-automation/memory/kb.db';

// How many days back to include tweets (generous window — parser deduplicates)
const LOOKBACK_DAYS = 30;

// Country → KB handle(s)
// Note: handles are case-insensitive in KB but stored as scraped
const COUNTRY_HANDLES = {
  uae:     { account: '@modgovae',      handles: ['modgovae'] },
  bahrain: { account: '@BDF_Bahrain',   handles: ['BDF_Bahrain', 'bdf_bahrain'] },
  kuwait:  { account: '@KuwaitArmyGHQ', handles: ['KuwaitArmyGHQ', 'kuwaitarmyghq'] },
  qatar:   { account: '@MOD_Qatar',     handles: ['MOD_Qatar', 'mod_qatar'] },
  saudi:   { account: '@modgovksa',     handles: ['modgovksa'] },
  israel:  { account: '@IDF',           handles: ['IDF', 'idf'] },
  iran:    { account: '@khamenei_ir',   handles: ['MKhamenei_ir', 'mkhamenei_ir', 'khamenei_ir'] },
};

function buildTweetUrl(tweetId, handle) {
  const cleanHandle = handle.replace(/^@/, '');
  return `https://x.com/${cleanHandle}/status/${tweetId}`;
}

function getKbTweets(db, handles, cutoff) {
  const placeholders = handles.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT tweet_id, author_handle, content, received_at, raw_json
    FROM tweet_queue
    WHERE author_handle IN (${placeholders})
      AND received_at >= ?
    ORDER BY received_at DESC
  `).all(...handles, cutoff);
  return rows;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });

  if (!existsSync(KB_DB)) {
    console.error(`[sync-kb] ❌ KB database not found: ${KB_DB}`);
    process.exit(1);
  }

  const db = new Database(KB_DB, { readonly: true });

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  console.log(`[sync-kb] Lookback cutoff: ${cutoff}`);

  let totalTweets = 0;

  for (const [country, { account, handles }] of Object.entries(COUNTRY_HANDLES)) {
    const rows = getKbTweets(db, handles, cutoff);

    // Deduplicate by tweet_id (handles stored with different cases)
    const seen = new Set();
    const tweets = [];
    for (const row of rows) {
      if (seen.has(row.tweet_id)) continue;
      seen.add(row.tweet_id);

      let createdAt = row.received_at;
      // If raw_json has a more accurate created_at, prefer it
      if (row.raw_json) {
        try {
          const raw = JSON.parse(row.raw_json);
          if (raw.scraped_at) createdAt = raw.scraped_at;
        } catch {}
      }

      tweets.push({
        text: row.content,
        time: createdAt,
        url: buildTweetUrl(row.tweet_id, account),
        likes: 0,
        retweets: 0,
      });
    }

    // Sort newest first (parser expects this)
    tweets.sort((a, b) => new Date(b.time) - new Date(a.time));

    const cacheEntry = {
      account,
      country,
      fetchedAt: new Date().toISOString(),
      source: 'kb-database',  // distinguish from playwright scrape
      tweetCount: tweets.length,
      tweets,
    };

    const outFile = join(CACHE_DIR, `${country}.json`);
    writeFileSync(outFile, JSON.stringify(cacheEntry, null, 2) + '\n');
    console.log(`[sync-kb] ✅ ${country}: ${tweets.length} tweets → ${outFile}`);
    totalTweets += tweets.length;
  }

  db.close();
  console.log(`[sync-kb] Done. ${totalTweets} total tweets written across ${Object.keys(COUNTRY_HANDLES).length} countries.`);
}

main().catch(err => {
  console.error('[sync-kb] Fatal:', err);
  process.exit(1);
});
