#!/usr/bin/env node
/**
 * Fetch AUH official data with day offsets
 */
async function fetchAUH(day) {
  const url = `https://www.zayedinternationalairport.ae/api/zayed/flight/departure?SearchKey=&day=${day}&PageSize=500&Language=en`;
  console.log(`\nFetching day=${day}...`);
  console.log(`URL: ${url}`);
  
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status}`);
    const data = await response.json();
    
    // Check structure
    console.log('Response keys:', Object.keys(data));
    
    if (data.Data) {
      console.log('Data keys:', Object.keys(data.Data));
      if (data.Data.List) {
        console.log(`List length: ${data.Data.List.length}`);
        
        // Count by date
        const dateCounts = {};
        for (const flight of data.Data.List.slice(0, 5)) {
          console.log('Sample flight:', JSON.stringify(flight, null, 2).substring(0, 500));
          break;
        }
        
        for (const flight of data.Data.List) {
          // Extract date from flight
          const dateField = flight.Date || flight.ScheduledDate || flight.DepartureDate;
          const timeField = flight.ScheduledTime || flight.EstimatedTime;
          const date = dateField || (timeField ? timeField.substring(0, 10) : null);
          
          if (date) {
            dateCounts[date] = (dateCounts[date] || 0) + 1;
          }
        }
        
        console.log('Date counts:', dateCounts);
        return { count: data.Data.List.length, dateCounts };
      }
    }
    
    return { data };
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return { error: e.message };
  }
}

async function main() {
  const results = {};
  for (const day of [0, -1, -2, -3, -4, -5]) {
    results[day] = await fetchAUH(day);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('\n=== Final Results ===');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
