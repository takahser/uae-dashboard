#!/usr/bin/env node
/**
 * Backfill flight data from AeroDataBox (RapidAPI) for all airports.
 * Covers Feb 28 → today in 2x 12-hour windows per day per airport.
 * Merges into existing public/data-flights-{iata}.json format.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const RAPIDAPI_KEY = "2bdc3b4403msh8432443db39f320p15abd2jsn252b0a720b81";

const AIRPORTS = [
  { icao: "OMDB", iata: "dxb", name: "Dubai International (DXB)" },
  { icao: "OMAA", iata: "auh", name: "Abu Dhabi International (AUH)" },
  { icao: "OMDW", iata: "dwc", name: "Al Maktoum International (DWC)" },
  { icao: "OOMS", iata: "mct", name: "Muscat International (MCT)" },
  { icao: "OTHH", iata: "doh", name: "Hamad International (DOH)" },
  { icao: "LLBG", iata: "tlv", name: "Ben Gurion International (TLV)" },
];

const START_DATE = "2026-02-28";
const TODAY = new Date().toISOString().slice(0, 10);

function getDates(start, end) {
  const dates = [];
  let cur = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function fetchWindow(icao, date, fromHour, toHour) {
  const from = `${date}T${String(fromHour).padStart(2, "0")}:00`;
  const to = `${date}T${String(toHour).padStart(2, "0")}:59`;
  const url = `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${from}/${to}?direction=Both&withLeg=false&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });

  if (res.status === 204) return { departures: [], arrivals: [] };
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 100)}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

async function backfillAirport(airport) {
  const filePath = join(PUBLIC_DIR, `data-flights-${airport.iata}.json`);
  let existing = { airport: airport.iata.toUpperCase(), daily: [] };
  try {
    existing = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {}

  // Index existing dates
  const existingDates = new Set((existing.daily || []).map((d) => d.date));

  const dates = getDates(START_DATE, TODAY);
  console.log(`\n📍 ${airport.name} — ${dates.length} days to check`);

  for (const date of dates) {
    if (existingDates.has(date)) {
      console.log(`  [${date}] already present, skipping`);
      continue;
    }

    try {
      // Fetch AM (00:00–11:59) then PM (12:00–23:59) — serialized to avoid 429
      const am = await fetchWindow(airport.icao, date, 0, 11);
      await sleep(2000);
      const pm = await fetchWindow(airport.icao, date, 12, 23);
      await sleep(2000);

      const allDep = [...(am.departures || []), ...(pm.departures || [])];
      const allArr = [...(am.arrivals || []), ...(pm.arrivals || [])];
      const total = allDep.length + allArr.length;

      if (total === 0) {
        console.log(`  [${date}] no data returned — skipping`);
        continue;
      }

      // Build regional breakdown
      const regions = {};
      for (const f of [...allDep, ...allArr]) {
        const icao = f.movement?.airport?.icao || "";
        const region = classifyRegion(icao);
        regions[region] = (regions[region] || 0) + 1;
      }

      const entry = {
        date,
        departures: allDep.length,
        arrivals: allArr.length,
        total,
        regions,
        source: "aerodatabox",
      };

      existing.daily.push(entry);
      existingDates.add(date);
      console.log(`  [${date}] dep=${allDep.length} arr=${allArr.length} total=${total}`);
    } catch (err) {
      console.error(`  [${date}] ERROR: ${err.message}`);
      await sleep(2000);
    }
  }

  // Sort by date
  existing.daily.sort((a, b) => a.date.localeCompare(b.date));
  existing.lastUpdated = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(existing, null, 2));
  console.log(`  ✅ Saved ${existing.daily.length} entries to data-flights-${airport.iata}.json`);
}

async function main() {
  console.log(`=== AeroDataBox backfill: ${START_DATE} → ${TODAY} ===`);
  for (const airport of AIRPORTS) {
    await backfillAirport(airport);
    await sleep(1000);
  }
  console.log("\n=== DONE ===");
}

main().catch((e) => { console.error(e); process.exit(1); });
