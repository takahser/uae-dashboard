#!/usr/bin/env node
/**
 * Backfill `cancelled` counts into existing daily entries for the
 * original 6 airports. Re-fetches each date from AeroDataBox with
 * withCancelled=true and patches the count into the summary JSON.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const RAPIDAPI_KEY = "2bdc3b4403msh8432443db39f320p15abd2jsn252b0a720b81";

const AIRPORTS = [
  { icao: "OMDB", iata: "dxb" },
  { icao: "OMAA", iata: "auh" },
  { icao: "OMDW", iata: "dwc" },
  { icao: "OOMS", iata: "mct" },
  { icao: "OTHH", iata: "doh" },
  { icao: "LLBG", iata: "tlv" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWindow(icao, date, fromHour, toHour) {
  const from = `${date}T${String(fromHour).padStart(2, "0")}:00`;
  const to = `${date}T${String(toHour).padStart(2, "0")}:59`;
  const url =
    `https://aerodatabox.p.rapidapi.com/flights/airports/icao/${icao}/${from}/${to}` +
    `?direction=Both&withLeg=false&withCancelled=true&withCodeshared=false&withCargo=false&withPrivate=false&withLocation=false`;

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

async function backfillAirport(airport) {
  const tag = airport.iata.toUpperCase();
  const summaryPath = join(PUBLIC_DIR, `data-flights-${airport.iata}.json`);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));

  if (!summary.daily) {
    console.log(`⚠ ${tag}: no daily array — skipping`);
    return;
  }

  const toBackfill = summary.daily.filter((e) => !("cancelled" in e));
  console.log(`\n=== ${tag} — ${toBackfill.length}/${summary.daily.length} entries to backfill ===`);

  for (const entry of toBackfill) {
    try {
      const am = await fetchWindow(airport.icao, entry.date, 0, 11);
      await sleep(2000);
      const pm = await fetchWindow(airport.icao, entry.date, 12, 23);
      await sleep(2000);

      const allFlights = [
        ...(am.departures || []),
        ...(am.arrivals || []),
        ...(pm.departures || []),
        ...(pm.arrivals || []),
      ];

      const cancelled = allFlights.filter((f) =>
        /cancel/i.test(f.status ?? "")
      ).length;

      entry.cancelled = cancelled;
      console.log(`[${tag} ${entry.date}] cancelled=${cancelled}`);
    } catch (err) {
      console.error(`[${tag} ${entry.date}] ERROR: ${err.message}`);
      await sleep(2000);
    }
  }

  summary.lastUpdated = new Date().toISOString();
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ ${tag}: saved`);
}

async function main() {
  console.log("=== Backfill cancellations ===");
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
