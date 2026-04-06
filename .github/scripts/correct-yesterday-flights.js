#!/usr/bin/env node
/**
 * correct-yesterday-flights.js
 *
 * Re-fetches yesterday's completed flight data from AeroDataBox (RapidAPI)
 * for all 9 tracked airports. Compares with stored values in
 * public/data-flights-{iata}.json and patches if numbers differ.
 * Writes every correction to public/data-flights-audit.json (90-day retention).
 *
 * Usage:
 *   node .github/scripts/correct-yesterday-flights.js           # live run
 *   node .github/scripts/correct-yesterday-flights.js --dry-run # logs only, no writes
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const PUBLIC_DIR = join(REPO_ROOT, "public");
const AUDIT_FILE = join(PUBLIC_DIR, "data-flights-audit.json");

const DRY_RUN = process.argv.includes("--dry-run");

// RapidAPI key for AeroDataBox — required, no fallback (set as repo secret)
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
if (!RAPIDAPI_KEY) {
  console.error("RAPIDAPI_KEY not set — aborting");
  process.exit(1);
}

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";

/** All 9 tracked airports with ICAO codes */
const AIRPORTS = [
  { iata: "DXB", icao: "OMDB", name: "Dubai International" },
  { iata: "AUH", icao: "OMAA", name: "Abu Dhabi Intl" },
  { iata: "DWC", icao: "OMDW", name: "Al Maktoum Intl" },
  { iata: "MCT", icao: "OOMS", name: "Muscat Intl" },
  { iata: "DOH", icao: "OTHH", name: "Hamad Intl" },
  { iata: "TLV", icao: "LLBG", name: "Ben Gurion Intl" },
  { iata: "JED", icao: "OEJN", name: "King Abdulaziz Intl" },
  { iata: "RUH", icao: "OERK", name: "King Khalid Intl" },
  { iata: "IKA", icao: "OIIE", name: "Imam Khomeini Intl" },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// AeroDataBox API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a half-day window of flights for an airport.
 * AeroDataBox FIDS supports max 12h per request.
 *
 * @param {string} icao  - ICAO airport code
 * @param {string} date  - ISO date "YYYY-MM-DD"
 * @param {string} from  - Start time "HH:MM" (local at airport — we use UTC approximation)
 * @param {string} to    - End time "HH:MM"
 * @returns {Promise<{departures: any[], arrivals: any[]} | null>}
 */
async function fetchWindow(icao, date, from, to) {
  const fromLocal = `${date}T${from}`;
  const toLocal = `${date}T${to}`;

  const params = new URLSearchParams({
    withLeg: "false",
    withCancelled: "false", // exclude cancelled — gives actual completed count
    withCodeshared: "false",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "false",
  });

  const url = `https://${RAPIDAPI_HOST}/flights/airports/icao/${icao}/${fromLocal}/${toLocal}?${params}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      `  [AeroDataBox] ${icao} ${fromLocal}→${toLocal}: HTTP ${res.status} — ${body.slice(0, 120)}`
    );
    return null;
  }

  const json = await res.json();
  return {
    departures: json.departures ?? [],
    arrivals: json.arrivals ?? [],
  };
}

/**
 * Count yesterday's completed departures + arrivals for one airport.
 * Makes two API calls (AM + PM windows) to cover the full 24h day.
 *
 * @param {string} icao
 * @param {string} date  "YYYY-MM-DD"
 * @returns {Promise<{departures: number, arrivals: number, total: number} | null>}
 */
async function fetchYesterdayCounts(icao, date) {
  // AM window: 00:00 → 11:59
  const am = await fetchWindow(icao, date, "00:00", "11:59");
  await delay(1200);

  // PM window: 12:00 → 23:59
  const pm = await fetchWindow(icao, date, "12:00", "23:59");

  if (!am && !pm) {
    console.warn(`  [${icao}] Both API windows failed — skipping`);
    return null;
  }

  const departures =
    (am?.departures.length ?? 0) + (pm?.departures.length ?? 0);
  const arrivals = (am?.arrivals.length ?? 0) + (pm?.arrivals.length ?? 0);
  const total = departures + arrivals;

  return { departures, arrivals, total };
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function readAudit() {
  try {
    if (existsSync(AUDIT_FILE)) {
      return JSON.parse(readFileSync(AUDIT_FILE, "utf8"));
    }
  } catch (e) {
    console.warn(`[audit] Could not read audit file: ${e.message}`);
  }
  return { corrections: [] };
}

function writeAuditEntry(entry) {
  const audit = readAudit();

  const correction = {
    iata: entry.iata,
    date: entry.date,
    old: entry.old,
    new: entry.new,
    delta: {
      departures: entry.new.departures - entry.old.departures,
      arrivals: entry.new.arrivals - entry.old.arrivals,
      total: entry.new.total - entry.old.total,
    },
    correctedAt: entry.correctedAt,
    reason: "day-before-correction",
  };

  // Deduplicate: replace if same iata+date already exists
  const existIdx = audit.corrections.findIndex(
    (c) => c.iata === entry.iata && c.date === entry.date
  );
  if (existIdx !== -1) {
    audit.corrections[existIdx] = correction;
  } else {
    audit.corrections.push(correction);
  }

  // Prune: keep only last 90 days
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  audit.corrections = audit.corrections.filter((c) => c.date >= cutoffStr);
  audit.lastPruned = new Date().toISOString();

  if (DRY_RUN) {
    console.log(
      `[audit] [DRY-RUN] Would write correction for ${entry.iata} ${entry.date}:`,
      JSON.stringify(correction, null, 2)
    );
  } else {
    writeFileSync(AUDIT_FILE, JSON.stringify(audit, null, 2) + "\n");
    console.log(`[audit] Wrote correction for ${entry.iata} ${entry.date}`);
  }
}

// ---------------------------------------------------------------------------
// Per-airport correction
// ---------------------------------------------------------------------------

async function correctAirport(airport, yesterdayDate) {
  const dataFile = join(
    PUBLIC_DIR,
    `data-flights-${airport.iata.toLowerCase()}.json`
  );

  if (!existsSync(dataFile)) {
    console.warn(`[${airport.iata}] Data file not found — skipping`);
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(dataFile, "utf8"));
  } catch (e) {
    console.warn(`[${airport.iata}] Could not parse data file: ${e.message}`);
    return;
  }

  if (!data.daily || !Array.isArray(data.daily)) {
    console.warn(`[${airport.iata}] No daily array — skipping`);
    return;
  }

  const idx = data.daily.findIndex((d) => d.date === yesterdayDate);
  if (idx === -1) {
    console.log(
      `[${airport.iata}] No entry for ${yesterdayDate} — skipping (first-run case)`
    );
    return;
  }

  const oldEntry = { ...data.daily[idx] };

  // In dry-run mode, skip actual API calls
  if (DRY_RUN) {
    console.log(
      `[${airport.iata}] [DRY-RUN] Would re-fetch ${yesterdayDate} from AeroDataBox (${airport.icao})`
    );
    console.log(
      `[${airport.iata}] [DRY-RUN] Current stored: departures=${oldEntry.departures} arrivals=${oldEntry.arrivals} total=${oldEntry.total}`
    );
    return;
  }

  // Fetch actual counts
  const counts = await fetchYesterdayCounts(airport.icao, yesterdayDate);

  if (!counts) {
    console.warn(`[${airport.iata}] API returned null — skipping`);
    return;
  }

  // Zero-return guard: if API returns 0 total but stored value had data, treat as API failure
  if (counts.total === 0 && oldEntry.total > 0) {
    console.warn(
      `[${airport.iata}] API returned 0 flights (stored: ${oldEntry.total}) — likely API failure, skipping`
    );
    return;
  }

  const { departures, arrivals, total } = counts;

  // No change? Nothing to do
  if (
    oldEntry.departures === departures &&
    oldEntry.arrivals === arrivals &&
    oldEntry.total === total
  ) {
    console.log(`[${airport.iata}] ${yesterdayDate} unchanged — no correction needed`);
    return;
  }

  const correctedAt = new Date().toISOString();

  // Patch the daily entry
  data.daily[idx] = {
    ...data.daily[idx],
    departures,
    arrivals,
    total,
    corrected: true,
    correctedAt,
  };

  writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `[${airport.iata}] ✓ Corrected ${yesterdayDate}: ` +
      `total ${oldEntry.total} → ${total} (Δ${total - oldEntry.total > 0 ? "+" : ""}${total - oldEntry.total}), ` +
      `dep ${oldEntry.departures} → ${departures}, arr ${oldEntry.arrivals} → ${arrivals}`
  );

  // Write to audit log
  writeAuditEntry({
    iata: airport.iata,
    date: yesterdayDate,
    old: {
      departures: oldEntry.departures,
      arrivals: oldEntry.arrivals,
      total: oldEntry.total,
    },
    new: { departures, arrivals, total },
    correctedAt,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);

  console.log(
    `\n=== Flight Data Correction: ${yesterdayDate}${DRY_RUN ? " [DRY-RUN]" : ""} ===\n`
  );

  // Ensure audit file exists
  if (!existsSync(AUDIT_FILE) && !DRY_RUN) {
    writeFileSync(AUDIT_FILE, JSON.stringify({ corrections: [] }, null, 2) + "\n");
    console.log("[audit] Initialised audit file");
  }

  let corrected = 0;
  let skipped = 0;

  for (const airport of AIRPORTS) {
    console.log(`\n[${airport.iata}] Processing ${airport.name}...`);
    try {
      const before = Date.now();
      await correctAirport(airport, yesterdayDate);
      // Rate-limit: pause between airports
      const elapsed = Date.now() - before;
      const wait = Math.max(0, 1500 - elapsed);
      if (wait > 0) await delay(wait);
    } catch (e) {
      console.error(`[${airport.iata}] Unexpected error: ${e.message}`);
      skipped++;
    }
  }

  console.log(
    `\n=== Done. ${DRY_RUN ? "[DRY-RUN — no files written]" : `Corrections applied.`} ===\n`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
