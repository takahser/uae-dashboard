#!/usr/bin/env node
/**
 * Comprehensive verification: Compare official API data with AeroDataBox data
 * Optimized version with parallel fetching and timeout handling
 */
const fs = require('fs');

// Load AeroDataBox data
const aerodata = JSON.parse(fs.readFileSync('scripts/aerodata-dates.json', 'utf8'));

// Helper: Create date index
function createDateIndex(airportData) {
  const index = {};
  for (const day of airportData) index[day.date] = day;
  return index;
}

const indexes = {
  dxb: createDateIndex(aerodata.dxb),
  doh: createDateIndex(aerodata.doh),
  jed: createDateIndex(aerodata.jed),
  auh: createDateIndex(aerodata.auh)
};

// Fetch with timeout
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// Fetch DOH official data
async function fetchDOH(dateStr) {
  try {
    const [day, month, year] = dateStr.split('-');
    const formattedDate = `${day}-${month}-${year}`;
    const url = `https://dohahamadairport.com/webservices/fids?type=departures&startTime=${formattedDate}%2000:00:00&endTime=${formattedDate}%2023:59:59`;
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.flights) return { error: 'No flights' };
    
    const departures = data.flights.filter(f => f.Codeshare === null || f.Codeshare === 'Master');
    return { departures: departures.length, arrivals: null };
  } catch (e) {
    return { error: e.message };
  }
}

// Fetch DXB - returns all data, caller filters by date
async function fetchDXBAll() {
  try {
    const response = await fetchWithTimeout('https://dubaiairports.ae/docs/passengerslibraries/flights-library/flights-data.json', 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.Flights || [];
  } catch (e) {
    return { error: e.message };
  }
}

// Fetch AUH for a specific day offset
async function fetchAUH(dayOffset) {
  try {
    const url = `https://www.zayedinternationalairport.ae/api/zayed/flight/departure?SearchKey=&day=${dayOffset}&PageSize=500&Language=en`;
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.result?.data) return { error: 'No data' };
    
    const dateCounts = {};
    for (const flight of data.result.data) {
      const date = flight.scheduled_date;
      if (date) {
        if (!dateCounts[date]) dateCounts[date] = 0;
        dateCounts[date]++;
      }
    }
    return { dateCounts };
  } catch (e) {
    return { error: e.message };
  }
}

// Fetch JED
async function fetchJED(dateStr) {
  try {
    const url = `https://www.kaia.sa/ext-api/flightsearch/flights?FlightDate=${dateStr}&Type=D`;
    const response = await fetchWithTimeout(url, 15000);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const flights = data.value || [];
    return { departures: flights.length };
  } catch (e) {
    return { error: e.message };
  }
}

function calcMatch(official, aerobox) {
  if (!official || !aerobox || official === 0) return 0;
  return Math.round((Math.min(official, aerobox) / Math.max(official, aerobox)) * 100);
}

function getStatus(matchPct) {
  if (matchPct >= 95) return 'match';
  if (matchPct >= 70) return 'partial';
  return 'mismatch';
}

