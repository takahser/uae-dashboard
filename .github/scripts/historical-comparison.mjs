#!/usr/bin/env node
/**
 * Historical accuracy comparison: Official APIs vs AeroDataBox
 * 
 * 1. Pulls ALL available days from each official API
 * 2. Compares against AeroDataBox data in public/data-flights-*.json
 * 3. Outputs table: date | airport | official_count | aerobox_count | match_%
 * 4. Saves results to public/verification/historical-accuracy.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '../../public');
const VERIFY_DIR = join(PUBLIC_DIR, 'verification');

mkdirSync(VERIFY_DIR, { recursive: true });

// Utility functions
function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getYesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatDOH(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchWithTimeout(url, opts = {}, timeout = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────
// Load AeroDataBox data
// ─────────────────────────────────────────────────────────────
function loadAeroDataBox(iata) {
  try {
    const file = join(PUBLIC_DIR, `data-flights-${iata.toLowerCase()}.json`);
    const data = JSON.parse(readFileSync(file, 'utf8'));
    // Create a map of date -> entry for quick lookup
    const dateMap = new Map();
    if (data.daily && Array.isArray(data.daily)) {
      for (const entry of data.daily) {
        dateMap.set(entry.date, entry);
      }
    }
    return { data, dateMap };
  } catch (err) {
    console.error(`Failed to load AeroDataBox data for ${iata}:`, err.message);
    return { data: null, dateMap: new Map() };
  }
}

// ─────────────────────────────────────────────────────────────
// Official API fetchers (historical)
// ─────────────────────────────────────────────────────────────

// DXB: Fetches from rolling window and filters by date
async function fetchDXBRange(daysBack = 7) {
  console.log('Fetching DXB historical data...');
  const url = 'https://dubaiairports.ae/docs/passengerslibraries/flights-library/flights-data.json';
  
  const res = await fetchWithTimeout(url, {
    headers: { 'Referer': 'https://dubaiairports.ae/' }
  });
  
  if (!res.ok) {
    console.error(`DXB: HTTP ${res.status}`);
    return new Map();
  }
  
  const data = await res.json();
  const flights = Array.isArray(data.Flights) ? data.Flights : [];
  
  // Group flights by date
  const dateMap = new Map();
  const today = new Date();
  
  // Initialize all requested dates with 0 counts
  for (let i = 0; i <= daysBack; i++) {
    const dateStr = getDateDaysAgo(i);
    dateMap.set(dateStr, { departures: 0, arrivals: 0, total: 0 });
  }
  
  // Process flights and group by date
  for (const f of flights) {
    const dt = f.scheduledoffblockTime || f.scheduledOnblockTime || '';
    const dateStr = String(dt).split('T')[0];
    
    if (!dateMap.has(dateStr)) continue;
    
    const entry = dateMap.get(dateStr);
    if (f.arrivalDepartureFlag === 'D') {
      entry.departures++;
    } else if (f.arrivalDepartureFlag === 'A') {
      entry.arrivals++;
    }
    entry.total = entry.departures + entry.arrivals;
  }
  
  return dateMap;
}

// DOH: Fetches day by day (API supports historical via date params)
async function fetchDOHRange(daysBack = 35) {
  console.log('Fetching DOH historical data...');
  const results = new Map();
  const baseUrl = 'https://dohahamadairport.com/webservices/fids';
  
  for (let i = 0; i <= daysBack; i++) {
    const dateStr = getDateDaysAgo(i);
    const dohDate = formatDOH(dateStr);
    
    async function fetchType(type) {
      const url = `${baseUrl}?type=${type}&startTime=${dohDate}%2000:00:00&endTime=${dohDate}%2023:59:59`;
      const res = await fetchWithTimeout(url, {
        headers: { 'Referer': 'https://dohahamadairport.com/' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      const flights = Array.isArray(data) ? data : Array.isArray(data.flights) ? data.flights : [];
      return flights.filter(f => f.Codeshare === 'Master' || f.Codeshare === null || f.Codeshare === undefined);
    }
    
    const deps = await fetchType('departures');
    await delay(200);
    const arrs = await fetchType('arrivals');
    
    results.set(dateStr, {
      departures: deps.length,
      arrivals: arrs.length,
      total: deps.length + arrs.length
    });
    
    // Stop if we get 3 consecutive days with no data
    if (i >= 3) {
      const last3 = [getDateDaysAgo(i), getDateDaysAgo(i-1), getDateDaysAgo(i-2)];
      const allZero = last3.every(d => results.get(d)?.total === 0);
      if (allZero) {
        console.log(`  DOH: Stopping at ${dateStr} - 3 consecutive days with no data`);
        break;
      }
    }
    
    await delay(300);
  }
  
  return results;
}

// AUH: Fetches day by day (day=0 today, day=-1 yesterday, etc.)
async function fetchAUHRange(daysBack = 7) {
  console.log('Fetching AUH historical data...');
  const results = new Map();
  const baseUrl = 'https://www.zayedinternationalairport.ae/api/zayed/flight';
  
  for (let i = 0; i <= daysBack; i++) {
    const dateStr = getDateDaysAgo(i);
    const dayParam = -i;
    
    async function fetchType(type) {
      const url = `${baseUrl}/${type}?day=${dayParam}&PageSize=500`;
      const res = await fetchWithTimeout(url, {
        headers: { 'Referer': 'https://www.zayedinternationalairport.ae/' }
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.result?.total_count ?? data.result?.data?.length ?? 0;
    }
    
    const deps = await fetchType('departure');
    await delay(200);
    const arrs = await fetchType('arrival');
    
    results.set(dateStr, {
      departures: deps,
      arrivals: arrs,
      total: deps + arrs
    });
    
    await delay(300);
  }
  
  return results;
}

// JED: Fetches day by day using EarlyOrDelayedDateTime filter
async function fetchJEDRange(daysBack = 30) {
  console.log('Fetching JED historical data...');
  const results = new Map();
  const baseUrl = 'https://www.kaia.sa/ext-api/flightsearch/flights';
  
  for (let i = 0; i <= daysBack; i++) {
    const dateStr = getDateDaysAgo(i);
    
    async function fetchType(type) {
      const startTime = `${dateStr}T00:00:00+03:00`;
      const endTime = `${dateStr}T23:59:59+03:00`;
      const filter = `(EarlyOrDelayedDateTime ge ${startTime} and EarlyOrDelayedDateTime le ${endTime} and FlightNature eq '${type}')`;
      const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$count=true&$top=0`;
      
      const res = await fetchWithTimeout(url, {
        headers: {
          'Referer': 'https://www.kaia.sa/en/Flights',
          'Accept': 'application/json'
        }
      });
      
      if (!res.ok) return 0;
      const data = await res.json();
      return data['@odata.count'] ?? 0;
    }
    
    const deps = await fetchType('DEPARTURE');
    await delay(200);
    const arrs = await fetchType('ARRIVAL');
    
    results.set(dateStr, {
      departures: deps,
      arrivals: arrs,
      total: deps + arrs
    });
    
    await delay(300);
  }
  
  return results;
}

// ─────────────────────────────────────────────────────────────
// Comparison logic
// ─────────────────────────────────────────────────────────────
function calculateMatch(official, aerobox) {
  if (!aerobox || aerobox.total === 0) return 0;
  const diff = Math.abs(official.total - aerobox.total);
  const matchPct = 100 - (diff / aerobox.total * 100);
  return Math.max(0, Math.round(matchPct));
}

function compareData(officialMap, aeroboxMap, airport) {
  const comparisons = [];
  
  for (const [date, official] of officialMap.entries()) {
    const aerobox = aeroboxMap.get(date);
    
    // Only include if we have official data (total > 0) or it's today/yesterday
    if (official.total === 0 && !aerobox) continue;
    
    const matchPct = aerobox ? calculateMatch(official, aerobox) : null;
    
    comparisons.push({
      date,
      airport,
      official_count: official.total,
      official_breakdown: { departures: official.departures, arrivals: official.arrivals },
      aerobox_count: aerobox?.total ?? null,
      aerobox_breakdown: aerobox ? { departures: aerobox.departures, arrivals: aerobox.arrivals } : null,
      match_pct: matchPct,
      status: aerobox ? (matchPct >= 90 ? 'match' : matchPct >= 70 ? 'partial' : 'mismatch') : 'no_aerobox_data'
    });
  }
  
  return comparisons.sort((a, b) => a.date.localeCompare(b.date));
}

// ─────────────────────────────────────────────────────────────
// Table output
// ─────────────────────────────────────────────────────────────
function printTable(comparisons) {
  console.log('\n' + '='.repeat(95));
  console.log('HISTORICAL ACCURACY COMPARISON: Official APIs vs AeroDataBox');
  console.log('='.repeat(95));
  console.log(
    'Date'.padEnd(12) + 
    'Airport'.padEnd(8) + 
    'Official'.padEnd(10) + 
    'AeroBox'.padEnd(10) + 
    'Match%'.padEnd(8) + 
    'Status'
  );
  console.log('-'.repeat(95));
  
  for (const row of comparisons) {
    const statusIcon = row.status === 'match' ? '✓' : row.status === 'partial' ? '~' : row.status === 'mismatch' ? '✗' : '?';
    console.log(
      row.date.padEnd(12) +
      row.airport.padEnd(8) +
      String(row.official_count).padEnd(10) +
      (row.aerobox_count ?? 'N/A').toString().padEnd(10) +
      (row.match_pct !== null ? `${row.match_pct}%` : 'N/A').padEnd(8) +
      `${statusIcon} ${row.status}`
    );
  }
  
  console.log('='.repeat(95));
}

function printSummary(comparisons) {
  const withAeroData = comparisons.filter(c => c.aerobox_count !== null);
  const matches = withAeroData.filter(c => c.status === 'match');
  const partials = withAeroData.filter(c => c.status === 'partial');
  const mismatches = withAeroData.filter(c => c.status === 'mismatch');
  
  console.log('\nSUMMARY:');
  console.log(`  Total days compared: ${comparisons.length}`);
  console.log(`  Days with AeroDataBox data: ${withAeroData.length}`);
  console.log(`  Matches (≥90%): ${matches.length}`);
  console.log(`  Partial (70-89%): ${partials.length}`);
  console.log(`  Mismatches (<70%): ${mismatches.length}`);
  
  if (withAeroData.length > 0) {
    const avgMatch = Math.round(withAeroData.reduce((sum, c) => sum + (c.match_pct || 0), 0) / withAeroData.length);
    console.log(`  Average match: ${avgMatch}%`);
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('Historical Accuracy Comparison');
  console.log('==============================\n');
  console.log(`Today: ${getToday()}`);
  console.log('Fetching historical data from official APIs...\n');
  
  const allComparisons = [];
  
  // DXB - rolling window (typically 3-5 days)
  console.log('\n--- DXB ---');
  const dxbOfficial = await fetchDXBRange(7);
  const { dateMap: dxbAero } = loadAeroDataBox('DXB');
  const dxbComparisons = compareData(dxbOfficial, dxbAero, 'DXB');
  allComparisons.push(...dxbComparisons);
  console.log(`  Fetched ${dxbOfficial.size} days, ${dxbComparisons.filter(c => c.aerobox_count !== null).length} have AeroDataBox data`);
  
  // DOH - can go back ~35 days
  console.log('\n--- DOH ---');
  const dohOfficial = await fetchDOHRange(35);
  const { dateMap: dohAero } = loadAeroDataBox('DOH');
  const dohComparisons = compareData(dohOfficial, dohAero, 'DOH');
  allComparisons.push(...dohComparisons);
  console.log(`  Fetched ${dohOfficial.size} days, ${dohComparisons.filter(c => c.aerobox_count !== null).length} have AeroDataBox data`);
  
  // AUH - can go back several days
  console.log('\n--- AUH ---');
  const auhOfficial = await fetchAUHRange(7);
  const { dateMap: auhAero } = loadAeroDataBox('AUH');
  const auhComparisons = compareData(auhOfficial, auhAero, 'AUH');
  allComparisons.push(...auhComparisons);
  console.log(`  Fetched ${auhOfficial.size} days, ${auhComparisons.filter(c => c.aerobox_count !== null).length} have AeroDataBox data`);
  
  // JED - can go back ~30 days
  console.log('\n--- JED ---');
  const jedOfficial = await fetchJEDRange(30);
  const { dateMap: jedAero } = loadAeroDataBox('JED');
  const jedComparisons = compareData(jedOfficial, jedAero, 'JED');
  allComparisons.push(...jedComparisons);
  console.log(`  Fetched ${jedOfficial.size} days, ${jedComparisons.filter(c => c.aerobox_count !== null).length} have AeroDataBox data`);
  
  // Sort all comparisons by date then airport
  allComparisons.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    return dateCmp !== 0 ? dateCmp : a.airport.localeCompare(b.airport);
  });
  
  // Print results
  printTable(allComparisons);
  printSummary(allComparisons);
  
  // Save results
  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalDays: allComparisons.length,
      daysWithAeroData: allComparisons.filter(c => c.aerobox_count !== null).length,
      matches: allComparisons.filter(c => c.status === 'match').length,
      partials: allComparisons.filter(c => c.status === 'partial').length,
      mismatches: allComparisons.filter(c => c.status === 'mismatch').length,
      noAeroData: allComparisons.filter(c => c.status === 'no_aerobox_data').length,
    },
    comparisons: allComparisons
  };
  
  const outputFile = join(VERIFY_DIR, 'historical-accuracy.json');
  writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n');
  console.log(`\nResults saved to: ${outputFile}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
