#!/usr/bin/env node
/**
 * Fetch yesterday's flight data from official airport APIs
 * and log to verification files for accuracy audits.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VERIFY_DIR = join(__dirname, '../../public/verification');

mkdirSync(VERIFY_DIR, { recursive: true });

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
// ─────────────────────────────────────────────────────────────
async function fetchDXB(dateStr) {
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
// ─────────────────────────────────────────────────────────────
async function fetchDOH(dateStr) {
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
// ─────────────────────────────────────────────────────────────
async function fetchJED(dateStr) {
  const baseUrl = 'https://www.kaia.sa/ext-api/flightsearch/flights';

  async function fetchType(type) {
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
  console.log(`Saved: ${file}`);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  const yesterday = getYesterday();
  console.log(`Fetching official data for: ${yesterday}\n`);

  const results = {};

  // DXB
  console.log('Fetching DXB...');
  const dxb = await fetchDXB(yesterday);
  if (dxb) {
    results.DXB = dxb;
    const log = loadLog('DXB');
    log.entries = log.entries.filter(e => e.date !== yesterday);
    log.entries.push(dxb);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('DXB', log);
    console.log(`  DXB: ${dxb.total} flights (${dxb.departures} dep, ${dxb.arrivals} arr)\n`);
  }
  await delay(500);

  // DOH
  console.log('Fetching DOH...');
  const doh = await fetchDOH(yesterday);
  if (doh) {
    results.DOH = doh;
    const log = loadLog('DOH');
    log.entries = log.entries.filter(e => e.date !== yesterday);
    log.entries.push(doh);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('DOH', log);
    console.log(`  DOH: ${doh.total} flights (${doh.departures} dep, ${doh.arrivals} arr)\n`);
  }
  await delay(500);

  // JED
  console.log('Fetching JED...');
  const jed = await fetchJED(yesterday);
  if (jed) {
    results.JED = jed;
    const log = loadLog('JED');
    log.entries = log.entries.filter(e => e.date !== yesterday);
    log.entries.push(jed);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    saveLog('JED', log);
    console.log(`  JED: ${jed.total} flights (${jed.departures} dep, ${jed.arrivals} arr)\n`);
  }

  console.log('Done.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
