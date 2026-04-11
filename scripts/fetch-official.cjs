#!/usr/bin/env node
/**
 * Fetch official API data for comparison with AeroDataBox data
 */
const fs = require('fs');

const aerodata = JSON.parse(fs.readFileSync('scripts/aerodata-dates.json', 'utf8'));

// Helper to format date for APIs
function formatDateDDMMYYYY(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

function formatDateISO(dateStr) {
  return dateStr; // Already YYYY-MM-DD
}

// Fetch DXB official data for a date
async function fetchDXB(dateStr) {
  try {
    const response = await fetch('https://dubaiairports.ae/docs/passengerslibraries/flights-library/flights-data.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (!data.Flights || !Array.isArray(data.Flights)) {
      return { error: 'No Flights array in response' };
    }
    
    // Filter for departures on the specific date
    const targetDate = dateStr; // YYYY-MM-DD
    const departures = data.Flights.filter(f => {
      if (f.arrivalDepartureFlag !== 'D') return false;
      const flightDate = f.scheduledoffblockTime?.substring(0, 10);
      return flightDate === targetDate;
    });
    
    // Count unique flights (by flight number)
    const uniqueFlights = new Set(departures.map(f => f.flightNumber)).size;
    
    return {
      departures: uniqueFlights,
      raw_count: departures.length,
      note: 'Filtered by scheduledoffblockTime date, arrivalDepartureFlag=D'
    };
  } catch (e) {
    return { error: e.message };
  }
}

// Fetch DOH official data for a date
async function fetchDOH(dateStr) {
  try {
    const formattedDate = formatDateDDMMYYYY(dateStr);
    const url = `https://dohahamadairport.com/webservices/fids?type=departures&startTime=${formattedDate}%2000:00:00&endTime=${formattedDate}%2023:59:59`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (!data.flights || !Array.isArray(data.flights)) {
      return { error: 'No flights array in response' };
    }
    
    // Filter: Codeshare is null or 'Master' (operating flights only)
    const operatingFlights = data.flights.filter(f => 
      f.Codeshare === null || f.Codeshare === 'Master'
    );
    
    return {
      departures: operatingFlights.length,
      raw_count: data.flights.length,
      note: 'Filtered: Codeshare=null or Master (operating flights only)'
    };
  } catch (e) {
    return { error: e.message };
  }
}

// Fetch AUH official data - try day=0,-1,-2,-3 and map to dates
async function fetchAUHAll() {
  const results = {};
  const daysToTry = [0, -1, -2, -3];
  
  for (const day of daysToTry) {
    try {
      const url = `https://www.zayedinternationalairport.ae/api/zayed/flight/departure?SearchKey=&day=${day}&PageSize=500&Language=en`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      
      if (data?.Data?.List && Array.isArray(data.Data.List)) {
        // Count flights per date
        const dateCounts = {};
        for (const flight of data.Data.List) {
          // Try to extract date from ScheduledTime or EstimatedTime
          const dateStr = flight.ScheduledTime?.substring(0, 10) || 
                         flight.EstimatedTime?.substring(0, 10) ||
                         flight.Date?.substring(0, 10);
          if (dateStr) {
            dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
          }
        }
        
        results[`day_${day}`] = {
          total_flights: data.Data.List.length,
          date_counts: dateCounts
        };
      }
    } catch (e) {
      results[`day_${day}`] = { error: e.message };
    }
  }
  
  return results;
}

// Fetch JED official data for a date
async function fetchJED(dateStr) {
  try {
    const url = `https://www.kaia.sa/ext-api/flightsearch/flights?$filter=FlightDate%20eq%20'${dateStr}'%20and%20Type%20eq%20'D'`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // The response structure varies - try to count flights
    let flights = [];
    if (Array.isArray(data)) {
      flights = data;
    } else if (data.value && Array.isArray(data.value)) {
      flights = data.value;
    } else if (data.data && Array.isArray(data.data)) {
      flights = data.data;
    } else if (data.flights && Array.isArray(data.flights)) {
      flights = data.flights;
    }
    
    return {
      departures: flights.length,
      note: `Filtered by FlightDate=${dateStr} and Type=D`
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  const allResults = {};
  
  console.log('Fetching official API data for comparison...\n');
  
  // DXB - Try today (2026-04-05) and see if API has historical
  console.log('=== DXB (Dubai) ===');
  // DXB API returns all flights, filter by date
  const dxbToday = await fetchDXB('2026-04-05');
  console.log('2026-04-05:', dxbToday);
  allResults.dxb = { '2026-04-05': dxbToday };
  
  // Try a few historical dates
  for (const date of ['2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01']) {
    const result = await fetchDXB(date);
    allResults.dxb[date] = result;
    console.log(`${date}:`, result.error ? `Error: ${result.error}` : `${result.departures} departures`);
    await new Promise(r => setTimeout(r, 500)); // Rate limiting
  }
  
  // DOH - Try multiple dates
  console.log('\n=== DOH (Doha) ===');
  allResults.doh = {};
  const dohDates = ['2026-04-05', '2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01', 
                    '2026-03-31', '2026-03-30', '2026-03-29', '2026-03-28', '2026-03-27'];
  for (const date of dohDates) {
    const result = await fetchDOH(date);
    allResults.doh[date] = result;
    console.log(`${date}:`, result.error ? `Error: ${result.error}` : `${result.departures} departures`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // AUH - Fetch all available days
  console.log('\n=== AUH (Abu Dhabi) ===');
  const auhResults = await fetchAUHAll();
  allResults.auh = auhResults;
  console.log(JSON.stringify(auhResults, null, 2));
  
  // JED - Try multiple dates
  console.log('\n=== JED (Jeddah) ===');
  allResults.jed = {};
  const jedDates = ['2026-04-05', '2026-04-04', '2026-04-03', '2026-04-02', '2026-04-01',
                    '2026-03-31', '2026-03-30', '2026-03-29'];
  for (const date of jedDates) {
    const result = await fetchJED(date);
    allResults.jed[date] = result;
    console.log(`${date}:`, result.error ? `Error: ${result.error}` : `${result.departures} departures`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Save results
  fs.writeFileSync('scripts/official-api-results.json', JSON.stringify(allResults, null, 2));
  console.log('\n✅ Results saved to scripts/official-api-results.json');
}

main().catch(console.error);
