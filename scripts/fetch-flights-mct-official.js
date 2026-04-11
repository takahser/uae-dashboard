#!/usr/bin/env node
/**
 * Fetch MCT flight data from official Muscat Airport website.
 * Scrapes https://www.muscatairport.co.om flight schedule pages.
 * 
 * Endpoints (discovered via browser inspection):
 *   - Arrivals:   https://www.muscatairport.co.om/flightstatusframe?type=1
 *   - Departures: https://www.muscatairport.co.om/flightstatusframe?type=2
 * 
 * The schedule data is rendered server-side into the initial HTML document.
 * No JSON API exists. Plain fetch() + cheerio is sufficient.
 * 
 * Output: public/data-flights-mct.json (overwrites OpenSky data for MCT)
 * 
 * Note: The site shows today's schedule only. Historical baseline data
 * comes from the OpenSky-based fetcher (fetch-flights-mct-doh.js).
 * This fetcher contributes today + going forward.
 */

import { readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseArrivals, parseDepartures } from "./lib/mct-official-parser.js";
import { classifyRegion } from "./lib/regions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AIRPORT = { icao: "OOMS", iata: "mct", name: "Muscat International (MCT) }" };
const CONFLICT_START = "2026-02-28";
const BASELINE_START = "2026-02-18";

// Official MCT flight status endpoints (iframe URLs)
const MCT_ARRIVALS_URL = "https://www.muscatairport.co.om/flightstatusframe?type=1";
const MCT_DEPARTURES_URL = "https://www.muscatairport.co.om/flightstatusframe?type=2";

const USER_AGENT = "Mozilla/5.0 (compatible; UAEDashboard/1.0; +https://github.com/takahser/uae-dashboard)";

/**
 * Delay for specified milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch flight data with retry logic
 */
async function fetchFlightData(url, retryCount = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en",
        "Accept": "text/html",
      },
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 503) {
        // Rate limited or service unavailable - retry once
        if (retryCount === 0) {
          console.log(`  Got ${res.status}, retrying after 5s...`);
          await delay(5000);
          return fetchFlightData(url, retryCount + 1);
        }
      }
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.text();
  } catch (e) {
    if (retryCount === 0 && e.message?.includes("fetch failed")) {
      // Network error - retry once
      console.log(`  Fetch failed, retrying after 5s...`);
      await delay(5000);
      return fetchFlightData(url, retryCount + 1);
    }
    throw e;
  }
}

/**
 * Get today's flight data from official source
 */
async function getTodayData(dateStr) {
  console.log(`  Fetching arrivals...`);
  const arrivalsHtml = await fetchFlightData(MCT_ARRIVALS_URL);
  await delay(500); // Rate limiting
  
  console.log(`  Fetching departures...`);
  const departuresHtml = await fetchFlightData(MCT_DEPARTURES_URL);

  // Parse flights
  const arrivals = parseArrivals(arrivalsHtml);
  const departures = parseDepartures(departuresHtml);

  console.log(`    Parsed ${arrivals.length} arrivals, ${departures.length} departures`);

  // Aggregate regions from departures (we have dest info) and arrivals (we have origin info)
  const regions = {};
  
  for (const f of departures) {
    const r = classifyRegion(f.destIcao);
    regions[r] = (regions[r] || 0) + 1;
  }
  
  for (const f of arrivals) {
    const r = classifyRegion(f.originIcao);
    regions[r] = (regions[r] || 0) + 1;
  }

  return {
    date: dateStr,
    departures: departures.length,
    arrivals: arrivals.length,
    total: departures.length + arrivals.length,
    regions,
  };
}

/**
 * Compute baseline daily average from existing data
 */
