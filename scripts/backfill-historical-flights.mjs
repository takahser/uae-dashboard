#!/usr/bin/env node
/**
 * Backfill historical flight data from mid-February 2026 to early April 2026
 * using AeroDataBox API with CHO-115 correction factors.
 *
 * Date range: 2026-02-15 to 2026-04-02 (day before prod scraping started)
 * Merges into existing public/data-flights-{iata}.json files.
 */

import { readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
if (!RAPIDAPI_KEY) {
  console.error("RAPIDAPI_KEY environment variable is required");
  process.exit(1);
}

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";

const BASELINE_START = "2026-02-18";
const BASELINE_END = "2026-02-28";
const BACKFILL_START = "2026-02-15";
const BACKFILL_END = "2026-04-02";

const AIRPORTS = [
  { icao: "OMDB", iata: "dxb", name: "Dubai International (DXB)" },
  { icao: "OMAA", iata: "auh", name: "Abu Dhabi International (AUH)" },
  { icao: "OMDW", iata: "dwc", name: "Al Maktoum International (DWC)" },
  { icao: "OOMS", iata: "mct", name: "Muscat International (MCT)" },
  { icao: "OTHH", iata: "doh", name: "Hamad International (DOH)" },
  { icao: "LLBG", iata: "tlv", name: "Ben Gurion International (TLV)" },
  { icao: "OEJN", iata: "jed", name: "King Abdulaziz International (JED)" },
  { icao: "OERK", iata: "ruh", name: "King Khalid International (RUH)" },
];

// Correction factors from CHO-115 audit (spec table)
const CORRECTION_FACTORS = {
  dxb: { factor: 1 / 1.06, operation: "divide" },
  auh: { factor: 1.52, operation: "multiply" },
  doh: { factor: 1.68, operation: "multiply" },
  jed: { factor: 1.39, operation: "multiply" },
};

function getDates(start, end) {
  const dates = [];
  let cur = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getRateLimitDelay(response) {
  const remaining = response.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null && parseInt(remaining, 10) < 5) {
    return 3000;
  }
  return 1500; // 1.5s between requests to avoid 429s
}

async function fetchWindow(icao, date, fromHour, toHour) {
  const from = `${date}T${String(fromHour).padStart(2, "0")}:00`;
  const to = `${date}T${String(toHour).padStart(2, "0")}:59`;

  const params = new URLSearchParams({
    direction: "Both",
    withLeg: "false",
    withCancelled: "false",
    withCodeshared: "false",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "false",
  });

  const url = `https://${RAPIDAPI_HOST}/flights/airports/icao/${icao}/${from}/${to}?${params}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": RAPIDAPI_HOST,
      "x-rapidapi-key": RAPIDAPI_KEY,
      Accept: "application/json",
    },
  });

  if (res.status === 204) return { response: res, data: { departures: [], arrivals: [] } };
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return { response: res, data };
}

function classifyRegion(icao) {
  if (!icao) return "Unknown";
  const p2 = icao.slice(0, 2);
  const c = icao[0];

  // South Asia: V-prefixed (except VH) or OP
  if (c === "V" && p2 !== "VH") return "South Asia";
  if (p2 === "OP") return "South Asia";

  // Middle East: O-prefixed (except OP, already matched above)
  if (c === "O") return "Middle East";

  // Europe
  if (c === "E" || c === "L") return "Europe";

  // Asia-Pacific
  if (
    ["VH", "WA", "WI", "WS", "RC", "RJ", "RK", "ZS", "ZW", "ZY"].includes(p2) ||
    c === "Y"
  )
    return "Asia-Pacific";

  // Africa
  if ("DFGH".includes(c)) return "Africa";

  // Americas
  if ("KCMTS".includes(c)) return "Americas";

  return "Other";
}

function applyCorrection(value, factor) {
  return Math.round(value * factor);
}

function correctEntry(entry, airportIata) {
  const correction = CORRECTION_FACTORS[airportIata];
  if (!correction) {
    return { ...entry, source: "aeroDataBox-raw", uncorrected: true };
  }

  const f = correction.factor;
  const corrected = {
    date: entry.date,
    departures: applyCorrection(entry.departures, f),
    arrivals: applyCorrection(entry.arrivals, f),
    total: applyCorrection(entry.total, f),
    regions: {},
    source: "aeroDataBox-corrected",
  };

  for (const [region, count] of Object.entries(entry.regions || {})) {
    corrected.regions[region] = applyCorrection(count, f);
  }

  return corrected;
}

function computeBaseline(daily) {
  const baselineDays = daily.filter(
    (d) => d.date >= BASELINE_START && d.date <= BASELINE_END
  );
  if (baselineDays.length === 0) return undefined;

  const n = baselineDays.length;
  const regions = {};
  let totalDep = 0,
    totalArr = 0,
    totalAll = 0;

  for (const d of baselineDays) {
    totalDep += d.departures || 0;
    totalArr += d.arrivals || 0;
    totalAll += d.total || 0;
    for (const [r, c] of Object.entries(d.regions || {})) {
      regions[r] = (regions[r] || 0) + c;
    }
  }

  return {
    total: Math.round(totalAll / n),
    departures: Math.round(totalDep / n),
    arrivals: Math.round(totalArr / n),
    regions: Object.fromEntries(
      Object.entries(regions).map(([r, c]) => [r, Math.round(c / n)])
    ),
  };
}

async function backfillAirport(airport) {
  const filePath = join(PUBLIC_DIR, `data-flights-${airport.iata}.json`);
  let existing = { airport: airport.iata.toUpperCase(), daily: [] };
  try {
    existing = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {}
  if (!existing.daily) existing.daily = [];

  // Deduplicate by date — keep first occurrence (prod data is typically earlier)
  const seenDates = new Set();
  existing.daily = existing.daily.filter((d) => {
    if (seenDates.has(d.date)) {
      console.log(`  [WARN] duplicate entry for ${d.date} removed`);
      return false;
    }
    seenDates.add(d.date);
    return true;
  });

  // Index existing dates
  const existingByDate = new Map(existing.daily.map((d) => [d.date, d]));

  const dates = getDates(BACKFILL_START, BACKFILL_END);
  console.log(`\n📍 ${airport.name} — ${dates.length} days to check`);

  let added = 0;
  let corrected = 0;
  let skipped = 0;

  for (const date of dates) {
    const currentEntry = existingByDate.get(date);
    const source = currentEntry?.source;

    // Skip official scraper / prod data (anything not from our AeroDataBox pipeline)
    if (currentEntry && source !== "aerodatabox" && source !== "aeroDataBox-corrected" && source !== "aeroDataBox-raw") {
      console.log(`  [${date}] already present (source=${source || "missing"}), skipping`);
      skipped++;
      continue;
    }

    // Fast-path: apply correction in-place to existing uncorrected AeroDataBox entries
    if (currentEntry && source === "aerodatabox") {
      const updated = correctEntry(currentEntry, airport.iata);
      const idx = existing.daily.findIndex((d) => d.date === date);
      existing.daily[idx] = updated;
      existingByDate.set(date, updated);
      corrected++;
      console.log(`  [${date}] corrected in-place: dep=${updated.departures} arr=${updated.arrivals} total=${updated.total} source=${updated.source}`);
      continue;
    }

    // Skip already-corrected / already-raw entries (rerunnable idempotency)
    if (currentEntry && (source === "aeroDataBox-corrected" || source === "aeroDataBox-raw")) {
      skipped++;
      continue;
    }

    try {
      // Fetch AM (00:00–11:59)
      const amResult = await fetchWindow(airport.icao, date, 0, 11);
      let delayMs = getRateLimitDelay(amResult.response);
      await sleep(delayMs);

      // Fetch PM (12:00–23:59)
      const pmResult = await fetchWindow(airport.icao, date, 12, 23);
      delayMs = getRateLimitDelay(pmResult.response);
      await sleep(delayMs);

      const am = amResult.data;
      const pm = pmResult.data;

      const allDep = [...(am.departures || []), ...(pm.departures || [])];
      const allArr = [...(am.arrivals || []), ...(pm.arrivals || [])];
      const total = allDep.length + allArr.length;

      if (total === 0) {
        console.log(`  [${date}] no data returned — skipping`);
        continue;
      }

      // Build regional breakdown
      const regions = {};
      for (const f of allDep) {
        const icao = f.arrival?.airport?.icao || "";
        const region = classifyRegion(icao);
        regions[region] = (regions[region] || 0) + 1;
      }
      for (const f of allArr) {
        const icao = f.departure?.airport?.icao || "";
        const region = classifyRegion(icao);
        regions[region] = (regions[region] || 0) + 1;
      }

      const rawEntry = {
        date,
        departures: allDep.length,
        arrivals: allArr.length,
        total,
        regions,
      };

      const entry = correctEntry(rawEntry, airport.iata);

      if (currentEntry) {
        // Replace existing aeroDataBox-corrected entry
        const idx = existing.daily.findIndex((d) => d.date === date);
        existing.daily[idx] = entry;
      } else {
        existing.daily.push(entry);
        existingByDate.set(date, entry);
      }

      added++;
      console.log(
        `  [${date}] dep=${entry.departures} arr=${entry.arrivals} total=${entry.total} source=${entry.source}`
      );
    } catch (err) {
      console.error(`  [${date}] ERROR: ${err.message}`);
      await sleep(500);
    }
  }

  // Sort by date
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recompute baseline
  const baseline = computeBaseline(existing.daily);
  if (baseline) {
    existing.baselineDailyAvg = baseline;
    console.log(`  📊 baselineDailyAvg.total = ${baseline.total}`);
  }

  existing.lastUpdated = new Date().toISOString();

  // Atomic write
  const tmpFile = filePath + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(existing, null, 2) + "\n");
  renameSync(tmpFile, filePath);

  console.log(
    `  ✅ Saved ${existing.daily.length} entries (added ${added}, corrected ${corrected}, skipped ${skipped})`
  );
}

async function main() {
  console.log(`=== Historical flight backfill: ${BACKFILL_START} → ${BACKFILL_END} ===`);
  for (const airport of AIRPORTS) {
    await backfillAirport(airport);
  }
  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
