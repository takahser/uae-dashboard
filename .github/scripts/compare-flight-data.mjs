#!/usr/bin/env node
/**
 * Compare official API data against AeroDataBox and flag discrepancies.
 * Writes alert=true/false to GITHUB_OUTPUT if running in GitHub Actions.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '../../public');
const VERIFY_DIR = join(PUBLIC_DIR, 'verification');

const DISCREPANCY_THRESHOLD = 0.10; // 10%

function getYesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

function loadVerificationLog(iata) {
  try {
    return JSON.parse(readFileSync(join(VERIFY_DIR, `flight-log-${iata}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function loadAeroDataBox(iata) {
  try {
    return JSON.parse(readFileSync(join(PUBLIC_DIR, `data-flights-${iata.toLowerCase()}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function compareAirport(iata, dateStr) {
  const verifyLog = loadVerificationLog(iata);
  const aeroData = loadAeroDataBox(iata);

  if (!verifyLog || !aeroData) {
    return { iata, date: dateStr, status: 'missing_data' };
  }

  const official = verifyLog.entries?.find(e => e.date === dateStr);
  const aero = aeroData.daily?.find(d => d.date === dateStr);

  if (!official || !aero) {
    return { iata, date: dateStr, status: 'date_not_found' };
  }

  const diff = Math.abs(official.total - aero.total);
  const pctDiff = aero.total > 0 ? diff / aero.total : 0;

  return {
    iata,
    date: dateStr,
    official: official.total,
    aerodatabox: aero.total,
    diff,
    pctDiff: Math.round(pctDiff * 100),
    alert: pctDiff > DISCREPANCY_THRESHOLD,
    details: {
      official: { dep: official.departures, arr: official.arrivals },
      aerodatabox: { dep: aero.departures, arr: aero.arrivals }
    }
  };
}

async function main() {
  const yesterday = getYesterday();
  const airports = ['DXB', 'DOH', 'JED'];

  console.log(`Comparing data for: ${yesterday}\n`);

  const results = [];
  let anyAlert = false;

  for (const iata of airports) {
    const cmp = compareAirport(iata, yesterday);
    results.push(cmp);

    if (cmp.status) {
      console.log(`${iata}: ${cmp.status}`);
    } else {
      const icon = cmp.alert ? '⚠️' : '✓';
      console.log(`${icon} ${iata}: official=${cmp.official}, aero=${cmp.aerodatabox}, diff=${cmp.diff} (${cmp.pctDiff}%)`);
      if (cmp.alert) anyAlert = true;
    }
  }

  // Save discrepancy log
  const discFile = join(VERIFY_DIR, 'discrepancies.json');
  let discLog;
  try {
    discLog = JSON.parse(readFileSync(discFile, 'utf8'));
  } catch {
    discLog = { entries: [] };
  }

  const alertEntries = results.filter(r => r.alert);
  if (alertEntries.length > 0) {
    discLog.entries.push({
      date: yesterday,
      checkedAt: new Date().toISOString(),
      alerts: alertEntries
    });
    // Keep last 90 days
    discLog.entries = discLog.entries.slice(-90);
    writeFileSync(discFile, JSON.stringify(discLog, null, 2) + '\n');
  }

  // Set GitHub Actions output (no dependency on @actions/core)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `alert=${anyAlert ? 'true' : 'false'}\n`);
  }

  console.log(`\nAlert: ${anyAlert}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
