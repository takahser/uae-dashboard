#!/usr/bin/env node
/**
 * refix-dxb-historical.mjs
 *
 * Re-fetch the pre-Apr-2 DXB daily flight series from AeroDataBox using the
 * post-fix parameter set (withCodeshared=false, operating flights only),
 * patch any day whose stored numbers differ, and recompute the derived
 * aggregates (preConflictAvg, baselineDailyAvg).
 *
 * Usage:
 *   RAPIDAPI_KEY=... node scripts/refix-dxb-historical.mjs
 *   RAPIDAPI_KEY=... node scripts/refix-dxb-historical.mjs --dry-run
 *   RAPIDAPI_KEY=... node scripts/refix-dxb-historical.mjs --from 2026-02-18 --to 2026-04-01 --airport DXB
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { classifyRegion } from "./lib/regions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(REPO_ROOT, "public");
const AUDIT_FILE = join(PUBLIC_DIR, "data-flights-audit.json");

const RAPIDAPI_HOST = "aerodatabox.p.rapidapi.com";

const DEFAULT_AIRPORT = "DXB";
const DEFAULT_ICAO = "OMDB";
const DEFAULT_FROM = "2026-02-18";
const DEFAULT_TO = "2026-04-01";
const PRE_CONFLICT_FROM = "2026-02-18";
const PRE_CONFLICT_TO = "2026-02-27";
const REGION_REPAIR_DATE = "2026-04-02";
const NOTE = "Fixed: withCodeshared=false (operating flights only)";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const airport = extractStringFlag(argv, "--airport") || DEFAULT_AIRPORT;
  const from = extractStringFlag(argv, "--from") || DEFAULT_FROM;
  const to = extractStringFlag(argv, "--to") || DEFAULT_TO;
  return { dryRun, airport: airport.toUpperCase(), from, to };
}

function extractStringFlag(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

export function getDatesInRange(from, to) {
  const dates = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Aggregate recomputation
// ---------------------------------------------------------------------------

export function recomputeAggregates(daily, from, to) {
  const window = daily.filter((d) => d.date >= from && d.date <= to);
  const totals = window.map((d) => d.total);
  const departures = window.map((d) => d.departures);
  const arrivals = window.map((d) => d.arrivals);

  const preConflictAvg = roundMean(totals);

  const regionNames = new Set();
  for (const d of window) {
    if (d.regions) {
      for (const k of Object.keys(d.regions)) regionNames.add(k);
    }
  }
  const regions = {};
  for (const name of regionNames) {
    const values = window.map((d) => (d.regions ? d.regions[name] ?? 0 : 0));
    regions[name] = roundMean(values);
  }

  return {
    preConflictAvg,
    baselineDailyAvg: {
      total: roundMean(totals),
      departures: roundMean(departures),
      arrivals: roundMean(arrivals),
      regions,
    },
  };
}

function roundMean(numbers) {
  if (!numbers.length) return 0;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return Math.round(sum / numbers.length);
}

// ---------------------------------------------------------------------------
// Region computation
// ---------------------------------------------------------------------------

export function computeRegions(departures, arrivals) {
  const regions = {};
  for (const flight of [...departures, ...arrivals]) {
    const icao = flight.movement?.airport?.icao || "";
    const region = classifyRegion(icao);
    regions[region] = (regions[region] || 0) + 1;
  }
  return regions;
}

// ---------------------------------------------------------------------------
// Entry construction
// ---------------------------------------------------------------------------

export function buildPatchedEntry(oldEntry, counts, correctedAt) {
  return {
    date: oldEntry.date,
    departures: counts.departures,
    arrivals: counts.arrivals,
    total: counts.total,
    regions: counts.regions,
    ...(oldEntry.cancelled !== undefined ? { cancelled: oldEntry.cancelled } : {}),
    source: oldEntry.source,
    corrected: true,
    correctedAt,
    note: NOTE,
  };
}

// ---------------------------------------------------------------------------
// Per-day comparison
// ---------------------------------------------------------------------------

export function countsEqual(stored, fetched) {
  return (
    stored.departures === fetched.departures &&
    stored.arrivals === fetched.arrivals &&
    stored.total === fetched.total
  );
}

/**
 * Decide what to do with one stored day given freshly fetched counts.
 * Returns { action: 'patch' | 'skip' | 'zero-guard', entry?, correctedAt? }
 * without mutating the original entry.
 */
