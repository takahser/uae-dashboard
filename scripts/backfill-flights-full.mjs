#!/usr/bin/env node
/**
 * Full backfill for JED / RUH / IKA from AeroDataBox (RapidAPI).
 * Produces two files per airport:
 *   - public/data-flights-{iata}.json   (summary with daily counts)
 *   - public/data-flights-raw-{iata}.json (per-flight detail)
 *
 * Fetches 2x 12-hour windows per day, serialized with 2 s sleep.
 * Skips dates already present in both files.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const RAPIDAPI_KEY = "2bdc3b4403msh8432443db39f320p15abd2jsn252b0a720b81";

const AIRPORTS = [
  { icao: "OEJN", iata: "jed", name: "Jeddah" },
  { icao: "OERK", iata: "ruh", name: "Riyadh" },
  { icao: "OIIE", iata: "ika", name: "Tehran" },
];

const START_DATE = "2026-02-18";
const TODAY = new Date().toISOString().slice(0, 10);

/* ── helpers ─────────────────────────────────────────────────────── */

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function classifyRegion(icao) {
  if (!icao) return "Other";
  const p2 = icao.slice(0, 2);
  const c = icao[0];

  // South Asia: V-prefixed (except VH) or OP
  if (c === "V" && p2 !== "VH") return "South Asia";
  if (p2 === "OP") return "South Asia";

  // Middle East: O-prefixed (except OP, already matched above)
  if (c === "O") return "Middle East";

  // Europe
  if (c === "E" || c === "L") return "Europe";

  // Asia-Pacific
  if (
    ["VH", "WA", "WI", "WS", "RC", "RJ", "RK", "ZS", "ZW", "ZY"].includes(
      p2
    ) ||
    c === "Y"
  )
    return "Asia-Pacific";

  // Africa
  if ("DFGH".includes(c)) return "Africa";

  // Americas
  if ("KCMTS".includes(c)) return "Americas";

  return "Other";
}

/* ── API ─────────────────────────────────────────────────────────── */

async function fetchWindow(icao, date, fromHour, toHour) {
  const from = `${date}T${String(fromHour).padStart(2, "0")}:00`;
  const to = `${date}T${String(toHour).padStart(2, "0")}:59`;
  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${from}/${to}` +
    `?direction=Both&withLeg=true&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "aerodatabox.p.rapidapi.com",
      "x-rapidapi-key": RAPIDAPI_KEY,
    },
  });

  if (res.status === 204) return { departures: [], arrivals: [] };
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

/* ── field mappers ───────────────────────────────────────────────── */

function mapDeparture(f) {
  return {
    flightNumber: f.number ?? null,
    airline: f.airline?.name ?? null,
    airlineIcao: f.airline?.icao ?? null,
    destination: f.arrival?.airport?.iata ?? null,
    destinationIcao: f.arrival?.airport?.icao ?? null,
    destinationCity: f.arrival?.airport?.name ?? null,
    destinationCountry: f.arrival?.airport?.countryCode ?? null,
    scheduledDep: f.departure?.scheduledTime?.utc ?? null,
    actualDep:
      f.departure?.runwayTime?.utc ?? f.departure?.revisedTime?.utc ?? null,
    status: f.status ?? null,
    aircraft: f.aircraft?.model ?? null,
    terminal: f.departure?.terminal ?? null,
    gate: f.departure?.gate ?? null,
  };
}

function mapArrival(f) {
  return {
    flightNumber: f.number ?? null,
    airline: f.airline?.name ?? null,
    airlineIcao: f.airline?.icao ?? null,
    origin: f.departure?.airport?.iata ?? null,
    originIcao: f.departure?.airport?.icao ?? null,
    originCity: f.departure?.airport?.name ?? null,
    originCountry: f.departure?.airport?.countryCode ?? null,
    scheduledArr: f.arrival?.scheduledTime?.utc ?? null,
    actualArr:
      f.arrival?.runwayTime?.utc ?? f.arrival?.revisedTime?.utc ?? null,
    status: f.status ?? null,
    aircraft: f.aircraft?.model ?? null,
    terminal: f.arrival?.terminal ?? null,
    gate: f.arrival?.gate ?? null,
  };
}

