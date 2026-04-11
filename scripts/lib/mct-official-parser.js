/**
 * Pure HTML parser for Muscat International Airport (MCT) official flight schedules.
 * Input: HTML string from flightstatusframe endpoint
 * Output: Parsed flight rows
 */

import * as cheerio from "cheerio";
import { iataToIcao } from "./iata-to-icao.js";

/**
 * Extract IATA code from airport name if present, or map from known city names.
 * The HTML shows city names (e.g., "Jeddah", "Doha") without explicit IATA codes.
 */
function extractIataFromCity(cityName) {
  if (!cityName) return null;
  
  // Known city to IATA mappings for common MCT destinations/origins
  const cityToIata = {
    // Middle East
    "Jeddah": "JED",
    "Riyadh": "RUH",
    "Dammam": "DMM",
    "Medina": "MED",
    "Doha": "DOH",
    "Dubai": "DXB",
    "Abu Dhabi": "AUH",
    "Sharjah": "SHJ",
    "Bahrain": "BAH",
    "Kuwait": "KWI",
    "Salalah": "SLL",
    "Fujairah": "FJR",
    "Ras Al Khaimah": "RKT",
    "Al Ain": "AAN",
    "Sohar": "OHS",
    "Duqm": "DQM",
    "Khasab": "KHS",
    "Tehran": "IKA",
    "Mashhad": "MHD",
    "Baghdad": "BGW",
    "Najaf": "NJF",
    "Erbil": "EBL",
    "Sulaymaniyah": "ISU",
    "Beirut": "BEY",
    "Amman": "AMM",
    "Cairo": "CAI",
    "Alexandria": "HBE",
    "Sharm El Sheikh": "SSH",
    "Hurghada": "HRG",
    "Luxor": "LXR",
    "Addis Ababa": "ADD",
    "Khartoum": "KRT",
    
    // India
    "Mumbai": "BOM",
    "Delhi": "DEL",
    "Chennai": "MAA",
    "Bangalore": "BLR",
    "Hyderabad": "HYD",
    "Kochi": "COK",
    "Thiruvananthapuram": "TRV",
    "Kozhikode": "CCJ",
    "Kannur": "CNN",
    "Pune": "PNQ",
    "Ahmedabad": "AMD",
    "Jaipur": "JAI",
    "Lucknow": "LKO",
    "Mangalore": "IXE",
    "Chandigarh": "IXC",
    "Amritsar": "ATQ",
    "Goa": "GOI",
    "Kolkata": "CCU",
    "Guwahati": "GAU",
    "Patna": "PAT",
    "Bhubaneswar": "BBI",
    "Varanasi": "VNS",
    "Nagpur": "NAG",
    "Indore": "IND",
    "Surat": "STV",
    "Vadodara": "BDQ",
    "Coimbatore": "CJB",
    "Madurai": "IXM",
    "Trichy": "TRZ",
    
    // Pakistan
    "Karachi": "KHI",
    "Lahore": "LHE",
    "Islamabad": "ISB",
    "Peshawar": "PEW",
    "Multan": "MUX",
    "Sialkot": "SKT",
    "Quetta": "UET",
    "Faisalabad": "LYP",
    
    // Bangladesh
    "Dhaka": "DAC",
    "Chittagong": "CGP",
    
    // Sri Lanka
    "Colombo": "CMB",
    
    // Nepal
    "Kathmandu": "KTM",
    
    // Maldives
    "Male": "MLE",
    
    // Southeast Asia
    "Bangkok": "BKK",
    "Phuket": "HKT",
    "Singapore": "SIN",
    "Kuala Lumpur": "KUL",
    "Jakarta": "CGK",
    "Manila": "MNL",
    "Hong Kong": "HKG",
    "Guangzhou": "CAN",
    "Shanghai": "PVG",
    "Beijing": "PEK",
    "Tokyo": "NRT",
    "Seoul": "ICN",
    "Taipei": "TPE",
    "Ho Chi Minh City": "SGN",
    "Hanoi": "HAN",
    "Phnom Penh": "PNH",
    "Yangon": "RGN",
    
    // Europe
    "London": "LHR",
    "Manchester": "MAN",
    "Paris": "CDG",
    "Frankfurt": "FRA",
    "Munich": "MUC",
    "Amsterdam": "AMS",
    "Rome": "FCO",
    "Milan": "MXP",
    "Madrid": "MAD",
    "Barcelona": "BCN",
    "Zurich": "ZRH",
    "Geneva": "GVA",
    "Vienna": "VIE",
    "Copenhagen": "CPH",
    "Stockholm": "ARN",
    "Oslo": "OSL",
    "Helsinki": "HEL",
    "Dublin": "DUB",
    "Brussels": "BRU",
    "Prague": "PRG",
    "Warsaw": "WAW",
    "Budapest": "BUD",
    "Athens": "ATH",
    "Istanbul": "IST",
    "Antalya": "AYT",
    "Izmir": "ADB",
    "Larnaca": "LCA",
    "Paphos": "PFO",
    "Moscow": "SVO",
    "St Petersburg": "LED",
    
    // Africa
    "Johannesburg": "JNB",
    "Cape Town": "CPT",
    "Nairobi": "NBO",
    "Dar es Salaam": "DAR",
    "Zanzibar": "ZNZ",
    "Kigali": "KGL",
    "Entebbe": "EBB",
    
    // Americas
    "New York": "JFK",
    "Los Angeles": "LAX",
    "Chicago": "ORD",
    "Toronto": "YYZ",
  };
  
  const normalized = cityName.trim();
  return cityToIata[normalized] || null;
}

