#!/usr/bin/env node
/**
 * Investigate JED API format
 */
async function fetchJED() {
  // Try different URL formats
  const urls = [
    // Format 1: OData filter
    "https://www.kaia.sa/ext-api/flightsearch/flights?$filter=FlightDate%20eq%20'2026-04-05'%20and%20Type%20eq%20'D'",
    // Format 2: Without OData encoding
    "https://www.kaia.sa/ext-api/flightsearch/flights?$filter=FlightDate eq '2026-04-05' and Type eq 'D'",
    // Format 3: Different query format
    "https://www.kaia.sa/ext-api/flightsearch/flights?FlightDate=2026-04-05&Type=D",
    // Format 4: Base endpoint
    "https://www.kaia.sa/ext-api/flightsearch/flights",
  ];
  
  for (const url of urls) {
    console.log(`\nTrying: ${url}`);
    try {
      const response = await fetch(url);
      console.log(`Status: ${response.status}`);
      const text = await response.text();
      console.log(`Response: ${text.substring(0, 500)}`);
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

fetchJED().catch(console.error);
