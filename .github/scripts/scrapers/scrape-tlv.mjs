#!/usr/bin/env node
import { createStealthBrowser, scrollToLoadAll, runScraper, getYesterday } from '../lib/browser-utils.mjs';
import { updateHealth } from '../lib/health-writer.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const VERIFY_DIR = join(REPO_ROOT, 'public/verification');
mkdirSync(VERIFY_DIR, { recursive: true });

const TLV_URLS = [
  'https://www.iaa.gov.il/en/airports/ben-gurion/flight-board/',
  'https://flights.bengurion.aero/'
];

async function scrapeTLV() {
  const PROXY = process.env.TLV_PROXY;

  const browserOpts = {};
  const contextOpts = {};
  if (PROXY) {
    console.log('[TLV] Using proxy:', PROXY.replace(/\/\/.*@/, '//<redacted>@'));
    contextOpts.proxy = { server: PROXY };
  }

  const { browser, context } = await createStealthBrowser({
    launchOptions: browserOpts,
    contextOptions: contextOpts
  });
  const page = await context.newPage();
  const dateStr = getYesterday();
  let total = 0;
  let sourceUrl = '';

  try {
    for (const url of TLV_URLS) {
      try {
        console.log(`[TLV] Trying ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Check for geo-block redirects
        const currentUrl = page.url();
        if (currentUrl.includes('blocked') || currentUrl.includes('access-denied')) {
          console.log(`[TLV] Geo-blocked at ${url}`);
          continue;
        }

        await scrollToLoadAll(page, { scrollCount: 10, delay: 400 });

        const rows = await page.evaluate(() => {
          return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"], [class*="item"]')]
            .map(el => el.innerText?.trim())
            .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
        });

        if (rows.length > 0) {
          total = rows.length;
          sourceUrl = url;
          console.log(`[TLV] Found ${total} flights at ${url}`);
          break;
        }

        console.log(`[TLV] No flights at ${url}, trying next...`);
      } catch (e) {
        console.log(`[TLV] ${url} failed: ${e.message}, trying next...`);
      }
    }

    const result = {
      date: dateStr,
      total,
      source: sourceUrl || 'iaa.gov.il',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      proxyUsed: !!PROXY,
      success: total > 0
    };

    // Save verification log
    const logFile = join(VERIFY_DIR, 'flight-log-TLV.json');
    let log = { airport: 'TLV', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(result);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    if (total > 0) {
      updateHealth('flight_tlv', {
        newValue: String(total),
        method: 'playwright',
        sourceUrl: sourceUrl
      });
    }

    console.log(`[TLV] ${total} flights`);
    return result;

  } catch (err) {
    // TLV failures are expected (geo-blocking) - warn, don't error
    console.warn(`[TLV] Scrape failed (expected - geo-blocked?): ${err.message}`);

    const failLog = {
      date: dateStr,
      error: err.message,
      source: 'iaa.gov.il',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      success: false
    };
    const logFile = join(VERIFY_DIR, 'flight-log-TLV.json');
    let log = { airport: 'TLV', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(failLog);
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    return null;
  } finally {
    await browser.close();
  }
}

runScraper('TLV', scrapeTLV).catch(console.error);
