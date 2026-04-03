import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = '/Users/chou/.openclaw/workspace/doha-flights.json';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
});
const page = await context.newPage();

// Intercept API responses
const apiResponses = [];
page.on('response', async (response) => {
  const url = response.url();
  const ct = response.headers()['content-type'] || '';
  if ((url.includes('api') || url.includes('flight') || url.includes('fids')) && ct.includes('json')) {
    try {
      const body = await response.json();
      console.log(`[API] ${url.slice(0, 120)}`);
      apiResponses.push({ url, body });
    } catch {}
  }
});

// Scrape departures
console.log('Loading Doha departures...');
await page.goto('https://dohahamadairport.com/airlines/flight-status?type=departures&day=yesterday', { 
  waitUntil: 'domcontentloaded', timeout: 45000 
}).catch(e => console.log('goto err:', e.message));
await page.waitForTimeout(8000);

// Scroll to load all
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(500);
}

const depFlights = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr, [class*="flight"], [class*="row"]')];
  return rows.map(r => r.innerText?.trim()).filter(t => t && t.match(/\b[A-Z]{2}\d{1,4}\b/) && t.length < 500);
});
console.log(`Departures rows found: ${depFlights.length}`);

// Scrape arrivals
console.log('Loading Doha arrivals...');
await page.goto('https://dohahamadairport.com/airlines/flight-status?type=arrivals&day=yesterday', { 
  waitUntil: 'domcontentloaded', timeout: 45000 
}).catch(e => console.log('goto err:', e.message));
await page.waitForTimeout(8000);

for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(500);
}

const arrFlights = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr, [class*="flight"], [class*="row"]')];
  return rows.map(r => r.innerText?.trim()).filter(t => t && t.match(/\b[A-Z]{2}\d{1,4}\b/) && t.length < 500);
});
console.log(`Arrivals rows found: ${arrFlights.length}`);

// Extract unique flight numbers
const allText = [...depFlights, ...arrFlights].join('\n');
const flightNumbers = [...new Set((allText.match(/\b[A-Z]{2}\d{1,4}\b/g) || []))].sort();

const result = {
  source: 'dohahamadairport.com',
  scrapedAt: new Date().toISOString(),
  date: 'yesterday (Apr 2)',
  departureRows: depFlights.length,
  arrivalRows: arrFlights.length,
  uniqueFlightNumbers: flightNumbers.length,
  flightNumbers,
  departureTexts: depFlights.slice(0, 300),
  arrivalTexts: arrFlights.slice(0, 300),
  apiEndpoints: apiResponses.map(r => ({ url: r.url, keys: Object.keys(r.body || {}).slice(0, 5) })),
  apiData: apiResponses,
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nSaved to: ${OUT}`);
console.log(`Total unique flight numbers: ${flightNumbers.length}`);

await browser.close();