async function main() {
  console.log('='.repeat(90));
  console.log('FLIGHT DATA HISTORICAL ACCURACY COMPARISON');
  console.log('Comparing Official Airport APIs vs AeroDataBox Data');
  console.log('='.repeat(90));
  
  const comparisons = [];
  const summary = { totalDays: 0, matches: 0, partials: 0, mismatches: 0, errors: 0 };
  
  // DOH - fetch in parallel batches
  console.log('\n--- DOH (Doha) ---');
  const dohDates = ['2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', 
                    '2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31',
                    '2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'];
  
  for (let i = 0; i < dohDates.length; i += 3) {
    const batch = dohDates.slice(i, i + 3);
    const results = await Promise.all(batch.map(date => fetchDOH(date)));
    
    for (let j = 0; j < batch.length; j++) {
      const date = batch[j];
      const officialData = results[j];
      const aeroboxData = indexes.doh[date];
      
      if (officialData.error) {
        console.log(`${date}: ERROR - ${officialData.error}`);
        summary.errors++;
        continue;
      }
      
      const officialTotal = officialData.departures * 2;
      const aeroboxTotal = aeroboxData.departures + aeroboxData.arrivals;
      const matchPct = calcMatch(officialTotal, aeroboxTotal);
      const status = getStatus(matchPct);
      
      comparisons.push({ date, airport: 'DOH', official_count: officialTotal, aerobox_count: aeroboxTotal, match_pct: matchPct, status });
      summary.totalDays++;
      if (status === 'match') summary.matches++;
      else if (status === 'partial') summary.partials++;
      else summary.mismatches++;
      
      console.log(`${date}: ${status === 'match' ? '✓' : status === 'partial' ? '~' : '✗'} Official=${officialTotal} AeroDataBox=${aeroboxTotal} (${matchPct}%)`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // DXB - fetch once, filter for recent dates
  console.log('\n--- DXB (Dubai) ---');
  const dxbFlights = await fetchDXBAll();
  
  if (!dxbFlights.error) {
    for (const date of ['2026-04-03', '2026-04-04', '2026-04-05']) {
      const aeroboxData = indexes.dxb[date];
      const departures = dxbFlights.filter(f => {
        if (f.arrivalDepartureFlag !== 'D') return false;
        return f.scheduledoffblockTime?.substring(0, 10) === date;
      });
      
      const officialDep = new Set(departures.map(f => f.flightNumber)).size;
      const officialTotal = officialDep * 2;
      const aeroboxTotal = aeroboxData.departures + aeroboxData.arrivals;
      const matchPct = calcMatch(officialTotal, aeroboxTotal);
      const status = getStatus(matchPct);
      
      comparisons.push({ date, airport: 'DXB', official_count: officialTotal, aerobox_count: aeroboxTotal, match_pct: matchPct, status, note: 'API has current data only' });
      summary.totalDays++;
      if (status === 'match') summary.matches++;
      else if (status === 'partial') summary.partials++;
      else summary.mismatches++;
      
      console.log(`${date}: ${status === 'match' ? '✓' : status === 'partial' ? '~' : '✗'} Official=${officialTotal} AeroDataBox=${aeroboxTotal} (${matchPct}%)`);
    }
  } else {
    console.log(`ERROR: ${dxbFlights.error}`);
  }
  
  // AUH - fetch all day offsets in parallel
  console.log('\n--- AUH (Abu Dhabi) ---');
  const auhResults = await Promise.all([0, -1, -2, -3].map(day => fetchAUH(day)));
  const auhDateCounts = {};
  for (const result of auhResults) {
    if (result.dateCounts) Object.assign(auhDateCounts, result.dateCounts);
  }
  
  for (const [date, count] of Object.entries(auhDateCounts)) {
    if (!indexes.auh[date]) continue;
    const aeroboxData = indexes.auh[date];
    const officialTotal = count * 2;
    const aeroboxTotal = aeroboxData.departures + aeroboxData.arrivals;
    const matchPct = calcMatch(officialTotal, aeroboxTotal);
    const status = getStatus(matchPct);
    
    comparisons.push({ date, airport: 'AUH', official_count: officialTotal, aerobox_count: aeroboxTotal, match_pct: matchPct, status });
    summary.totalDays++;
    if (status === 'match') summary.matches++;
    else if (status === 'partial') summary.partials++;
    else summary.mismatches++;
    
    console.log(`${date}: ${status === 'match' ? '✓' : status === 'partial' ? '~' : '✗'} Official=${officialTotal} AeroDataBox=${aeroboxTotal} (${matchPct}%)`);
  }
  
  // JED - fetch in parallel
  console.log('\n--- JED (Jeddah) ---');
  const jedDates = ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03'];
  const jedResults = await Promise.all(jedDates.map(date => fetchJED(date)));
  
  for (let i = 0; i < jedDates.length; i++) {
    const date = jedDates[i];
    const officialData = jedResults[i];
    const aeroboxData = indexes.jed[date];
    
    if (officialData.error) {
      console.log(`${date}: ERROR - ${officialData.error}`);
      summary.errors++;
      continue;
    }
    
    const officialTotal = officialData.departures * 2;
    const aeroboxTotal = aeroboxData.departures + aeroboxData.arrivals;
    const matchPct = calcMatch(officialTotal, aeroboxTotal);
    const status = getStatus(matchPct);
    
    comparisons.push({ date, airport: 'JED', official_count: officialTotal, aerobox_count: aeroboxTotal, match_pct: matchPct, status });
    summary.totalDays++;
    if (status === 'match') summary.matches++;
    else if (status === 'partial') summary.partials++;
    else summary.mismatches++;
    
    console.log(`${date}: ${status === 'match' ? '✓' : status === 'partial' ? '~' : '✗'} Official=${officialTotal} AeroDataBox=${aeroboxTotal} (${matchPct}%)`);
  }
  
  // Save results
  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalDays: summary.totalDays,
      matches: summary.matches,
      partials: summary.partials,
      mismatches: summary.mismatches,
      errors: summary.errors,
      matchRate: summary.totalDays > 0 ? Math.round((summary.matches / summary.totalDays) * 100) : 0
    },
    comparisons: comparisons.sort((a, b) => a.date.localeCompare(b.date) || a.airport.localeCompare(b.airport))
  };
  
  fs.writeFileSync('public/verification/historical-accuracy.json', JSON.stringify(output, null, 2));
  
  // Print summary
  console.log('\n' + '='.repeat(90));
  console.log('SUMMARY');
  console.log('='.repeat(90));
  console.log(`Total Days Compared:  ${summary.totalDays}`);
  console.log(`Matches (≥95%):       ${summary.matches} (${Math.round(summary.matches/summary.totalDays*100)}%)`);
  console.log(`Partials (70-94%):    ${summary.partials} (${Math.round(summary.partials/summary.totalDays*100)}%)`);
  console.log(`Mismatches (<70%):    ${summary.mismatches} (${Math.round(summary.mismatches/summary.totalDays*100)}%)`);
  console.log(`Errors:               ${summary.errors}`);
  console.log(`Overall Match Rate:   ${output.summary.matchRate}%`);
  console.log('\n✅ Results saved to public/verification/historical-accuracy.json');
  
  // Print detailed table
  console.log('\n' + '='.repeat(90));
  console.log('DETAILED COMPARISON TABLE');
  console.log('='.repeat(90));
  console.log(`${'Date'.padEnd(12)} ${'Airport'.padEnd(8)} ${'Official'.padEnd(10)} ${'AeroDataBox'.padEnd(12)} ${'Match%'.padEnd(8)} ${'Status'.padEnd(12)}`);
  console.log('-'.repeat(90));
  for (const comp of output.comparisons) {
    const statusStr = comp.status === 'match' ? '✓ MATCH' : comp.status === 'partial' ? '~ PARTIAL' : '✗ MISMATCH';
    console.log(`${comp.date.padEnd(12)} ${comp.airport.padEnd(8)} ${String(comp.official_count).padEnd(10)} ${String(comp.aerobox_count).padEnd(12)} ${String(comp.match_pct + '%').padEnd(8)} ${statusStr}`);
  }
}

main().catch(console.error);
