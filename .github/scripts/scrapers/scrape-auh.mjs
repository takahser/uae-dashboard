#!/usr/bin/env node
/**
 * AUH (Abu Dhabi / Zayed International Airport) flight scraper
 *
 * API discovered via JS bundle analysis of zayedinternationalairport.ae
 * Endpoint: /api/zayed/flight/{type}?SearchKey=&day={offset}&PageSize=500&Language=en
 *   type  : departure | arrival | all
 *   day   : 0 = today, -1 = yesterday, 1 = tomorrow
 * No authentication required — works as a plain HTTP GET.
 */
import { updateHealth } from '../lib/health-writer.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const VERIFY_DIR = join(REPO_ROOT, 'public/verification');
const PUBLIC_DIR = join(REPO_ROOT, 'public');
mkdirSync(VERIFY_DIR, { recursive: true });

const BASE_URL = 'https://www.zayedinternationalairport.ae/api/zayed/flight';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.zayedinternationalairport.ae/en/flights-and-check-in/flight-status/departures',
};

/**
 * Fetch flight count from the AUH API.
 * @param {'departure'|'arrival'|'all'} type
 * @param {number} day  0 = today, -1 = yesterday, 1 = tomorrow
 * @returns {Promise<{total: number, flights: object[]}>}
 */
async function fetchFlights(type, day = -1) {
  const url = `${BASE_URL}/${type}?SearchKey=&day=${day}&PageSize=500&Language=en`;
  console.log(`[AUH] Fetching ${type} day=${day}: ${url}`);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`AUH API HTTP ${res.status} ${res.statusText} for ${type}`);
  const json = await res.json();
  const result = json?.result;
  if (!result) throw new Error(`AUH API unexpected response shape for ${type}`);
  const flights = Array.isArray(result.data) ? result.data : [];
  // Prefer total_count (server-side total) over array length, in case pagination applies
  const total = typeof result.total_count === 'number' ? result.total_count : flights.length;
  return { total, flights };
}

/**
 * Get yesterday's date string in YYYY-MM-DD (for verification log labelling).
 */
function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function scrapeAUH() {
  const dateStr = getYesterday();
  let departures = 0;
  let arrivals = 0;

  try {
    // Fetch yesterday's departure and arrival counts (day = -1)
    const [depResult, arrResult] = await Promise.all([
      fetchFlights('departure', -1),
      fetchFlights('arrival', -1),
    ]);

    departures = depResult.total;
    arrivals = arrResult.total;

    const result = {
      date: dateStr,
      departures,
      arrivals,
      total: departures + arrivals,
      source: 'zayedinternationalairport.ae',
      method: 'direct-api',
      apiEndpoint: `${BASE_URL}/{departure|arrival}?day=-1&PageSize=500`,
      fetchedAt: new Date().toISOString(),
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

    // Update main data file (data-flights-auh.json) — used by dashboard
    // Clearly tagged source: 'zayedinternationalairport.ae' (official)
    // vs 'aerodatabox' (3rd party) or 'fr24' (3rd party) in other entries
    const mainDataFile = join(PUBLIC_DIR, 'data-flights-auh.json');
    try {
      let mainData = { airport: 'AUH', airportName: 'Abu Dhabi International (Zayed)', daily: [] };
      try { mainData = JSON.parse(readFileSync(mainDataFile, 'utf8')); } catch {}

      const officialEntry = {
        date: dateStr,
        departures,
        arrivals,
        total: departures + arrivals,
        source: 'zayedinternationalairport.ae', // official direct API — NOT 3rd party
        method: 'direct-api',
        fetchedAt: new Date().toISOString(),
      };

      // Replace any existing entry for this date (official data takes priority)
      mainData.daily = (mainData.daily || []).filter(e => e.date !== dateStr);
      mainData.daily.push(officialEntry);
      mainData.daily.sort((a, b) => a.date.localeCompare(b.date));
      mainData.lastUpdated = new Date().toISOString();

      writeFileSync(mainDataFile, JSON.stringify(mainData, null, 2) + '\n');
      console.log(`[AUH] ✅ Wrote official entry to data-flights-auh.json (source: zayedinternationalairport.ae)`);
    } catch (writeErr) {
      console.error('[AUH] ⚠️ Failed to update data-flights-auh.json:', writeErr.message);
      // Non-fatal — verification log is still written
    }

    // Update health
    updateHealth('flight_auh', {
      newValue: String(result.total),
      method: 'direct-api',
      sourceUrl: 'zayedinternationalairport.ae/api/zayed/flight',
    });

    console.log(`[AUH] ✅ ${result.total} flights (${departures} dep, ${arrivals} arr) for ${dateStr}`);
    return result;

  } catch (err) {
    const failLog = {
      date: dateStr,
      error: err.message,
      source: 'zayedinternationalairport.ae',
      method: 'direct-api',
      fetchedAt: new Date().toISOString(),
      success: false,
    };
    const logFile = join(VERIFY_DIR, 'flight-log-AUH.json');
    let log = { airport: 'AUH', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(failLog);
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    console.error('[AUH] ❌ Scrape failed:', err.message);
    return null;
  }
}

// If called with --run-now or directly, execute immediately
// Otherwise export for use by runner
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  scrapeAUH().then(result => {
    if (!result) process.exit(1);
  }).catch(err => {
    console.error('[AUH] Fatal:', err);
    process.exit(1);
  });
}

export { scrapeAUH };
