#!/usr/bin/env node
/**
 * Dedicated JED verification with longer timeout
 */
const fs = require('fs');

const aerodata = JSON.parse(fs.readFileSync('scripts/aerodata-dates.json', 'utf8'));
const jedIndex = {};
for (const day of aerodata.jed) jedIndex[day.date] = day;

async function fetchJED(dateStr) {
  try {
    const url = `https://www.kaia.sa/ext-api/flightsearch/flights?FlightDate=${dateStr}&Type=D`;
    console.log(`Fetching ${dateStr}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const flights = data.value || [];
    console.log(`  ${dateStr}: ${flights.length} flights`);
    return { departures: flights.length };
  } catch (e) {
    console.log(`  ${dateStr}: ERROR - ${e.message}`);
    return { error: e.message };
  }
}

async function main() {
  const dates = ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03'];
  const results = [];
  
  for (const date of dates) {
    const result = await fetchJED(date);
    if (!result.error) {
      const aerobox = jedIndex[date];
      const officialTotal = result.departures * 2;
      const aeroboxTotal = aerobox.departures + aerobox.arrivals;
      const matchPct = Math.round((Math.min(officialTotal, aeroboxTotal) / Math.max(officialTotal, aeroboxTotal)) * 100);
      results.push({ date, official: officialTotal, aerobox: aeroboxTotal, matchPct });
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\nJED Results:');
  for (const r of results) {
    console.log(`${r.date}: Official=${r.official} AeroDataBox=${r.aerobox} (${r.matchPct}%)`);
  }
  
  fs.writeFileSync('scripts/jed-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
