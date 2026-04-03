import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const URL = 'https://dubaiairports.ae/flight-status?type=departures&from=2026-04-02';
const OUT = '/Users/chou/.openclaw/workspace/dxb-apr2-departures.json';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
const page = await context.newPage();

// Intercept all API/XHR responses
const apiResponses = [];
page.on('response', async (response) => {
  const url = response.url();
  const ct = response.headers()['content-type'] || '';
  if ((url.includes('api') || url.includes('flight') || url.includes('fids')) && ct.includes('json')) {
    try {
      const body = await response.json();
      console.log(`[API] ${url.slice(0, 100)}`);
      apiResponses.push({ url, body });
    } catch {}
  }
});

console.log('Loading page...');
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => console.log('goto err:', e.message));
await page.waitForTimeout(8000);

// Also try scrolling to trigger lazy loads
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(1000);
}

// Try to extract visible flight data from DOM
const flights = await page.evaluate(() => {
  // Look for any element containing flight-like content
  const all = [...document.querySelectorAll('*')];
  const flightEls = all.filter(el => {
    const txt = el.innerText || '';
    return txt.match(/\b[A-Z]{2}\d{1,4}\b/) && el.children.length < 20 && txt.length < 500;
  });
  return flightEls.map(el => ({
    tag: el.tagName,
    class: el.className?.toString().slice(0, 50),
    text: el.innerText?.trim().slice(0, 200),
  })).filter(f => f.text?.length > 5);
});

console.log(`\nAPI responses captured: ${apiResponses.length}`);
console.log(`Flight-like DOM elements: ${flights.length}`);

// Find unique flight numbers
const allText = flights.map(f => f.text).join('\n');
const flightNumbers = [...new Set((allText.match(/\b[A-Z]{2}\d{1,4}\b/g) || []))].sort();
console.log(`Unique flight numbers: ${flightNumbers.length}`);
if (flightNumbers.length > 0) console.log('Sample:', flightNumbers.slice(0, 10).join(', '));

// API endpoint discovery
if (apiResponses.length > 0) {
  console.log('\nAPI endpoints found:');
  apiResponses.forEach(r => console.log(' -', r.url));
}

const result = {
  url: URL,
  scrapedAt: new Date().toISOString(),
  uniqueFlightNumbers: flightNumbers.length,
  flightNumbers,
  flightDOMElements: flights.slice(0, 500),
  apiEndpoints: apiResponses.map(r => ({ url: r.url, sampleKeys: Object.keys(r.body || {}).slice(0, 10) })),
  apiData: apiResponses,
};

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`\nSaved to: ${OUT}`);

await browser.close();
