#!/usr/bin/env node
/**
 * Backfill DOH flight data from official Doha Hamad Airport API
 * IMPORTANT: Filter by Codeshare='Master' or null to get actual operating flights
 * (The API includes codeshares as separate rows which inflates counts)
 */

import { readFileSync, writeFileSync } from 'fs';

const DATA_FILE = './public/data-flights-doh.json';
const API_BASE = 'https://dohahamadairport.com/webservices/fids';

function formatDate(date) {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

async function fetchFlights(date, type) {
  const dateStr = formatDate(date);
  const url = `${API_BASE}?type=${type}&startTime=${dateStr}%2000:00:00&endTime=${dateStr}%2023:59:59`;
  
  const res = await fetch(url, {
    headers: { 'Referer': 'https://dohahamadairport.com' }
  });
  
  if (!res.ok) {
    console.warn(`  [${type}] HTTP ${res.status}`);
    return [];
  }
  
  const data = await res.json();
  const allFlights = data.flights || [];
  
  // Filter to only operating flights (Master or null codeshare)
  // "Shared" entries are codeshares that duplicate the Master flight
  const operatingFlights = allFlights.filter(f => 
    f.Codeshare === 'Master' || f.Codeshare === null || f.Codeshare === undefined
  );
  
  return operatingFlights;
}

async function main() {
  // Load existing data
  const existing = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const dailyMap = new Map(existing.daily.map(d => [d.date, d]));
  
  console.log(`Loaded ${existing.daily.length} existing entries`);
  console.log('NOTE: Filtering for operating flights only (Codeshare=Master or null)');
  console.log('');
  
  // Go back 35 days
  const today = new Date();
  let updated = 0;
  let noData = 0;
  
  for (let daysAgo = 1; daysAgo <= 35; daysAgo++) {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const isoDate = toISODate(date);
    
    // Fetch departures and arrivals
    const deps = await fetchFlights(date, 'departures');
    await new Promise(r => setTimeout(r, 300));
    const arrs = await fetchFlights(date, 'arrivals');
    
    if (deps.length === 0 && arrs.length === 0) {
      console.log(`${isoDate}: No data available`);
      noData++;
      if (noData >= 3) {
        console.log('3 consecutive days with no data, stopping');
        break;
      }
      continue;
    }
    
    noData = 0;
    
    const total = deps.length + arrs.length;
    const oldEntry = dailyMap.get(isoDate);
    const oldTotal = oldEntry?.total || 0;
    
    const newEntry = {
      date: isoDate,
      total,
      departures: deps.length,
      arrivals: arrs.length,
      source: 'dohahamadairport.com',
      note: 'Operating flights only (excludes codeshare duplicates)',
      ...(oldEntry?.regions ? { regions: oldEntry.regions } : {}),
    };
    
    if (oldTotal !== total) {
      console.log(`${isoDate}: ${oldTotal} → ${total} (dep: ${deps.length}, arr: ${arrs.length})`);
      updated++;
    } else {
      console.log(`${isoDate}: ${total} (unchanged)`);
    }
    
    dailyMap.set(isoDate, newEntry);
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  existing.daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
  writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2));
  console.log(`\nDone. Updated ${updated} entries. Total: ${existing.daily.length}`);
}

main().catch(console.error);
