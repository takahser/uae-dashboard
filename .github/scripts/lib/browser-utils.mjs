import { chromium } from 'playwright';

export const STEALTH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function createStealthBrowser(opts = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
    ...opts.launchOptions
  });

  const context = await browser.newContext({
    userAgent: opts.userAgent || STEALTH_UA,
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'Asia/Dubai',
    ...opts.contextOptions
  });

  // Hide automation indicators
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  return { browser, context };
}

export async function scrollToLoadAll(page, { scrollCount = 15, delay = 400 } = {}) {
  for (let i = 0; i < scrollCount; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(delay);
  }
}

export async function interceptJSON(page, patterns = ['api', 'flight', 'fids']) {
  const responses = [];
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && patterns.some(p => url.includes(p))) {
      try {
        const body = await response.json();
        responses.push({ url, body });
      } catch {}
    }
  });
  return responses;
}

export function extractFlightNumbers(text) {
  return [...new Set((text.match(/\b[A-Z]{2}\d{1,4}\b/g) || []))].sort();
}

export async function runScraper(name, fn) {
  const MAX_RETRIES = 2;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[${name}] Attempt ${attempt}/${MAX_RETRIES}`);
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`[${name}] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 5000 * attempt));
      }
    }
  }

  console.error(`[${name}] All attempts failed. Last error: ${lastError.message}`);
  return null;
}

export function getYesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}
