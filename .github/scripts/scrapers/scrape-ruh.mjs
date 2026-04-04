#!/usr/bin/env node
import { createStealthBrowser, scrollToLoadAll, runScraper, getYesterday } from '../lib/browser-utils.mjs';
import { updateHealth } from '../lib/health-writer.mjs';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const VERIFY_DIR = join(REPO_ROOT, 'public/verification');
mkdirSync(VERIFY_DIR, { recursive: true });

async function scrapeRUH() {
  const { browser, context } = await createStealthBrowser({
    launchOptions: {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    }
  });
  const page = await context.newPage();
  const dateStr = getYesterday();
  let total = 0;

  try {
    console.log('[RUH] Loading flights page...');
    await page.goto('https://www.riyadhairports.com/en/flights', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Wait for Cloudflare to resolve
    await page.waitForTimeout(10000);

    // Check if we hit a challenge page
    const isChallenged = await page.evaluate(() => {
      return document.body.innerText.includes('Checking your browser') ||
             document.body.innerText.includes('Just a moment');
    });

    if (isChallenged) {
      console.log('[RUH] Cloudflare challenge detected, waiting longer...');
      await page.waitForTimeout(15000);

      // Re-check
      const stillChallenged = await page.evaluate(() => {
        return document.body.innerText.includes('Checking your browser') ||
               document.body.innerText.includes('Just a moment');
      });

      if (stillChallenged) {
        throw new Error('Cloudflare challenge not resolved after waiting');
      }
    }

    await scrollToLoadAll(page, { scrollCount: 15, delay: 500 });

    // Scrape flight rows
    const rows = await page.evaluate(() => {
      return [...document.querySelectorAll('[class*="flight"], tr, [class*="row"], [class*="item"]')]
        .map(el => el.innerText?.trim())
        .filter(t => t && /\b[A-Z]{2}\d{1,4}\b/.test(t) && t.length < 500);
    });

    total = rows.length;

    const result = {
      date: dateStr,
      total,
      source: 'riyadhairports.com',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      cloudflareDetected: isChallenged,
      success: total > 0
    };

    // Save verification log
    const logFile = join(VERIFY_DIR, 'flight-log-RUH.json');
    let log = { airport: 'RUH', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(result);
    log.entries.sort((a, b) => a.date.localeCompare(b.date));
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    if (total > 0) {
      updateHealth('flight_ruh', {
        newValue: String(total),
        method: 'playwright',
        sourceUrl: 'riyadhairports.com'
      });
    }

    console.log(`[RUH] ${total} flights`);
    return result;

  } catch (err) {
    const failLog = {
      date: dateStr,
      error: err.message,
      source: 'riyadhairports.com',
      method: 'playwright',
      fetchedAt: new Date().toISOString(),
      success: false
    };
    const logFile = join(VERIFY_DIR, 'flight-log-RUH.json');
    let log = { airport: 'RUH', entries: [] };
    try { log = JSON.parse(readFileSync(logFile, 'utf8')); } catch {}
    log.entries = log.entries.filter(e => e.date !== dateStr);
    log.entries.push(failLog);
    log.lastUpdated = new Date().toISOString();
    writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

    console.error('[RUH] Scrape failed:', err.message);
    return null;
  } finally {
    await browser.close();
  }
}

runScraper('RUH', scrapeRUH).catch(console.error);