function computeBaseline(daily) {
  const baselineDays = daily.filter(d => d.date >= BASELINE_START && d.date < CONFLICT_START);
  
  if (baselineDays.length === 0) {
    return null;
  }

  const n = baselineDays.length;
  const regions = {};
  let totalDep = 0, totalArr = 0, totalAll = 0;
  
  for (const d of baselineDays) {
    totalDep += d.departures;
    totalArr += d.arrivals;
    totalAll += d.total;
    for (const [r, c] of Object.entries(d.regions)) {
      regions[r] = (regions[r] || 0) + c;
    }
  }

  return {
    total: Math.round(totalAll / n),
    departures: Math.round(totalDep / n),
    arrivals: Math.round(totalArr / n),
    regions: Object.fromEntries(Object.entries(regions).map(([r, c]) => [r, Math.round(c / n)])),
  };
}

/**
 * Load existing data from OpenSky file if available
 */
function loadExistingData() {
  // Try to load from the main MCT file first (may have been previously updated by this script)
  const mainFile = join(__dirname, "..", "public", "data-flights-mct.json");
  // Fall back to OpenSky file for historical data
  const openskyFile = join(__dirname, "..", "public", "data-flights-mct-opensky.json");

  let existing = null;
  
  for (const file of [mainFile, openskyFile]) {
    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
      if (data.daily && data.daily.length > 0) {
        if (!existing) {
          existing = data;
        } else {
          // Merge data, preferring main file entries
          const dates = new Set(existing.daily.map(d => d.date));
          for (const d of data.daily) {
            if (!dates.has(d.date)) {
              existing.daily.push(d);
            }
          }
        }
      }
    } catch {
      // File doesn't exist or is invalid, continue
    }
  }

  if (!existing) {
    existing = { airport: AIRPORT.icao, airportName: AIRPORT.name, daily: [] };
  }

  // Ensure daily is sorted
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));
  
  return existing;
}

async function main() {
  console.log(`[${AIRPORT.icao}] Fetching official MCT flight data...`);

  const existing = loadExistingData();
  
  // Get today's date in Oman timezone (UTC+4)
  const now = new Date();
  const omanOffset = 4 * 60 * 60 * 1000; // 4 hours in ms
  const omanNow = new Date(now.getTime() + omanOffset);
  const todayStr = omanNow.toISOString().slice(0, 10);

  console.log(`  Today (Oman): ${todayStr}`);

  // Check if we already have today's data from official source
  const todayEntry = existing.daily.find(d => d.date === todayStr);
  const isFromOfficial = todayEntry?.source === "muscatairport.co.om";

  if (todayEntry && isFromOfficial) {
    console.log(`  Today's data already fetched from official source.`);
  } else {
    try {
      const dayData = await getTodayData(todayStr);
      dayData.source = "muscatairport.co.om";
      
      // Replace or add today's data
      const existingIndex = existing.daily.findIndex(d => d.date === todayStr);
      if (existingIndex >= 0) {
        existing.daily[existingIndex] = dayData;
      } else {
        existing.daily.push(dayData);
      }
      
      console.log(`  Added/updated today: ${dayData.total} flights`);
    } catch (e) {
      console.error(`  Error fetching today: ${e.message}`);
      // Continue with existing data
    }
  }

  // Sort daily by date
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recompute baseline
  const baselineDailyAvg = computeBaseline(existing.daily);
  if (baselineDailyAvg) {
    existing.baselineDailyAvg = baselineDailyAvg;
  }

  // Update metadata
  existing.source = "muscatairport.co.om";
  existing.lastUpdated = new Date().toISOString();

  // Write output atomically
  const outputFile = join(__dirname, "..", "public", "data-flights-mct.json");
  const tmpFile = outputFile + ".tmp";
  
  writeFileSync(tmpFile, JSON.stringify(existing, null, 2) + "\n");
  renameSync(tmpFile, outputFile);
  
  console.log(`[${AIRPORT.icao}] Updated ${outputFile}`);
  console.log(`  Total days: ${existing.daily.length}`);
  if (existing.baselineDailyAvg) {
    console.log(`  Baseline avg: ${existing.baselineDailyAvg.total} flights/day`);
  }
  console.log("Done.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
