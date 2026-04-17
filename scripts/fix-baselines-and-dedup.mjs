#!/usr/bin/env node
/**
 * Helper script to:
 * 1. Remove duplicate entries from flight data files
 * 2. Recompute baselineDailyAvg using Feb 18-28 inclusive
 */

import { readFileSync, writeFileSync, renameSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const BASELINE_START = "2026-02-18";
const BASELINE_END = "2026-02-28";

const AIRPORTS = [
  "dxb", "auh", "dwc", "mct", "doh", "tlv", "jed", "ruh"
];

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

for (const iata of AIRPORTS) {
  const filePath = join(PUBLIC_DIR, `data-flights-${iata}.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`❌ Failed to read ${filePath}: ${err.message}`);
    continue;
  }

  if (!data.daily) {
    console.log(`⚠️ ${iata}: no daily array`);
    continue;
  }

  // Deduplicate: keep first occurrence for each date
  const seenDates = new Set();
  const originalCount = data.daily.length;
  data.daily = data.daily.filter((d) => {
    if (seenDates.has(d.date)) {
      return false;
    }
    seenDates.add(d.date);
    return true;
  });
  const removed = originalCount - data.daily.length;

  // Sort by date
  data.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recompute baseline
  const baseline = computeBaseline(data.daily);
  if (baseline) {
    data.baselineDailyAvg = baseline;
  }

  data.lastUpdated = new Date().toISOString();

  // Atomic write
  const tmpFile = filePath + ".tmp";
  writeFileSync(tmpFile, JSON.stringify(data, null, 2) + "\n");
  renameSync(tmpFile, filePath);

  console.log(
    `✅ ${iata.toUpperCase()}: ${data.daily.length} entries` +
    (removed > 0 ? ` (removed ${removed} duplicates)` : "") +
    (baseline ? `, baseline=${baseline.total}` : "")
  );
}
