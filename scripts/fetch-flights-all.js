#!/usr/bin/env node
/**
 * Fetch flight data for ALL airports from OpenSky Network API.
 * Updates public/data-flights-{iata}.json for each airport with daily
 * departure/arrival counts, regional breakdown, and per-flight details.
 *
 * Airports: DXB, AUH, DWC, MCT, DOH, TLV, BAH, KWI, SHJ
 *
 * Env vars required:
 *   OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET
 *
 * Usage: node scripts/fetch-flights-all.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const CONFLICT_START = "2026-02-28";
const BASELINE_START = "2026-02-18";

const AIRPORTS = [
  { icao: "OMDB", iata: "DXB", name: "Dubai International (DXB)" },
  { icao: "OMAA", iata: "AUH", name: "Abu Dhabi International (AUH)" },
  { icao: "OMDW", iata: "DWC", name: "Al Maktoum International (DWC)" },
  { icao: "OOMS", iata: "MCT", name: "Muscat International (MCT)" },
  { icao: "OTHH", iata: "DOH", name: "Hamad International (DOH)" },
  { icao: "LLBG", iata: "TLV", name: "Ben Gurion International (TLV)" },
  { icao: "OBBI", iata: "BAH", name: "Bahrain International (BAH)" },
  { icao: "OKBK", iata: "KWI", name: "Kuwait International (KWI)" },
  { icao: "OMSJ", iata: "SHJ", name: "Sharjah International (SHJ)" },
];

const CLIENT_ID = process.env.OPENSKY_CLIENT_ID;
const CLIENT_SECRET = process.env.OPENSKY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET.\n" +
    "Set these environment variables to use OpenSky Network API.\n" +
    "Register at https://opensky-network.org/ to obtain credentials."
  );
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

async function fetchFlights(token, airportIcao, direction, dateStr) {
  const begin = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
  const end = begin + 86400;
  const url = `https://opensky-network.org/api/flights/${direction}?airport=${airportIcao}&begin=${begin}&end=${end}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.warn(`  ${direction} ${dateStr}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function getDayData(token, airportIcao, dateStr) {
  const deps = await fetchFlights(token, airportIcao, "departure", dateStr);
  const arrs = await fetchFlights(token, airportIcao, "arrival", dateStr);

  const regions = {};
  const flights = [];

  for (const f of deps) {
    const otherAirport = f.estArrivalAirport || null;
    const region = classifyRegion(otherAirport);
    regions[region] = (regions[region] || 0) + 1;
    flights.push({
      callsign: (f.callsign || "").trim(),
      direction: "departure",
      otherAirport,
      region,
    });
  }

  for (const f of arrs) {
    const otherAirport = f.estDepartureAirport || null;
    const region = classifyRegion(otherAirport);
    regions[region] = (regions[region] || 0) + 1;
    flights.push({
      callsign: (f.callsign || "").trim(),
      direction: "arrival",
      otherAirport,
      region,
    });
  }

  return {
    departures: deps.length,
    arrivals: arrs.length,
    total: deps.length + arrs.length,
    regions,
    flights,
  };
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

function computeBaseline(daily) {
  const baselineDays = daily.filter(d => d.date >= BASELINE_START && d.date < CONFLICT_START);
  if (baselineDays.length === 0) return undefined;

  const n = baselineDays.length;
  const regions = {};
  let totalDep = 0, totalArr = 0, totalAll = 0;
  for (const d of baselineDays) {
    totalDep += d.departures;
    totalArr += d.arrivals;
    totalAll += d.total;
    for (const [r, c] of Object.entries(d.regions || {})) {
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processAirport(token, airport) {
  // Write to separate OpenSky file — AeroDataBox is master, OpenSky is parallel tracking only
  const dataFile = join(PUBLIC_DIR, `data-flights-${airport.iata.toLowerCase()}-opensky.json`);
  let existing;
  try {
    existing = JSON.parse(readFileSync(dataFile, "utf8"));
  } catch {
    existing = { airport: airport.icao, airportName: airport.name, daily: [] };
  }

  // Ensure daily array exists
  if (!existing.daily) existing.daily = [];

  const missing = datesToFetch(existing);
  if (missing.length === 0) {
    console.log(`[${airport.iata}] No new dates to fetch.`);
    return;
  }

  console.log(`[${airport.iata}] Fetching ${missing.length} missing date(s)...`);

  for (const dateStr of missing) {
    console.log(`  [${airport.iata}] ${dateStr}...`);
    try {
      const day = await getDayData(token, airport.icao, dateStr);
      existing.daily.push({ date: dateStr, ...day });
      console.log(`    total=${day.total}`);
    } catch (e) {
      console.error(`    Error: ${e.message}`);
    }
    // Small delay between API calls to avoid rate limiting
    await delay(200);
  }

  // Sort daily by date ascending
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recompute baseline
  const baseline = computeBaseline(existing.daily);
  if (baseline) existing.baselineDailyAvg = baseline;

  // Preserve existing fields (status, todayArrivals, etc.) set by FR24
  existing.airport = airport.icao;
  existing.airportName = airport.name;
  existing.lastUpdated = new Date().toISOString();

  writeFileSync(dataFile, JSON.stringify(existing, null, 2) + "\n");
  console.log(`[${airport.iata}] Updated ${dataFile}`);
}

async function main() {
  console.log("Authenticating with OpenSky Network...");
  const token = await getToken();
  console.log("Token obtained.\n");

  for (const airport of AIRPORTS) {
    await processAirport(token, airport);
    console.log();
  }

  console.log("Done.");
}

main().catch(e => { console.error(e); process.exit(1); });
