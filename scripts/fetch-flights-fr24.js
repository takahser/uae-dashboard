#!/usr/bin/env node
/**
 * Fetch TODAY's live flight counts from Flightradar24 for UAE + regional airports.
 * Merges todayArrivals/todayDepartures/todayTotal/todayFetched into each
 * public/data-flights-{code}.json without overwriting status fields.
 *
 * Usage: node scripts/fetch-flights-fr24.js
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AIRPORTS = [
  { iata: "DXB", name: "Dubai International (DXB)" },
  { iata: "AUH", name: "Abu Dhabi Intl (AUH)" },
  { iata: "DWC", name: "Al Maktoum Intl (DWC)" },
  { iata: "MCT", name: "Muscat Intl (MCT)" },
  { iata: "DOH", name: "Hamad Intl (DOH)" },
  { iata: "TLV", name: "Ben Gurion Intl (TLV)" },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(airportCode, mode, timestamp, page = 1) {
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
    console.warn(`  FR24 ${mode} ${airportCode} p${page}: HTTP ${res.status}`);
    return null;
  }
  return res.json();
}

async function countFlights(airportCode, mode) {
  const timestamp = Math.floor(Date.now() / 1000);
  const first = await fetchPage(airportCode, mode, timestamp, 1);
  if (!first) return 0;

  const section =
    first.result?.response?.airport?.pluginData?.schedule?.[mode];
  if (!section) return 0;

  const totalItems = section.item?.total ?? section.data?.length ?? 0;
  const totalPages = Math.min(section.page?.total ?? 1, 5); // cap at 5

  let count = section.data?.length ?? 0;

  for (let page = 2; page <= totalPages; page++) {
    await delay(300);
    const data = await fetchPage(airportCode, mode, timestamp, page);
    if (!data) break;
    const s = data.result?.response?.airport?.pluginData?.schedule?.[mode];
    if (!s?.data?.length) break;
    count += s.data.length;
  }

  // Prefer the API's total count if it's larger (covers pages we didn't fetch)
  return Math.max(count, totalItems);
}

async function processAirport(airport) {
  const dataFile = join(
    __dirname,
    "..",
    "public",
    `data-flights-${airport.iata.toLowerCase()}.json`
  );

  let existing = {};
  try {
    existing = JSON.parse(readFileSync(dataFile, "utf8"));
  } catch {
    existing = { airportName: airport.name };
  }

  console.log(`[${airport.iata}] Fetching arrivals...`);
  const arrivals = await countFlights(airport.iata, "arrivals");
  await delay(300);

  console.log(`[${airport.iata}] Fetching departures...`);
  const departures = await countFlights(airport.iata, "departures");

  const total = arrivals + departures;
  console.log(
    `[${airport.iata}] arrivals=${arrivals} departures=${departures} total=${total}`
  );

  // Merge — preserve existing status fields, update only today* fields
  existing.todayArrivals = arrivals;
  existing.todayDepartures = departures;
  existing.todayTotal = total;
  existing.todayFetched = new Date().toISOString();

  writeFileSync(dataFile, JSON.stringify(existing, null, 2) + "\n");
  console.log(`[${airport.iata}] Wrote ${dataFile}`);
}

async function main() {
  for (const airport of AIRPORTS) {
    await processAirport(airport);
    await delay(500);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
