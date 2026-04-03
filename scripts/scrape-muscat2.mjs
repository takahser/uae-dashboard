import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = '/Users/chou/.openclaw/workspace/muscat-flights.json';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
});
const page = await context.newPage();

const apiResponses = [];
page.on('response', async (response) => {
  const url = response.url();
  const ct = response.headers()['content-type'] || '';
  if (ct.includes('json') && !url.includes('google')) {
    try {
      const body = await response.json();
      console.log(`[API] ${url.slice(0, 100)}`);
      apiResponses.push({ url, body });
    } catch {}
  }
});

// Departures
console.log('Loading Muscat departures...');
await page.goto('https://www.muscatairport.co.om/en/flight-status?type=2', { 
  waitUntil: 'networkidle', timeout: 60000 
}).catch(e => console.log('err:', e.message));
await page.waitForTimeout(5000);

// Scroll and load more
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(300);
  const loadMore = await page.$('button:has-text("Load"), a:has-text("More"), [class*="load-more"]');
  if (loadMore) { await loadMore.click().catch(() => {}); await page.waitForTimeout(1000); }
}

const depRows = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[class*="flight"], tr, [class*="row"], [class*="card"]')];
  return els.map(e => e.innerText?.trim()).filter(t => t && t.match(/\b(WY|OV|SV|EK|QR|GF|FZ|AI|9W|UK|6E)\d{1,4}\b/) && t.length < 400);
});
console.log(`Departure rows: ${depRows.length}`);

// Arrivals
console.log('Loading Muscat arrivals...');
await page.goto('https://www.muscatairport.co.om/en/flight-status?type=1', { 
  waitUntil: 'networkidle', timeout: 60000 
}).catch(e => console.log('err:', e.message));
await page.waitForTimeout(5000);

for (let i = 0; i < 20; i++) {
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(300);
}

const arrRows = await page.evaluate(() => {
  const els = [...document.querySelectorAll('[class*="flight"], tr, [class*="row"], [class*="card"]')];
  return els.map(e => e.innerText?.trim()).filter(t => t && t.match(/\b(WY|OV|SV|EK|QR|GF|FZ|AI|9W|UK|6E)\d{1,4}\b/) && t.length < 400);
});
console.log(`Arrival rows: ${arrRows.length}`);

// Extract flight numbers
const allText = [...depRows, ...arrRows].join('\n');
const flightNumbers = [...new Set((allText.match(/\b[A-Z]{2}\d{1,4}\b/g) || []))].sort();

const result = {
  source: 'muscatairport.co.om',
  scrapedAt: new Date().toISOString(),
  departureRows: depRows.length,
  arrivalRows: arrRows.length,
  uniqueFlightNumbers: flightNumbers.length,
  flightNumbers,
  departureTexts: depRows.slice(0, 200),
  arrivalTexts: arrRows.slice(0, 200),
  apiData: apiResponses,
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nSaved to: ${OUT}`);
console.log(`Deps: ${depRows.length}, Arrs: ${arrRows.length}, Unique flights: ${flightNumbers.length}`);

await browser.close();
