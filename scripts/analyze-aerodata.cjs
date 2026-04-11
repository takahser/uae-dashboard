#!/usr/bin/env node
/**
 * Extract all available dates from AeroDataBox data files
 */
const fs = require('fs');

const airports = ['dxb', 'doh', 'jed', 'auh'];

const allDates = {};

for (const airport of airports) {
  const file = `public/data-flights-${airport}.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  console.log(`\n=== ${airport.toUpperCase()} ===`);
  console.log(`Airport: ${data.airportName || data.airport}`);
  console.log(`Total days in file: ${data.daily?.length || 0}`);
  
  const dates = [];
  if (data.daily) {
    for (const day of data.daily) {
      dates.push({
        date: day.date,
        departures: day.departures,
        arrivals: day.arrivals,
        total: day.total,
        source: day.source || 'unknown'
      });
    }
  }
  
  allDates[airport] = dates;
  
  // Show date range
  if (dates.length > 0) {
    console.log(`Date range: ${dates[0].date} to ${dates[dates.length-1].date}`);
    console.log(`First 5 entries:`);
    dates.slice(0, 5).forEach(d => console.log(`  ${d.date}: ${d.departures} dep, ${d.arrivals} arr (source: ${d.source})`));
    console.log(`Last 5 entries:`);
    dates.slice(-5).forEach(d => console.log(`  ${d.date}: ${d.departures} dep, ${d.arrivals} arr (source: ${d.source})`));
  }
}

// Save extracted data for use by fetch script
fs.writeFileSync('scripts/aerodata-dates.json', JSON.stringify(allDates, null, 2));
console.log('\n✅ Saved to scripts/aerodata-dates.json');
