#!/usr/bin/env node
/**
 * Grok Data Accuracy Reviewer (Playwright / in-browser Grok)
 * Uses @open_gav session at x.com/i/grok — NO API key needed.
 * Called by .github/workflows/grok-data-review.yml
 * IMPORTANT: Always uses @open_gav session — NEVER @ww3_live
 */

import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY;
const LLM_SESSION_B64 = process.env.LLM_SESSION; // base64-encoded x-session.json

// Data files that warrant Grok review
const DATA_FILES = [
  'public/data-uae.json',
  'public/data-market.json',
  'public/data-bonds.json',
  'public/data-substitution.json',
  'src/data/energy-attacks.json',
  'src/data/electrical-threats.json',
  'src/data/hormuz.json',
];

if (!LLM_SESSION_B64) {
  console.log('LLM_SESSION not set — skipping Grok review');
  process.exit(0);
}

function getDiff() {
  try {
    return execSync('git diff HEAD~1 HEAD -- ' + DATA_FILES.join(' '), {
      encoding: 'utf8', maxBuffer: 50 * 1024,
    }).trim();
  } catch { return ''; }
}

async function askGrok(diff) {
  // Restore session from base64 secret
  const sessionPath = join(tmpdir(), 'open-gav-session.json');
  writeFileSync(sessionPath, Buffer.from(LLM_SESSION_B64, 'base64').toString('utf8'));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: sessionPath });
  const page = await ctx.newPage();

  const prompt = `You are reviewing a GitHub PR for a conflict tracking dashboard (ww3live.xyz) covering the Iran-UAE war starting Feb 28 2026.

Check this diff for DATA ACCURACY only:
1. Attack numbers (ballistic, cruise, UAVs) — match @modgovae official statements?
2. Cumulative totals — add up correctly from daily data?
3. Coordinates for attack sites — geographically plausible?
4. Energy/market figures — match known benchmarks?

Reply with exactly one of:
PASS: [brief summary]
FLAGGED: [specific data point and what the correct value should be]
UNVERIFIED: [data point that cannot be independently verified]

Diff:
${diff.slice(0, 3000)}`;

  try {
    await page.goto('https://x.com/i/grok', { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(3000);

    // Type prompt into Grok input
    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.click();
    await input.fill(prompt);
    await page.keyboard.press('Enter');

    // Wait for response (up to 60s)
    await page.waitForTimeout(8000);
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(5000);
      const text = await page.evaluate(() => {
        const msgs = document.querySelectorAll('[data-testid="grok-message"]');
        return msgs.length ? msgs[msgs.length - 1].innerText : '';
      });
      if (text && (text.startsWith('PASS') || text.startsWith('FLAGGED') || text.startsWith('UNVERIFIED'))) {
        return text.trim();
      }
    }

    // Fallback: grab whatever Grok said
    const fallback = await page.evaluate(() => {
      const msgs = document.querySelectorAll('[data-testid="grok-message"]');
      return msgs.length ? msgs[msgs.length - 1].innerText.slice(0, 500) : 'No response';
    });
    return fallback || 'Grok did not respond in time';
  } finally {
    await browser.close();
  }
}

async function postComment(verdict) {
  const badge = verdict.startsWith('PASS') ? '✅' :
                verdict.startsWith('FLAGGED') ? '🚨' : '⚠️';

  const body = `## ${badge} Grok Data Review

${verdict}

---
*Reviewed via [Grok](https://x.com/i/grok) (in-browser) | Data files: \`${DATA_FILES.slice(0,3).join('`, `')}\` + more*`;

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const c = await res.json();
  console.log('Posted comment:', c.html_url);
}

async function main() {
  console.log('Running Grok data review (Playwright / @open_gav)...');
  const diff = getDiff();
  if (!diff) { console.log('No data file changes — skipping'); process.exit(0); }

  console.log(`Diff: ${diff.length} chars → sending to Grok...`);
  try {
    const verdict = await askGrok(diff);
    console.log('Verdict:', verdict.slice(0, 80));
    await postComment(verdict);
  } catch (e) {
    console.error('Grok review failed:', e.message);
    process.exit(0); // advisory only — never fail CI
  }
}

main();
