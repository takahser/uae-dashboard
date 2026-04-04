#!/usr/bin/env node
import { createStealthBrowser, scrollToLoadAll, interceptJSON, runScraper, getYesterday } from '../lib/browser-utils.mjs';
import { updateHealth } from '../lib/health-writer.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const VERIFY_DIR = join(REPO_ROOT, 'public/verification');
mkdirSync(VERIFY_DIR, { recursive: true });

async function scrapeAUH() {
  const { browser, context } = await createStealthBrowser();
  const page = await context.newPage();
  const apiResponses = await interceptJSON(page, ['api', 'flight', 'fids', 'graphql']);

  const dateStr = getYesterday();
  let departures = 0;
  let arrivals = 0;

  try {
    // --- Departures ---
    console.log('[AUH] Loading departures...');
    await page.goto('https://www.zayedinternationalairport.ae/en/flights/departures', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(5000); // Allow hydration

    // Strategy 1: Check for __NEXT_DATA__
    const nextData = await page.evaluate(() => {
      const el = document.getElementById('__NEXT_DATA__');
      return el ? JSON.parse(el.textContent) : null;
    });

    if (nextData?.props?.pageProps?.flights) {
      console.log('[AUH] Found __NEXT_DATA__ flights');
      const flights = nextData.props.pageProps.flights;
      departures = flights.filter(f => f.type === 'departure' && f.date?.startsWith(dateStr)).length;
    } else {
      // Strategy 2: Check intercepted API responses
      if (apiResponses.length > 0) {
        console.log(`[AUH] Found ${apiResponses.length} API response(s), inspecting...`);
        for (const resp of apiResponses) {
          const flights = resp.body?.flights || resp.body?.data?.flights || resp.body?.Flights;
          if (Array.isArray(flights)) {
            departures = flights.filter(f =>
              (f.type === 'departure' || f.direction === 'D') &&
              (f.date?.startsWith(dateStr) || f.scheduled?.startsWith(dateStr))
            ).length;
            if (departures > 0) break;
          }
        }
      }

      // Strategy 3: DOM scraping fallback
      if (departures === 0) {
        console.log('[AUH] Falling back to DOM scraping for departures...');
        await scrollToLoadAll(page);
        const depRows = await page.evaluate(() => {
          return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"]')]
            .map(el => el.innerText?.trim())
            .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
        });
        departures = depRows.length;
      }
    }

    // --- Arrivals ---
    console.log('[AUH] Loading arrivals...');
    await page.goto('https://www.zayedinternationalairport.ae/en/flights/arrivals', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    await page.waitForTimeout(5000);
    await scrollToLoadAll(page);

    const arrRows = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"]')]
        .map(el => el.innerText?.trim())
        .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
    });
    arrivals = arrRows.length;

    const result = {
      date: dateStr,
      departures,
      arrivals,
      total: departures + arrivals,
      source: 'zayedinternationalairport.ae',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      apiEndpointsFound: apiResponses.length
    };

    // Save verification log
    const logFile = join(VERIFY_DIR, 'flight-log-AUH.json');
    let log = { airport: 'AUH', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(result);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    // Update health
    updateHealth('flight_auh', {
      newValue: String(result.total),
      method: 'playwright',
      sourceUrl: 'zayedinternationalairport.ae'
    });

    console.log(`[AUH] ${result.total} flights (${departures} dep, ${arrivals} arr)`);
    return result;

  } catch (err) {
    // Log failure to verification
    const failLog = {
      date: dateStr,
      error: err.message,
      source: 'zayedinternationalairport.ae',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      success: false
    };
    const logFile = join(VERIFY_DIR, 'flight-log-AUH.json');
    let log = { airport: 'AUH', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(failLog);
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    console.error('[AUH] Scrape failed:', err.message);
    return null;
  } finally {
    await browser.close();
  }
}

runScraper('AUH', scrapeAUH).catch(console.error);
