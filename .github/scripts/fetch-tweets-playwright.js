import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "tweet-cache");

const ACCOUNTS = {
  uae: "@modgovae",
  kuwait: "@MOD_KW",
  qatar: "@MOD_Qatar",
  bahrain: "@BDF_Bahrain",
  oman: "@RoyalArmyOfOman",
  israel: "@IDF",
  iran: "@khamenei_ir",
  saudi: "@modgovksa",
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.net",
];

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Scrape tweets from X.com using Playwright ──────────────────────────────

async function scrapeTweetsFromX(page, username) {
  const handle = username.replace("@", "");
  const url = `https://x.com/${handle}`;
  log(`  Navigating to ${url}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  try {
    await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
  } catch {
    // Check for login wall or empty page
    const pageContent = await page.content();
    if (
      pageContent.includes("Log in") &&
      pageContent.includes("Sign up")
    ) {
      throw new Error("Login wall detected");
    }
    throw new Error("No tweets loaded within timeout");
  }

  // Scroll down once to load more tweets
  await page.evaluate(() => window.scrollBy(0, 2000));
  await sleep(2000);

  const tweets = await page.evaluate((handle) => {
    const tweetEls = document.querySelectorAll('[data-testid="tweet"]');
    const results = [];

    for (const el of Array.from(tweetEls).slice(0, 10)) {
      try {
        // Extract tweet text
        const textEl = el.querySelector('[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : "";

        // Extract timestamp
        const timeEl = el.querySelector("time");
        const time = timeEl ? timeEl.getAttribute("datetime") : null;

        // Extract tweet URL from the timestamp's parent link
        const linkEl = timeEl ? timeEl.closest("a") : null;
        const tweetUrl = linkEl ? linkEl.href : null;

        // Extract engagement metrics
        const likesEl = el.querySelector('[data-testid="like"] span');
        const retweetsEl = el.querySelector('[data-testid="retweet"] span');

        const parseCount = (el) => {
          if (!el) return 0;
          const raw = el.innerText.trim();
          if (!raw) return 0;
          if (raw.includes("K")) return Math.round(parseFloat(raw) * 1000);
          if (raw.includes("M")) return Math.round(parseFloat(raw) * 1000000);
          return parseInt(raw.replace(/,/g, ""), 10) || 0;
        };

        results.push({
          text,
          time: time || new Date().toISOString(),
          url: tweetUrl || `https://x.com/${handle}`,
          likes: parseCount(likesEl),
          retweets: parseCount(retweetsEl),
        });
      } catch {
        // Skip malformed tweet elements
      }
    }

    return results;
  }, handle);

  return tweets;
}

// ── Nitter fallback scraper ────────────────────────────────────────────────

async function scrapeTweetsFromNitter(page, username) {
  const handle = username.replace("@", "");

  for (const base of NITTER_INSTANCES) {
    const url = `${base}/${handle}`;
    log(`  Trying Nitter fallback: ${url}`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForSelector(".timeline-item", { timeout: 10000 });

      const tweets = await page.evaluate(
        ({ handle, base }) => {
          const items = document.querySelectorAll(".timeline-item");
          const results = [];

          for (const el of Array.from(items).slice(0, 10)) {
            try {
              const textEl = el.querySelector(".tweet-content");
              const text = textEl ? textEl.innerText : "";

              const timeEl = el.querySelector(".tweet-date a");
              const relativeUrl = timeEl ? timeEl.getAttribute("href") : null;
              const titleAttr = timeEl ? timeEl.getAttribute("title") : null;

              const tweetUrl = relativeUrl
                ? `https://x.com${relativeUrl.replace(`/${handle}`, `/${handle}`)}`
                : `https://x.com/${handle}`;

              // Parse Nitter's date format
              let time = new Date().toISOString();
              if (titleAttr) {
                try {
                  time = new Date(titleAttr).toISOString();
                } catch {
                  // keep default
                }
              }

              const statsEls = el.querySelectorAll(".tweet-stat .icon-container");
              let likes = 0;
              let retweets = 0;

              for (const stat of statsEls) {
                const val = parseInt(
                  stat.textContent.trim().replace(/,/g, ""),
                  10
                );
                if (isNaN(val)) continue;
                if (stat.querySelector(".icon-heart")) likes = val;
                if (stat.querySelector(".icon-retweet")) retweets = val;
              }

              results.push({ text, time, url: tweetUrl, likes, retweets });
            } catch {
              // skip
            }
          }

          return results;
        },
        { handle, base }
      );

      if (tweets.length > 0) {
        log(`  Got ${tweets.length} tweets from ${base}`);
        return tweets;
      }
    } catch (err) {
      log(`  Nitter instance ${base} failed: ${err.message}`);
    }
  }

  return null;
}

