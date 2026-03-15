/**
 * One-time X session setup.
 * Opens a real browser window — log in to @ww3_live manually, then press Enter in the terminal.
 * Saves cookies to .github/scripts/x-session.json for use by the scraper.
 *
 * Usage: node .github/scripts/setup-x-session.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SESSION_FILE = path.join(__dirname, 'x-session.json');

async function main() {
  console.log('\n🔐 X Session Setup for ww3live.xyz scraper\n');
  console.log('This will open a real browser window.');
  console.log('Log in to @ww3_live manually, then come back here and press Enter.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });

  console.log('Browser opened. Log in to @ww3_live now.');
  console.log('Once you are fully logged in and can see your timeline,');
  console.log('press Enter here to save the session...\n');

  await waitForEnter();

  // Save cookies + storage state
  const storageState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState, null, 2));

  console.log(`\n✅ Session saved to ${SESSION_FILE}`);
  console.log('The scraper will now use this session automatically.\n');

  await browser.close();
}

function waitForEnter() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter when logged in → ', () => { rl.close(); resolve(); });
  });
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
