import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = '/Users/chou/.openclaw/workspace/muscat-flights.json';

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
  if ((url.includes('api') || url.includes('flight') || url.includes('fids') || url.includes('schedule')) && ct.includes('json')) {
    try {
      const body = await response.json();
      console.log(`[API] ${url.slice(0, 120)}`);
      apiResponses.push({ url, body });
    } catch {}
  }
});

console.log('Loading Muscat airport...');
await page.goto('https://www.muscatairport.co.om/', { 
  waitUntil: 'domcontentloaded', timeout: 45000 
}).catch(e => console.log('goto err:', e.message));
await page.waitForTimeout(5000);

// Look for flight status link
const flightLinks = await page.$$eval('a', els => 
  els.filter(a => (a.href + a.innerText).toLowerCase().match(/flight|departure|arrival|schedule/))
    .map(a => ({ href: a.href, text: a.innerText.trim().slice(0, 50) }))
);
console.log('Flight-related links:', flightLinks.slice(0, 10));

// Try to find and click on flight status
const flightStatusLink = await page.$('a[href*="flight"], a:has-text("Flight"), a:has-text("Departure"), a:has-text("Arrival")');
if (flightStatusLink) {
  console.log('Found flight status link, clicking...');
  await flightStatusLink.click().catch(() => {});
  await page.waitForTimeout(5000);
}

// Try common flight status URLs
const urls = [
  'https://www.muscatairport.co.om/flight-status',
  'https://www.muscatairport.co.om/flights',
  'https://www.muscatairport.co.om/departures',
  'https://www.muscatairport.co.om/en/flight-information',
];

let flightData = [];
for (const url of urls) {
  console.log(`Trying ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  
  const rows = await page.evaluate(() => {
    const els = [...document.querySelectorAll('tr, [class*="flight"], [class*="row"], table')];
    return els.map(r => r.innerText?.trim()).filter(t => t && t.match(/\b[A-Z]{2}\d{1,4}\b/) && t.length < 500);
  });
  
  if (rows.length > flightData.length) {
    flightData = rows;
    console.log(`Found ${rows.length} flight rows at ${url}`);
  }
}

// Also try scrolling the main page
await page.goto('https://www.muscatairport.co.om/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await page.waitForTimeout(5000);

for (let i = 0; i < 15; i++) {
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(400);
}

const allFlights = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')];
  return all.filter(el => {
    const txt = el.innerText || '';
    return txt.match(/\b(WY|OV|SV|EK|QR|GF|FZ)\d{1,4}\b/) && el.children.length < 10 && txt.length < 300;
  }).map(el => el.innerText.trim());
});

if (allFlights.length > flightData.length) flightData = allFlights;

const flightNumbers = [...new Set((flightData.join('\n').match(/\b[A-Z]{2}\d{1,4}\b/g) || []))].sort();

const result = {
  source: 'muscatairport.co.om',
  scrapedAt: new Date().toISOString(),
  flightRowsFound: flightData.length,
  uniqueFlightNumbers: flightNumbers.length,
  flightNumbers,
  flightTexts: flightData.slice(0, 200),
  apiEndpoints: apiResponses.map(r => ({ url: r.url })),
  apiData: apiResponses,
  flightLinks,
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nSaved to: ${OUT}`);
console.log(`Flight rows: ${flightData.length}, Unique flights: ${flightNumbers.length}`);

await browser.close();