/* ── per-airport backfill ────────────────────────────────────────── */

async function backfillAirport(airport) {
  const summaryPath = join(PUBLIC_DIR, `data-flights-${airport.iata}.json`);
  const rawPath = join(PUBLIC_DIR, `data-flights-raw-${airport.iata}.json`);

  // Load existing summary
  let summary = { airport: airport.iata.toUpperCase(), daily: [] };
  try {
    summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  } catch {}
  if (!summary.daily) summary.daily = [];

  // Load existing raw
  let raw = { airport: airport.iata.toUpperCase(), days: {} };
  try {
    raw = JSON.parse(readFileSync(rawPath, "utf8"));
  } catch {}
  if (!raw.days) raw.days = {};

  const existingDates = new Set(summary.daily.map((d) => d.date));

  const dates = getDates(START_DATE, TODAY);
  console.log(`\n=== ${airport.name} (${airport.iata.toUpperCase()}) — ${dates.length} days ===`);

  for (const date of dates) {
    if (existingDates.has(date)) {
      continue; // skip silently
    }

    try {
      const am = await fetchWindow(airport.icao, date, 0, 11);
      await sleep(2000);
      const pm = await fetchWindow(airport.icao, date, 12, 23);
      await sleep(2000);

      const allDep = [...(am.departures || []), ...(pm.departures || [])];
      const allArr = [...(am.arrivals || []), ...(pm.arrivals || [])];
      const total = allDep.length + allArr.length;

      if (total === 0) {
        console.log(`[${airport.iata.toUpperCase()} ${date}] no data — skipping`);
        continue;
      }

      // Count cancelled
      const cancelled = [...allDep, ...allArr].filter((f) =>
        /cancel/i.test(f.status ?? "")
      ).length;

      // Regional breakdown
      const regions = {};
      // Departures: classify by destination (arrival airport) ICAO
      for (const f of allDep) {
        const icao = f.arrival?.airport?.icao ?? "";
        const region = classifyRegion(icao);
        regions[region] = (regions[region] || 0) + 1;
      }
      // Arrivals: classify by origin (departure airport) ICAO
      for (const f of allArr) {
        const icao = f.departure?.airport?.icao ?? "";
        const region = classifyRegion(icao);
        regions[region] = (regions[region] || 0) + 1;
      }

      // Summary entry
      summary.daily.push({
        date,
        departures: allDep.length,
        arrivals: allArr.length,
        total,
        cancelled,
        regions,
        source: "aerodatabox",
      });
      existingDates.add(date);

      // Raw entry
      raw.days[date] = {
        departures: allDep.map(mapDeparture),
        arrivals: allArr.map(mapArrival),
      };

      console.log(
        `[${airport.iata.toUpperCase()} ${date}] dep=${allDep.length} arr=${allArr.length} cancelled=${cancelled}`
      );
    } catch (err) {
      console.error(`[${airport.iata.toUpperCase()} ${date}] ERROR: ${err.message}`);
      await sleep(2000);
    }
  }

  // Sort summary by date
  summary.daily.sort((a, b) => a.date.localeCompare(b.date));
  summary.lastUpdated = new Date().toISOString();
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  // Sort raw days (rewrite object with sorted keys)
  const sortedDays = {};
  for (const k of Object.keys(raw.days).sort()) {
    sortedDays[k] = raw.days[k];
  }
  raw.days = sortedDays;
  raw.lastUpdated = new Date().toISOString();
  writeFileSync(rawPath, JSON.stringify(raw, null, 2));

  console.log(
    `✅ ${airport.iata.toUpperCase()}: ${summary.daily.length} summary days, ${Object.keys(raw.days).length} raw days saved`
  );
}

/* ── main ────────────────────────────────────────────────────────── */

async function main() {
  console.log(`=== Full AeroDataBox backfill: ${START_DATE} → ${TODAY} ===`);
  for (const airport of AIRPORTS) {
    await backfillAirport(airport);
  }
  console.log("\n=== DONE — running build ===");

  const { execSync } = await import("child_process");
  execSync("npm run build", {
    cwd: join(__dirname, ".."),
    stdio: "inherit",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
