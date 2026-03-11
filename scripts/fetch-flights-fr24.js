#!/usr/bin/env node
/**
 * Fetch flight data from Flightradar24 free API for DXB, DWC, and AUH airports.
 * Updates public/data-flights-{code}.json with daily departure/arrival counts
 * and regional breakdown.
 *
 * No auth required — uses the public FR24 API.
 *
 * Usage: node scripts/fetch-flights-fr24.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFLICT_START = "2026-02-28";
const BASELINE_START = "2026-02-18";

const AIRPORTS = [
  { iata: "DXB", icao: "OMDB", name: "Dubai International (DXB)" },
  { iata: "DWC", icao: "OMDW", name: "Al Maktoum International (DWC)" },
  { iata: "AUH", icao: "OMAA", name: "Abu Dhabi International (AUH)" },
  { iata: "MCT", icao: "OOMS", name: "Muscat International (MCT)" },
  { iata: "DOH", icao: "OTHH", name: "Hamad International (DOH)" },
  { iata: "TLV", icao: "LLBG", name: "Ben Gurion International (TLV)" },
];

// Region classification by IATA country/area codes (common prefixes)
const REGION_BY_IATA_AREA = {
  // South Asia
  BOM: "South Asia", DEL: "South Asia", CCU: "South Asia", MAA: "South Asia",
  BLR: "South Asia", HYD: "South Asia", COK: "South Asia", AMD: "South Asia",
  KHI: "South Asia", LHE: "South Asia", ISB: "South Asia", DAC: "South Asia",
  CMB: "South Asia", KTM: "South Asia", MLE: "South Asia", TRV: "South Asia",
  GAU: "South Asia", JAI: "South Asia", LKO: "South Asia", IXE: "South Asia",
  GOI: "South Asia", PNQ: "South Asia", SXR: "South Asia", ATQ: "South Asia",
  CCJ: "South Asia", IXM: "South Asia", VTZ: "South Asia", NAG: "South Asia",
  IXC: "South Asia", PAT: "South Asia", BBI: "South Asia", IDR: "South Asia",
  IXR: "South Asia", MUX: "South Asia", SKT: "South Asia", PEW: "South Asia",
  UET: "South Asia", FSD: "South Asia", SIL: "South Asia", RJA: "South Asia",
  TRZ: "South Asia", CJB: "South Asia", RPR: "South Asia", VNS: "South Asia",
};

function classifyRegionByIata(iata) {
  if (!iata) return "Unknown";
  if (REGION_BY_IATA_AREA[iata]) return REGION_BY_IATA_AREA[iata];

  // Broad heuristics based on known airport codes aren't reliable for IATA,
  // so we'll use a simplified approach based on common patterns
  // For now, return "Unknown" for codes we can't classify
  return "Unknown";
}

// More robust region classification using ICAO codes when available
function classifyRegionByIcao(icao) {
  if (!icao) return "Unknown";
  const p = icao.slice(0, 2);
  const c = icao[0];
  if (["VA", "VE", "VI", "VO", "VT", "VG", "VC", "VN", "VQ", "OP"].includes(p)) return "South Asia";
  if (c === "O") return "Middle East";
  if ("ELUB".includes(c)) return "Europe";
  if ("ZRWY".includes(c) || c === "V") return "Asia-Pacific";
  if ("DFGH".includes(c)) return "Africa";
  if ("KCMSTP".includes(c)) return "Americas";
  return "Other";
}

function classifyRegion(iata, icao) {
  // Prefer ICAO-based classification (more reliable)
  if (icao && icao.length === 4) {
    const r = classifyRegionByIcao(icao);
    if (r !== "Unknown" && r !== "Other") return r;
  }
  // Fall back to IATA lookup
  if (iata) {
    const r = classifyRegionByIata(iata);
    if (r !== "Unknown") return r;
  }
  return icao ? classifyRegionByIcao(icao) : "Unknown";
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchFR24Schedule(airportCode, mode, timestamp, page = 1) {
  const url =
    `https://api.flightradar24.com/common/v1/airport.json` +
    `?code=${airportCode}` +
    `&plugin[]=schedule` +
    `&plugin-setting[schedule][mode]=${mode}` +
    `&plugin-setting[schedule][timestamp]=${timestamp}` +
    `&page=${page}` +
    `&limit=100`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FlightTracker/1.0)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`  FR24 ${mode} ${airportCode} page ${page}: HTTP ${res.status}`);
    return null;
  }
  return res.json();
}

async function fetchAllFlights(airportCode, mode, dateStr) {
  const timestamp = Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
  const allFlights = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await fetchFR24Schedule(airportCode, mode, timestamp, page);
    if (!data) break;

    try {
      const schedule = data.result?.response?.airport?.pluginData?.schedule;
      const section = schedule?.[mode];
      if (!section) break;

      const flights = section.data || [];
      totalPages = section.page?.total || 1;

      // Filter flights to only include those on the target date
      const dayStart = timestamp;
      const dayEnd = timestamp + 86400;

      for (const item of flights) {
        const scheduled =
          item?.flight?.time?.scheduled?.[mode === "departures" ? "departure" : "arrival"];
        if (scheduled && scheduled >= dayStart && scheduled < dayEnd) {
          allFlights.push(item);
        }
      }

      page++;
      if (page <= totalPages) await delay(300); // rate limit courtesy
    } catch (e) {
      console.warn(`  Parse error page ${page}: ${e.message}`);
      break;
    }
  }

  return allFlights;
}

function extractRegions(flights, direction) {
  const regions = {};
  for (const item of flights) {
    let iata, icao;
    if (direction === "departures") {
      iata = item?.flight?.airport?.destination?.code?.iata;
      icao = item?.flight?.airport?.destination?.code?.icao;
    } else {
      iata = item?.flight?.airport?.origin?.code?.iata;
      icao = item?.flight?.airport?.origin?.code?.icao;
    }
    const r = classifyRegion(iata, icao);
    regions[r] = (regions[r] || 0) + 1;
  }
  return regions;
}

async function getDayData(airportCode, dateStr) {
  const deps = await fetchAllFlights(airportCode, "departures", dateStr);
  await delay(500);
  const arrs = await fetchAllFlights(airportCode, "arrivals", dateStr);

  const regions = {};
  const depRegions = extractRegions(deps, "departures");
  const arrRegions = extractRegions(arrs, "arrivals");

  for (const [r, c] of Object.entries(depRegions)) regions[r] = (regions[r] || 0) + c;
  for (const [r, c] of Object.entries(arrRegions)) regions[r] = (regions[r] || 0) + c;

  return {
    departures: deps.length,
    arrivals: arrs.length,
    total: deps.length + arrs.length,
    regions,
  };
}

function datesToFetch(existing) {
  const existingDates = new Set((existing.daily || []).map((d) => d.date));
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
  const baselineDays = daily.filter((d) => d.date >= BASELINE_START && d.date < CONFLICT_START);
  if (baselineDays.length === 0) {
    return { total: 0, departures: 0, arrivals: 0, regions: {} };
  }
  const n = baselineDays.length;
  const regions = {};
  let totalDep = 0,
    totalArr = 0,
    totalAll = 0;
  for (const d of baselineDays) {
    totalDep += d.departures;
    totalArr += d.arrivals;
    totalAll += d.total;
    for (const [r, c] of Object.entries(d.regions)) {
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

async function processAirport(airport) {
  const dataFile = join(__dirname, "..", "public", `data-flights-${airport.iata.toLowerCase()}.json`);

  let existing;
  try {
    existing = JSON.parse(readFileSync(dataFile, "utf8"));
  } catch {
    existing = {
      airport: airport.icao,
      airportName: airport.name,
      baselineDailyAvg: { total: 0, departures: 0, arrivals: 0, regions: {} },
      daily: [],
    };
  }

  const missing = datesToFetch(existing);
  if (missing.length === 0) {
    console.log(`[${airport.iata}] No new dates to fetch.`);
    return;
  }

  console.log(`[${airport.iata}] Fetching ${missing.length} missing date(s)...`);

  for (const dateStr of missing) {
    console.log(`  [${airport.iata}] ${dateStr}...`);
    try {
      const day = await getDayData(airport.iata, dateStr);
      existing.daily.push({ date: dateStr, ...day });
      console.log(`    total=${day.total} (dep=${day.departures}, arr=${day.arrivals})`);
    } catch (e) {
      console.error(`    Error: ${e.message}`);
    }
    await delay(1000); // rate limit between days
  }

  // Sort daily by date
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Recompute baseline
  existing.baselineDailyAvg = computeBaseline(existing.daily);
  existing.lastUpdated = new Date().toISOString();

  writeFileSync(dataFile, JSON.stringify(existing, null, 2) + "\n");
  console.log(`[${airport.iata}] Updated ${dataFile} (${existing.daily.length} days)`);
}

async function main() {
  for (const airport of AIRPORTS) {
    await processAirport(airport);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