/**
 * Parse scheduled time from text like "11/04/2026 20:55"
 * Returns ISO 8601 timestamp string
 */
function parseScheduledTime(timeText) {
  if (!timeText) return null;
  const match = timeText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  
  const [, day, month, year, hour, minute] = match;
  // Create date in Oman local time (UTC+4)
  const omanDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00+04:00`);
  return omanDate.toISOString();
}

/**
 * Extract just the time portion for deduplication
 */
function extractTimeKey(timeText) {
  if (!timeText) return null;
  const match = timeText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}`;
}

/**
 * Extract status text from the status cell
 */
function extractStatus($, statusCell) {
  const statusLink = $(statusCell).find('a');
  if (statusLink.length) {
    return statusLink.text().trim();
  }
  return $(statusCell).text().trim();
}

/**
 * Parse flight rows from the HTML table
 * @param {CheerioStatic} $ - Cheerio-loaded HTML
 * @param {boolean} isArrival - true for arrivals, false for departures
 * @returns {Array} Array of flight objects
 */
function parseFlightRows($, isArrival) {
  const flights = [];
  
  // Find all tbody elements that contain flight rows
  const tbodies = $('tbody.milestone, tbody.allmiles');
  
  if (tbodies.length === 0) {
    throw new Error('No flight table found in HTML - structure may have changed');
  }
  
  tbodies.each((_, tbody) => {
    $(tbody).find('tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 6) return; // Skip incomplete rows
      
      const airlineCell = cells[0];
      const cityCell = cells[1];
      const flightNoCell = cells[2];
      const scheduledCell = cells[3];
      // cells[4] is actual/estimated time (not used for counting)
      // cells[5] is social media buttons
      const statusCell = cells[6];
      
      // Extract airline
      const airline = $(airlineCell).find('p').text().trim() || 
                     $(airlineCell).text().trim();
      
      // Extract city (origin for arrivals, destination for departures)
      const city = $(cityCell).text().trim();
      
      // Extract flight number
      const flightNo = $(flightNoCell).text().trim();
      
      // Extract scheduled time
      const scheduledText = $(scheduledCell).text().trim();
      const scheduledTime = parseScheduledTime(scheduledText);
      const timeKey = extractTimeKey(scheduledText);
      
      // Extract status
      const status = extractStatus($, statusCell);
      
      // Get IATA code from city name
      const iata = extractIataFromCity(city);
      const icao = iataToIcao(iata);
      
      const flight = {
        flightNo,
        airline,
        scheduledTime,
        scheduledTimeKey: timeKey, // Used for deduplication
        status,
      };
      
      if (isArrival) {
        flight.originCity = city;
        flight.originIata = iata;
        flight.originIcao = icao;
      } else {
        flight.destCity = city;
        flight.destIata = iata;
        flight.destIcao = icao;
      }
      
      flights.push(flight);
    });
  });
  
  return flights;
}