export function processDate(oldEntry, fetched) {
  if (fetched.total === 0 && oldEntry.total > 0) {
    return { action: "zero-guard" };
  }
  if (countsEqual(oldEntry, fetched)) {
    return { action: "skip" };
  }
  const correctedAt = new Date().toISOString();
  return {
    action: "patch",
    entry: buildPatchedEntry(oldEntry, fetched, correctedAt),
    correctedAt,
  };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export async function fetchWindow(icao, date, from, to, rapidApiKey) {
  const fromLocal = `${date}T${from}`;
  const toLocal = `${date}T${to}`;

  const params = new URLSearchParams({
    direction: "Both",
    withLeg: "false",
    withCancelled: "false",
    withCodeshared: "false",
    withCargo: "false",
    withPrivate: "false",
    withLocation: "false",
  });

  const url = `https://${RAPIDAPI_HOST}/flights/airports/icao/${icao}/${fromLocal}/${toLocal}?${params}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": RAPIDAPI_HOST,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(
      `${icao} ${fromLocal}→${toLocal}: HTTP ${res.status} — ${body.slice(0, 120)}`
    );
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  return {
    departures: json.departures ?? [],
    arrivals: json.arrivals ?? [],
  };
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchDayCounts(icao, date, rapidApiKey, { onWindowDelay = delay } = {}) {
  const am = await fetchWindow(icao, date, "00:00", "11:59", rapidApiKey);
  await onWindowDelay(1200);
  const pm = await fetchWindow(icao, date, "12:00", "23:59", rapidApiKey);

  const allDepartures = [...am.departures, ...pm.departures];
  const allArrivals = [...am.arrivals, ...pm.arrivals];
  const departures = allDepartures.length;
  const arrivals = allArrivals.length;
  const total = departures + arrivals;

  return {
    departures,
    arrivals,
    total,
    regions: computeRegions(allDepartures, allArrivals),
  };
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

export function readAudit(auditFile = AUDIT_FILE) {
  try {
    if (existsSync(auditFile)) {
      return JSON.parse(readFileSync(auditFile, "utf8"));
    }
  } catch (e) {
    console.warn(`[audit] Could not read audit file: ${e.message}`);
  }
  return { corrections: [] };
}

export function writeAuditEntryNoPrune(entry, auditFile = AUDIT_FILE, dryRun = false) {
  const audit = readAudit(auditFile);

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
    reason: entry.reason,
  };

  const existIdx = (audit.corrections || []).findIndex(
    (c) => c.iata === entry.iata && c.date === entry.date
  );
  if (existIdx !== -1) {
    audit.corrections[existIdx] = correction;
  } else {
    audit.corrections.push(correction);
  }

  if (dryRun) {
    console.log(
      `[audit] [DRY-RUN] Would write correction for ${entry.iata} ${entry.date}:`,
      JSON.stringify(correction, null, 2)
    );
  } else {
    writeFileSync(auditFile, JSON.stringify(audit, null, 2) + "\n");
    console.log(`[audit] Wrote correction for ${entry.iata} ${entry.date}`);
  }

  return correction;
}

// ---------------------------------------------------------------------------
// Data file helpers
// ---------------------------------------------------------------------------

export function readDataFile(iata, publicDir = PUBLIC_DIR) {
  const dataFile = join(publicDir, `data-flights-${iata.toLowerCase()}.json`);
  if (!existsSync(dataFile)) {
    throw new Error(`Data file not found: ${dataFile}`);
  }
  return {
    dataFile,
    data: JSON.parse(readFileSync(dataFile, "utf8")),
  };
}

export function writeDataFile(dataFile, data, dryRun = false) {
  if (dryRun) {
    console.log(`[data] [DRY-RUN] Would write ${dataFile}`);
  } else {
    writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const { dryRun, airport, from, to } = parseArgs(argv);
  const icao = airport === DEFAULT_AIRPORT ? DEFAULT_ICAO : null;
  if (!icao) {
    throw new Error(`Unsupported airport: ${airport} (only DXB is supported)`);
  }

  const rapidApiKey = env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    throw new Error("RAPIDAPI_KEY not set — aborting");
  }

  const fetcher = deps.fetchDayCounts || fetchDayCounts;
  const reader = deps.readDataFile || readDataFile;
  const writer = deps.writeDataFile || writeDataFile;
  const auditor = deps.writeAuditEntryNoPrune || writeAuditEntryNoPrune;
  const auditFilePath = deps.auditFile || AUDIT_FILE;
  const onDateDelay = deps.onDateDelay || delay;

  console.log(
    `\n=== DXB historical codeshare refix: ${from} → ${to}${dryRun ? " [DRY-RUN]" : ""} ===\n`
  );

  const { dataFile, data } = reader(airport);
  if (!data.daily || !Array.isArray(data.daily)) {
    throw new Error("No daily array in data file");
  }

  // Ensure audit file exists for non-dry runs
  if (!existsSync(auditFilePath) && !dryRun) {
    writeFileSync(auditFilePath, JSON.stringify({ corrections: [] }, null, 2) + "\n");
    console.log("[audit] Initialised audit file");
  }

  const dates = getDatesInRange(from, to);
  const failedDates = [];
  const patchedDates = [];
  let isFirstDate = true;

  console.log(
    `${"date".padEnd(12)} ${"stored".padStart(18)} ${"fetched".padStart(18)} ${"status".padStart(12)}`
  );
  console.log("-".repeat(64));

  for (const date of dates) {
    const idx = data.daily.findIndex((d) => d.date === date);
    if (idx === -1) {
      console.log(`${date.padEnd(12)} ${"—".padStart(18)} ${"—".padStart(18)} ${"missing".padStart(12)}`);
      failedDates.push({ date, reason: "no stored entry" });
      if (isFirstDate) isFirstDate = false;
      continue;
    }

    const oldEntry = data.daily[idx];
    let fetched;
    try {
      fetched = await fetcher(icao, date, rapidApiKey);
    } catch (err) {
      console.log(
        `${date.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${"—".padStart(18)} ${"API fail".padStart(12)}`
      );
      console.warn(`  [AeroDataBox] ${err.message}`);
      failedDates.push({ date, reason: err.message });
      if (isFirstDate && (err.status === 401 || err.status === 403)) {
        console.error("\nAborting: historical access appears unavailable on the current RapidAPI plan.");
        return { patchedDates, failedDates, aborted: true, exitCode: 1 };
      }
      isFirstDate = false;
      continue;
    }

    const result = processDate(oldEntry, fetched);

    if (result.action === "zero-guard") {
      console.log(
        `${date.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${formatCounts(fetched).padStart(18)} ${"zero guard".padStart(12)}`
      );
      failedDates.push({ date, reason: "API returned 0 flights for a non-zero stored day" });
    } else if (result.action === "skip") {
      console.log(
        `${date.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${formatCounts(fetched).padStart(18)} ${"unchanged".padStart(12)}`
      );
    } else if (result.action === "patch") {
      console.log(
        `${date.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${formatCounts(fetched).padStart(18)} ${"PATCH".padStart(12)}`
      );
      data.daily[idx] = result.entry;
      patchedDates.push({
        date,
        oldEntry,
        newEntry: result.entry,
        correctedAt: result.correctedAt,
      });
    }

    isFirstDate = false;

    // Rate limiting between dates
    await onDateDelay(1500);
  }

  // Region-bucket repair for 2026-04-02 (the only post-Apr-1 date this script may touch)
  const repairIdx = data.daily.findIndex((d) => d.date === REGION_REPAIR_DATE);
  if (repairIdx !== -1) {
    const oldEntry = data.daily[repairIdx];
    let fetched;
    try {
      fetched = await fetcher(icao, REGION_REPAIR_DATE, rapidApiKey);
    } catch (err) {
      console.warn(`  [AeroDataBox] ${REGION_REPAIR_DATE} region repair failed: ${err.message}`);
      failedDates.push({ date: REGION_REPAIR_DATE, reason: `region repair: ${err.message}` });
    }

    if (fetched) {
      if (fetched.total === 0 && oldEntry.total > 0) {
        console.log(
          `${REGION_REPAIR_DATE.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${formatCounts(fetched).padStart(18)} ${"zero guard".padStart(12)}`
        );
        failedDates.push({
          date: REGION_REPAIR_DATE,
          reason: "API returned 0 flights for a non-zero stored day",
        });
      } else {
        const regionsDiffer =
          JSON.stringify(oldEntry.regions) !== JSON.stringify(fetched.regions);
        const needsPatch = !countsEqual(oldEntry, fetched) || regionsDiffer;
        if (needsPatch) {
          const correctedAt = new Date().toISOString();
          data.daily[repairIdx] = buildPatchedEntry(oldEntry, fetched, correctedAt);
          const alreadyPatched = patchedDates.find((p) => p.date === REGION_REPAIR_DATE);
          if (!alreadyPatched) {
            patchedDates.push({
              date: REGION_REPAIR_DATE,
              oldEntry,
              newEntry: data.daily[repairIdx],
              correctedAt,
            });
          }
          console.log(
            `${REGION_REPAIR_DATE.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${formatCounts(fetched).padStart(18)} ${"region repair".padStart(12)}`
          );
        } else {
          console.log(
            `${REGION_REPAIR_DATE.padEnd(12)} ${formatCounts(oldEntry).padStart(18)} ${formatCounts(fetched).padStart(18)} ${"unchanged".padStart(12)}`
          );
        }
      }
    }
  }

  // Recompute aggregates from the pre-conflict window
  const previousPreConflictAvg = data.preConflictAvg;
  const previousBaselineDailyAvg = data.baselineDailyAvg;

  const { preConflictAvg, baselineDailyAvg } = recomputeAggregates(
    data.daily,
    PRE_CONFLICT_FROM,
    PRE_CONFLICT_TO
  );

  data.preConflictAvg = preConflictAvg;
  data.baselineDailyAvg = baselineDailyAvg;

  const aggregatesChanged =
    previousPreConflictAvg !== preConflictAvg ||
    JSON.stringify(previousBaselineDailyAvg) !== JSON.stringify(baselineDailyAvg);

  if (patchedDates.length > 0 || aggregatesChanged) {
    data.lastUpdated = new Date().toISOString();
  }

  // Write audit entries for patched dates
  for (const patch of patchedDates) {
    auditor(
      {
        iata: airport,
        date: patch.date,
        old: {
          departures: patch.oldEntry.departures,
          arrivals: patch.oldEntry.arrivals,
          total: patch.oldEntry.total,
        },
        new: {
          departures: patch.newEntry.departures,
          arrivals: patch.newEntry.arrivals,
          total: patch.newEntry.total,
        },
        correctedAt: patch.correctedAt,
        reason: "codeshare-refix",
      },
      auditFilePath,
      dryRun
    );
  }

  // Write data file
  writer(dataFile, data, dryRun);

  // Summary
  console.log("\n" + "=".repeat(64));
  console.log(`Patched days:     ${patchedDates.length}`);
  console.log(`Failed days:      ${failedDates.length}`);
  console.log(`preConflictAvg:   ${preConflictAvg}`);
  console.log(`baselineDailyAvg: total=${baselineDailyAvg.total} dep=${baselineDailyAvg.departures} arr=${baselineDailyAvg.arrivals}`);
  if (dryRun) {
    console.log("[DRY-RUN — no files written]");
  }

  const exitCode = failedDates.length > 0 ? 1 : 0;
  return { patchedDates, failedDates, preConflictAvg, baselineDailyAvg, exitCode };
}

function formatCounts(entry) {
  return `d=${entry.departures} a=${entry.arrivals} t=${entry.total}`;
}

// Only run main when invoked directly (not imported by tests)
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().then((result) => {
    process.exit(result.exitCode);
  }).catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
