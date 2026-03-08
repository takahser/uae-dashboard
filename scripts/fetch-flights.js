#!/usr/bin/env node
/**
 * Fetch DXB flight data from OpenSky Network API.
 * Updates public/data-flights-dxb.json with daily departure/arrival counts
 * and regional breakdown.
 *
 * Env vars required:
 *   OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET
 *
 * Usage: node scripts/fetch-flights.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "..", "public", "data-flights-dxb.json");

const AIRPORT = "OMDB";
const CONFLICT_START = "2026-02-28";
const BASELINE_START = "2026-02-18";

const CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET");
  process.exit(1);
}

async function getToken() {
  const res = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
    }
  );
  if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

function classifyRegion(icao) {
  if (!icao) return "Unknown";
  const p = icao.slice(0, 2);
  const c = icao[0];
  if (["VA","VE","VI","VO","VT","VG","VC","VN","VQ","OP"].includes(p)) return "South Asia";
  if (c === "O") return "Middle East";
  if ("ELUB".includes(c)) return "Europe";
  if ("ZRWY".includes(c) || c === "V") return "Asia-Pacific";
  if ("DFGH".includes(c)) return "Africa";
  if ("KCMSTP".includes(c)) return "Americas";
  return "Other";
}

async function fetchFlights(token, direction, dateStr) {
  const begin = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
  const end = begin + 86400;
  const url = `https://opensky-network.org/api/flights/${direction}?airport=${AIRPORT}&begin=${begin}&end=${end}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`  ${direction} ${dateStr}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function getDayData(token, dateStr) {
  const deps = await fetchFlights(token, "departure", dateStr);
  const arrs = await fetchFlights(token, "arrival", dateStr);
  const regions = {};
  for (const f of deps) {
    const r = classifyRegion(f.estArrivalAirport);
    regions[r] = (regions[r] || 0) + 1;
  }
  for (const f of arrs) {
    const r = classifyRegion(f.estDepartureAirport);
    regions[r] = (regions[r] || 0) + 1;
  }
  return { departures: deps.length, arrivals: arrs.length, total: deps.length + arrs.length, regions };
}

function datesToFetch(existing) {
  const existingDates = new Set((existing.daily || []).map(d => d.date));
  const dates = [];
  const today = new Date().toISOString().slice(0, 10);
  let d = new Date(BASELINE_START + "T00:00:00Z");
  while (d.toISOString().slice(0, 10) < today) {
    const ds = d.toISOString().slice(0, 10);
    if (!existingDates.has(ds)) dates.push(ds);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

async function main() {
  let existing;
  try {
    existing = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    existing = { airport: AIRPORT, airportName: "Dubai International (DXB)", daily: [] };
  }

  const missing = datesToFetch(existing);
  if (missing.length === 0) {
    console.log("No new dates to fetch.");
    return;
  }

  console.log(`Fetching ${missing.length} missing date(s)...`);
  const token = await getToken();

  for (const dateStr of missing) {
    console.log(`  ${dateStr}...`);
    try {
      const day = await getDayData(token, dateStr);
      existing.daily.push({ date: dateStr, ...day });
      console.log(`    total=${day.total}`);
    } catch (e) {
      console.error(`    Error: ${e.message}`);
    }
  }

  // Sort daily by date
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recompute baseline (pre-conflict days)
  const baselineDays = existing.daily.filter(d => d.date < CONFLICT_START);
  if (baselineDays.length > 0) {
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
    existing.baselineDailyAvg = {
      total: Math.round(totalAll / n),
      departures: Math.round(totalDep / n),
      arrivals: Math.round(totalArr / n),
      regions: Object.fromEntries(Object.entries(regions).map(([r, c]) => [r, Math.round(c / n)])),
    };
  }

  existing.lastUpdated = new Date().toISOString();
  writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2) + "\n");
  console.log(`Updated ${DATA_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
