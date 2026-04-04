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

const DWC_API = 'https://dwc.dubaiairports.ae/docs/passengerslibraries/flights-library/flights-data.json';

async function scrapeDWC() {
  const dateStr = getYesterday();
  let total = 0;
  let departures = 0;
  let arrivals = 0;
  let method = '';

  // Strategy 1: Try direct API first (same pattern as DXB Phase 1)
  try {
    console.log('[DWC] Trying API endpoint...');
    const res = await fetch(DWC_API, {
      headers: {
        'Referer': 'https://dwc.dubaiairports.ae/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const flights = data.Flights || data.flights || data;

      if (Array.isArray(flights) && flights.length > 0) {
        departures = flights.filter(f =>
          (f.FlightType === 'D' || f.FlightType === 'Departure' || f.type === 'departure') &&
          (f.ScheduledDate?.startsWith(dateStr) || f.scheduled?.startsWith(dateStr))
        ).length;
        arrivals = flights.filter(f =>
          (f.FlightType === 'A' || f.FlightType === 'Arrival' || f.type === 'arrival') &&
          (f.ScheduledDate?.startsWith(dateStr) || f.scheduled?.startsWith(dateStr))
        ).length;

        // If no date filtering matched, count all
        if (departures === 0 && arrivals === 0) {
          departures = flights.filter(f => f.FlightType === 'D' || f.FlightType === 'Departure' || f.type === 'departure').length;
          arrivals = flights.filter(f => f.FlightType === 'A' || f.FlightType === 'Arrival' || f.type === 'arrival').length;
        }

        total = departures + arrivals;
        method = 'api';
        console.log(`[DWC] API returned ${total} flights (${departures} dep, ${arrivals} arr)`);
      }
    }
  } catch (err) {
    console.log(`[DWC] API failed: ${err.message}, falling back to Playwright...`);
  }

  // Strategy 2: Playwright fallback
  if (total === 0) {
    method = 'playwright';
    const { browser, context } = await createStealthBrowser();
    const page = await context.newPage();

    try {
      console.log('[DWC] Loading flight page via Playwright...');
      await page.goto('https://dwc.dubaiairports.ae/flights', {
        waitUntil: 'networkidle',
        timeout: 60000
      });
      await page.waitForTimeout(5000);
      await scrollToLoadAll(page);

      const rows = await page.evaluate(() => {
        return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"], [class*="item"]')]
          .map(el => el.innerText?.trim())
          .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
      });

      total = rows.length;
      console.log(`[DWC] Playwright found ${total} flights`);
    } finally {
      await browser.close();
    }
  }

  const result = {
    date: dateStr,
    departures,
    arrivals,
    total,
    source: 'dwc.dubaiairports.ae',
    method,
    fetchedAt: new Date().toISOString(),
    success: total > 0
  };

  // Save verification log
  const logFile = join(VERIFY_DIR, 'flight-log-DWC.json');
  let log = { airport: 'DWC', entries: [] };
  try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
  log.entries = log.entries.filter(e => e.date !== dateStr);
  log.entries.push(result);
  log.entries.sort((a, b) => a.date.localeCompare(b.date));
  log.lastUpdated = new Date().toISOString();
  writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

  if (total > 0) {
    updateHealth('flight_dwc', {
      newValue: String(total),
      method,
      sourceUrl: 'dwc.dubaiairports.ae'
    });
  }

  console.log(`[DWC] ${total} flights`);
  return result;
}

runScraper('DWC', scrapeDWC).catch(console.error);