// ── Syndication API fallback (no browser needed) ───────────────────────────

async function scrapeTweetsFromSyndication(page, username) {
  const handle = username.replace("@", "");
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;
  log(`  Trying syndication fallback: ${url}`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });

    const tweets = await page.evaluate((handle) => {
      const items = document.querySelectorAll(".timeline-Tweet");
      const results = [];

      for (const el of Array.from(items).slice(0, 10)) {
        try {
          const textEl = el.querySelector(".timeline-Tweet-text");
          const text = textEl ? textEl.innerText : "";

          const timeEl = el.querySelector("time");
          const time = timeEl
            ? timeEl.getAttribute("datetime")
            : new Date().toISOString();

          const linkEl = el.querySelector(".timeline-Tweet-timestamp");
          const tweetUrl = linkEl
            ? linkEl.href
            : `https://x.com/${handle}`;

          results.push({ text, time, url: tweetUrl, likes: 0, retweets: 0 });
        } catch {
          // skip
        }
      }

      return results;
    }, handle);

    if (tweets.length > 0) {
      log(`  Got ${tweets.length} tweets from syndication API`);
      return tweets;
    }
  } catch (err) {
    log(`  Syndication fallback failed: ${err.message}`);
  }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Ensure cache directory exists
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  log("Launching Playwright Chromium...");
  const browser = await chromium.launch({ headless: true });

  // Load saved X session if available (created by setup-x-session.js)
  const SESSION_FILE = path.join(__dirname, "x-session.json");
  const contextOptions = { userAgent: USER_AGENT };
  if (fs.existsSync(SESSION_FILE)) {
    log("Using saved X session for authenticated scraping");
    contextOptions.storageState = SESSION_FILE;
  } else {
    log("No session file found — scraping unauthenticated (may hit login walls)");
    log("Run: node .github/scripts/setup-x-session.js to set up auth");
  }
  const context = await browser.newContext(contextOptions);

  const entries = Object.entries(ACCOUNTS);
  let successCount = 0;
  let failCount = 0;

  // Randomise order to avoid predictable scraping patterns
  const shuffled = [...entries].sort(() => Math.random() - 0.5);

  for (const [country, account] of shuffled) {
    log(`[${country}] Scraping ${account}...`);

    // Random debounce 8–20s between accounts
    const delay = 8000 + Math.floor(Math.random() * 12000);
    const idx = shuffled.findIndex(([c]) => c === country);
    if (idx > 0) {
      log(`  Waiting ${(delay/1000).toFixed(1)}s before next account...`);
      await sleep(delay);
    }

    const page = await context.newPage();

    try {
      let tweets = null;

      // 1. Try Nitter first (purpose-built for scraping, no login wall)
      const nitterPage = await context.newPage();
      try {
        tweets = await scrapeTweetsFromNitter(nitterPage, account);
        if (tweets && tweets.length > 0) log(`[${country}] Got ${tweets.length} tweets from Nitter`);
      } catch (err) {
        log(`[${country}] Nitter failed (${err.message})`);
      } finally {
        await nitterPage.close();
      }

      // 2. Fall back to X.com (works when authenticated session is present)
      if (!tweets || tweets.length === 0) {
        try {
          tweets = await scrapeTweetsFromX(page, account);
          if (tweets && tweets.length > 0) log(`[${country}] Got ${tweets.length} tweets from X.com`);
        } catch (err) {
          log(`[${country}] X.com failed (${err.message})`);
        }
      }

      // 3. Last resort: syndication API
      if (!tweets || tweets.length === 0) {
        const synPage = await context.newPage();
        try {
          tweets = await scrapeTweetsFromSyndication(synPage, account);
          if (tweets && tweets.length > 0) log(`[${country}] Got ${tweets.length} tweets from syndication`);
        } catch (err) {
          log(`[${country}] Syndication failed (${err.message})`);
        } finally {
          await synPage.close();
        }
      }

      if (!tweets || tweets.length === 0) {
        log(`[${country}] All sources failed — no tweets scraped.`);
        failCount++;
        continue;
      }

      // Write cache file
      const output = {
        account,
        country,
        fetchedAt: new Date().toISOString(),
        tweets,
      };

      const outPath = path.join(CACHE_DIR, `${country}.json`);
      fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
      log(`[${country}] Saved ${tweets.length} tweets to ${outPath}`);
      successCount++;
    } catch (err) {
      log(`[${country}] ERROR: ${err.message}`);
      failCount++;
    } finally {
      if (!page.isClosed()) await page.close();
    }


  }

  await browser.close();
  log(`Done. Success: ${successCount}, Failed: ${failCount}`);

  if (successCount === 0) {
    console.error("All accounts failed to scrape. Exiting with error.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
