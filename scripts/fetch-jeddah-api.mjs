#!/usr/bin/env node
/**
 * Fetch Jeddah (KAIA) flight data from official API
 */

const BASE_URL = 'https://www.kaia.sa/ext-api/flightsearch/flights';

async function fetchFlights(date, type = 'DEPARTURE') {
  // OData filter for the date range
  const startTime = `${date}T00:00:00+03:00`;
  const endTime = `${date}T23:59:59+03:00`;
  
  const filter = `(EarlyOrDelayedDateTime ge ${startTime} and EarlyOrDelayedDateTime le ${endTime} and FlightNature eq '${type}')`;
  const url = `${BASE_URL}?$filter=${encodeURIComponent(filter)}&$count=true&$top=1000`;
  
  console.log(`Fetching ${type} for ${date}...`);
  
  const res = await fetch(url, {
    headers: {
      'Referer': 'https://www.kaia.sa/en/Flights',
      'Accept': 'application/json',
    }
  });
  
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    return { count: 0, flights: [] };
  }
  
  const data = await res.json();
  return {
    count: data['@odata.count'] || 0,
    flights: data.value || []
  };
}

async function main() {
  // Get yesterday's date
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  console.log(`\n=== Jeddah (KAIA) ${dateStr} ===`);
  
  const deps = await fetchFlights(dateStr, 'DEPARTURE');
  console.log(`Departures: ${deps.count}`);
  
  const arrs = await fetchFlights(dateStr, 'ARRIVAL');
  console.log(`Arrivals: ${arrs.count}`);
  
  console.log(`Total: ${deps.count + arrs.count}`);
  
  // Compare with AeroDataBox
  console.log('\n=== Comparison ===');
  console.log('AeroDataBox JED Apr 3: 768 (390 dep, 378 arr)');
  console.log(`Official KAIA API: ${deps.count + arrs.count} (${deps.count} dep, ${arrs.count} arr)`);
}

main().catch(console.error);
