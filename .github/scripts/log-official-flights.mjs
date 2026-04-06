#!/usr/bin/env node
/**
 * Fetch today's flight data from official airport APIs
 * and log to verification files for accuracy audits.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERIFY_DIR = join(__dirname, '../../public/verification');

mkdirSync(VERIFY_DIR, { recursive: true });

function getToday() {
  const d = new Date();
  return d.toISOString().split('T')[0];
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

const FETCH_TIMEOUT = 20_000; // 20 seconds per request

function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─────────────────────────────────────────────────────────────
// DXB: Dubai International
// Fetches from rolling window (includes today)
// ─────────────────────────────────────────────────────────────
async function fetchDXB(dateStr) {
  console.log(`  Fetching DXB for ${dateStr}...`);
  const url = 'https://dubaiairports.ae/docs/passengerslibraries/flights-library/flights-data.json';

  const res = await fetchWithTimeout(url, {
    headers: { 'Referer': 'https://dubaiairports.ae/' }
  });

  if (!res.ok) {
    console.error(`DXB: HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();

  // Response structure: { Flights: [...], TotalCount, ... }
  const flights = Array.isArray(data.Flights) ? data.Flights : [];

  // Departures use scheduledoffblockTime, arrivals use scheduledOnblockTime
  const dayFlights = flights.filter(f => {
    const dt = f.scheduledoffblockTime || f.scheduledOnblockTime || '';
    return String(dt).startsWith(dateStr);
  });

  // arrivalDepartureFlag: 'A' = arrival, 'D' = departure
  const departures = dayFlights.filter(f => f.arrivalDepartureFlag === 'D');
  const arrivals = dayFlights.filter(f => f.arrivalDepartureFlag === 'A');

  return {
    date: dateStr,
    departures: departures.length,
    arrivals: arrivals.length,
    total: departures.length + arrivals.length,
    source: 'dubaiairports.ae',
    fetchedAt: new Date().toISOString(),
    raw: { totalInResponse: flights.length, matchedDate: dayFlights.length, totalCount: data.TotalCount }
  };
}

// ─────────────────────────────────────────────────────────────
// DOH: Hamad International (Doha)
// API works with today's date
// ─────────────────────────────────────────────────────────────
async function fetchDOH(dateStr) {
  console.log(`  Fetching DOH for ${dateStr}...`);
  const dohDate = formatDOH(dateStr);
  const baseUrl = 'https://dohahamadairport.com/webservices/fids';

  async function fetchType(type) {
    const url = `${baseUrl}?type=${type}&startTime=${dohDate}%2000:00:00&endTime=${dohDate}%2023:59:59`;
    const res = await fetchWithTimeout(url, {
      headers: { 'Referer': 'https://dohahamadairport.com/' }
    });
    if (!res.ok) {
      console.error(`DOH ${type}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    const flights = Array.isArray(data) ? data
      : Array.isArray(data.flights) ? data.flights
      : Array.isArray(data.data) ? data.data
      : [];

    // Filter: operating flights only (not codeshares)
    return flights.filter(f =>
      f.Codeshare === 'Master' || f.Codeshare === null || f.Codeshare === undefined
    );
  }

  const deps = await fetchType('departures');
  await delay(300);
  const arrs = await fetchType('arrivals');

  return {
    date: dateStr,
    departures: deps.length,
    arrivals: arrs.length,
    total: deps.length + arrs.length,
    source: 'dohahamadairport.com',
    fetchedAt: new Date().toISOString(),
    note: 'Operating flights only (Codeshare=Master or null)'
  };
}

// ─────────────────────────────────────────────────────────────
// JED: King Abdulaziz International (Jeddah)
// Uses EarlyOrDelayedDateTime filter with OData
// ─────────────────────────────────────────────────────────────
async function fetchJED(dateStr) {
  console.log(`  Fetching JED for ${dateStr}...`);
  const baseUrl = 'https://www.kaia.sa/ext-api/flightsearch/flights';

  async function fetchType(type) {
    // Use EarlyOrDelayedDateTime for actual flight dates
    const startTime = `${dateStr}T00:00:00+03:00`;
    const endTime = `${dateStr}T23:59:59+03:00`;
    const filter = `(EarlyOrDelayedDateTime ge ${startTime} and EarlyOrDelayedDateTime le ${endTime} and FlightNature eq '${type}')`;
    // Use $top=0 with $count=true to get server-side count without downloading all records
    const url = `${baseUrl}?$filter=${encodeURIComponent(filter)}&$count=true&$top=0`;

    const res = await fetchWithTimeout(url, {
      headers: {
        'Referer': 'https://www.kaia.sa/en/Flights',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.error(`JED ${type}: HTTP ${res.status}`);
      return { count: 0, flights: [] };
    }
    const data = await res.json();
    return {
      count: data['@odata.count'] ?? data.value?.length ?? 0,
      flights: data.value || []
    };
  }

  const deps = await fetchType('DEPARTURE');
  await delay(300);
  const arrs = await fetchType('ARRIVAL');

  return {
    date: dateStr,
    departures: deps.count,
    arrivals: arrs.count,
    total: deps.count + arrs.count,
    source: 'kaia.sa',
    fetchedAt: new Date().toISOString()
  };
}

// ─────────────────────────────────────────────────────────────
// AUH: Abu Dhabi International (Zayed International Airport)
// day=0 = today, day=-1 = yesterday, etc.
// ─────────────────────────────────────────────────────────────
async function fetchAUH(dateStr) {
  console.log(`  Fetching AUH for ${dateStr}...`);
  
  const today = getToday();
  const yesterday = getYesterday();
  
  // Determine day parameter: 0 = today, -1 = yesterday
  let dayParam;
  if (dateStr === today) {
    dayParam = 0;
  } else if (dateStr === yesterday) {
    dayParam = -1;
  } else {
    // For other dates, calculate days difference
    const target = new Date(dateStr);
    const now = new Date();
    const diffMs = now - target;
    dayParam = -Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (dayParam > 0) dayParam = 0; // Future dates not supported, default to today
  }

  const baseUrl = 'https://www.zayedinternationalairport.ae/api/zayed/flight';

  async function fetchType(type) {
    const url = `${baseUrl}/${type}?day=${dayParam}&PageSize=500`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'Referer': 'https://www.zayedinternationalairport.ae/',
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.error(`AUH ${type}: HTTP ${res.status}`);
      return 0;
    }
    const data = await res.json();
    // Response structure: { result: { data: [...], total_count: N } }
    return data.result?.total_count ?? data.result?.data?.length ?? 0;
  }

  const deps = await fetchType('departure');
  await delay(300);
  const arrs = await fetchType('arrival');

  return {
    date: dateStr,
    departures: deps,
    arrivals: arrs,
    total: deps + arrs,
    source: 'zayedinternationalairport.ae',
    fetchedAt: new Date().toISOString(),
    method: 'direct-api',
    apiEndpoint: `https://www.zayedinternationalairport.ae/api/zayed/flight/{departure|arrival}?day=${dayParam}&PageSize=500`
  };
}

// ─────────────────────────────────────────────────────────────
// Persistence helpers
// ─────────────────────────────────────────────────────────────
function loadLog(iata) {
  const file = join(VERIFY_DIR, `flight-log-${iata}.json`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { airport: iata, entries: [] };
  }
}

function saveLog(iata, data) {
  const file = join(VERIFY_DIR, `flight-log-${iata}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`  Saved: ${file}`);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  const today = getToday();
  console.log(`Fetching official data for: ${today}\n`);

  const results = {};

  // DXB - fetch today
  console.log('Fetching DXB...');
  const dxb = await fetchDXB(today);
  if (dxb) {
    results.DXB = dxb;
    const log = loadLog('DXB');
    log.entries = log.entries.filter(e => e.date !== today);
    log.entries.push(dxb);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('DXB', log);
    console.log(`  DXB: ${dxb.total} flights (${dxb.departures} dep, ${dxb.arrivals} arr)\n`);
  }
  await delay(500);

  // DOH - fetch today
  console.log('Fetching DOH...');
  const doh = await fetchDOH(today);
  if (doh) {
    results.DOH = doh;
    const log = loadLog('DOH');
    log.entries = log.entries.filter(e => e.date !== today);
    log.entries.push(doh);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('DOH', log);
    console.log(`  DOH: ${doh.total} flights (${doh.departures} dep, ${doh.arrivals} arr)\n`);
  }
  await delay(500);

  // JED - fetch today
  console.log('Fetching JED...');
  const jed = await fetchJED(today);
  if (jed) {
    results.JED = jed;
    const log = loadLog('JED');
    log.entries = log.entries.filter(e => e.date !== today);
    log.entries.push(jed);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('JED', log);
    console.log(`  JED: ${jed.total} flights (${jed.departures} dep, ${jed.arrivals} arr)\n`);
  }
  await delay(500);

  // AUH - fetch today
  console.log('Fetching AUH...');
  const auh = await fetchAUH(today);
  if (auh) {
    results.AUH = auh;
    const log = loadLog('AUH');
    log.entries = log.entries.filter(e => e.date !== today);
    log.entries.push(auh);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('AUH', log);
    console.log(`  AUH: ${auh.total} flights (${auh.departures} dep, ${auh.arrivals} arr)\n`);
  }

  console.log('Done.');
  console.log('\nSummary:');
  console.log('--------');
  for (const [iata, data] of Object.entries(results)) {
    console.log(`${iata}: ${data.date} - ${data.total} flights (${data.departures} dep, ${data.arrivals} arr)`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
