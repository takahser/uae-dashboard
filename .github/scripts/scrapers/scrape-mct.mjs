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

const TIMEOUT = 60000;
const SCROLL_COUNT = 20;
const SCROLL_DELAY = 600;

const MCT_URLS = [
  'https://www.omanairports.co.om/flight-information',
  'https://www.omanairports.co.om/mct/flights',
  'https://www.muscatairport.co.om/flights'
];

async function scrapeMCT() {
  const { browser, context } = await createStealthBrowser();
  const page = await context.newPage();
  const dateStr = getYesterday();
  let total = 0;
  let sourceUrl = '';

  try {
    for (const url of MCT_URLS) {
      try {
        console.log(`[MCT] Trying ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(8000); // Extra wait for slow render

        await scrollToLoadAll(page, { scrollCount: SCROLL_COUNT, delay: SCROLL_DELAY });

        // Look for flight rows in DOM
        const rows = await page.evaluate(() => {
          return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"], [class*="item"]')]
            .map(el => el.innerText?.trim())
            .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
        });

        if (rows.length > 0) {
          total = rows.length;
          sourceUrl = url;
          console.log(`[MCT] Found ${total} flights at ${url}`);
          break;
        }

        // Also check for iframes containing flight data
        const frames = page.frames();
        for (const frame of frames) {
          if (frame === page.mainFrame()) continue;
          try {
            const iframeRows = await frame.evaluate(() => {
              return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"]')]
                .map(el => el.innerText?.trim())
                .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
            });
            if (iframeRows.length > 0) {
              total = iframeRows.length;
              sourceUrl = url;
              console.log(`[MCT] Found ${total} flights in iframe at ${url}`);
              break;
            }
          } catch {}
        }

        if (total > 0) break;
        console.log(`[MCT] No flights at ${url}, trying next...`);

      } catch (e) {
        console.log(`[MCT] ${url} failed: ${e.message}, trying next...`);
      }
    }

    const result = {
      date: dateStr,
      total,
      source: sourceUrl || 'omanairports.co.om',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      success: total > 0
    };

    // Save verification log
    const logFile = join(VERIFY_DIR, 'flight-log-MCT.json');
    let log = { airport: 'MCT', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(result);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    if (total > 0) {
      updateHealth('flight_mct', {
        newValue: String(total),
        method: 'playwright',
        sourceUrl: sourceUrl
      });
    }

    console.log(`[MCT] ${total} flights`);
    return result;

  } catch (err) {
    const failLog = {
      date: dateStr,
      error: err.message,
      source: 'omanairports.co.om',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      success: false
    };
    const logFile = join(VERIFY_DIR, 'flight-log-MCT.json');
    let log = { airport: 'MCT', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(failLog);
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    console.error('[MCT] Scrape failed:', err.message);
    return null;
  } finally {
    await browser.close();
  }
}

runScraper('MCT', scrapeMCT).catch(console.error);
