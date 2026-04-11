import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = '/Users/chou/.openclaw/workspace/jeddah-flights.json';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
});
const page = await context.newPage();

const apiResponses = [];
page.on('response', async (response) => {
  const url = response.url();
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('json') && (url.includes('flight') || url.includes('api') || url.includes('kaia'))) {
    try {
      const body = await response.json();
      console.log(`[API] ${url.slice(0, 100)}`);
      apiResponses.push({ url, body });
    } catch {}
  }
});

// Load departures (tab=0)
console.log('Loading Jeddah departures...');
await page.goto('https://www.kaia.sa/en/Flights?tab=0', { 
  waitUntil: 'networkidle', timeout: 60000 
}).catch(e => console.log('err:', e.message));
await page.waitForTimeout(5000);

// Try to select yesterday
const yesterdayBtn = await page.$('button:has-text("Yesterday"), [data-date*="yesterday"], .date-picker button');
if (yesterdayBtn) {
  console.log('Clicking yesterday...');
  await yesterdayBtn.click().catch(() => {});
  await page.waitForTimeout(3000);
}

// Scroll to load all
for (let i = 0; i < 15; i++) {
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(400);
}

const depRows = await page.evaluate(() => {
  const els = [...document.querySelectorAll('tr, [class*="flight"], [class*="row"], table tbody tr')];
  return els.map(e => e.innerText?.trim()).filter(t => t && t.match(/\b[A-Z]{2}\d{1,4}\b/) && t.length < 500);
});
console.log(`Departure rows: ${depRows.length}`);

// Load arrivals (tab=1)
console.log('Loading Jeddah arrivals...');
await page.goto('https://www.kaia.sa/en/Flights?tab=1', { 
  waitUntil: 'networkidle', timeout: 60000 
}).catch(e => console.log('err:', e.message));
await page.waitForTimeout(5000);

for (let i = 0; i < 15; i++) {
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(400);
}

const arrRows = await page.evaluate(() => {
  const els = [...document.querySelectorAll('tr, [class*="flight"], [class*="row"], table tbody tr')];
  return els.map(e => e.innerText?.trim()).filter(t => t && t.match(/\b[A-Z]{2}\d{1,4}\b/) && t.length < 500);
});
console.log(`Arrival rows: ${arrRows.length}`);

// Extract flight numbers
const allText = [...depRows, ...arrRows].join('\n');
const flightNumbers = [...new Set((allText.match(/\b[A-Z]{2}\d{1,4}\b/g) || []))].sort();

const result = {
  source: 'kaia.sa',
  scrapedAt: new Date().toISOString(),
  departureRows: depRows.length,
  arrivalRows: arrRows.length,
  uniqueFlightNumbers: flightNumbers.length,
  flightNumbers,
  departureTexts: depRows.slice(0, 200),
  arrivalTexts: arrRows.slice(0, 200),
  apiEndpoints: apiResponses.map(r => ({ url: r.url })),
  apiData: apiResponses,
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nSaved to: ${OUT}`);
console.log(`Deps: ${depRows.length}, Arrs: ${arrRows.length}, Unique flights: ${flightNumbers.length}`);

await browser.close();