/**
 * Deduplicate flights based on scheduled time and origin/destination city.
 * This handles code-share flights where the same physical flight has multiple flight numbers.
 */
function deduplicateFlights(flights, isArrival) {
  const seen = new Set();
  return flights.filter(flight => {
    const cityKey = isArrival ? flight.originCity : flight.destCity;
    const key = `${flight.scheduledTimeKey}|${cityKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Filter out cancelled flights, keep delayed and diverted.
 * @param {Array} flights 
 * @returns {Array}
 */
function filterActiveFlights(flights) {
  return flights.filter(f => {
    const status = (f.status || '').toLowerCase();
    // Exclude cancelled flights, include everything else (even empty status)
    return !status.includes('cancelled') && !status.includes('canceled');
  });
}

/**
 * Parse arrivals HTML and return flight objects
 * @param {string} html - HTML string from flightstatusframe?type=1
 * @returns {Array} Array of arrival flight objects
 */
export function parseArrivals(html) {
  const $ = cheerio.load(html);
  
  // Check if we have the expected table structure
  const tbodies = $('tbody.milestone, tbody.allmiles');
  if (tbodies.length === 0) {
    // Check if there's any table at all (might be empty schedule)
    const anyTable = $('table');
    if (anyTable.length === 0) {
      throw new Error('No table found in HTML - structure may have changed');
    }
    // Table exists but no flight rows - valid empty day
    return [];
  }
  
  const flights = parseFlightRows($, true);
  const activeFlights = filterActiveFlights(flights);
  const uniqueFlights = deduplicateFlights(activeFlights, true);
  
  // Validate: if HTML has content but we got 0 flights, that's suspicious
  const htmlHasContent = html.length > 5000;
  if (htmlHasContent && uniqueFlights.length === 0 && flights.length > 0) {
    // All flights were filtered out - possible parsing issue
    console.warn(`Warning: All ${flights.length} flights were filtered out (possible status parsing issue)`);
  }
  
  return uniqueFlights;
}

/**
 * Parse departures HTML and return flight objects
 * @param {string} html - HTML string from flightstatusframe?type=2
 * @returns {Array} Array of departure flight objects
 */
export function parseDepartures(html) {
  const $ = cheerio.load(html);
  
  // Check if we have the expected table structure
  const tbodies = $('tbody.milestone, tbody.allmiles');
  if (tbodies.length === 0) {
    // Check if there's any table at all (might be empty schedule)
    const anyTable = $('table');
    if (anyTable.length === 0) {
      throw new Error('No table found in HTML - structure may have changed');
    }
    // Table exists but no flight rows - valid empty day
    return [];
  }
  
  const flights = parseFlightRows($, false);
  const activeFlights = filterActiveFlights(flights);
  const uniqueFlights = deduplicateFlights(activeFlights, false);
  
  // Validate: if HTML has content but we got 0 flights, that's suspicious
  const htmlHasContent = html.length > 5000;
  if (htmlHasContent && uniqueFlights.length === 0 && flights.length > 0) {
    console.warn(`Warning: All ${flights.length} flights were filtered out (possible status parsing issue)`);
  }
  
  return uniqueFlights;
}
