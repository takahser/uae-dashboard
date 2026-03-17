#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import { generateInfographic } from './generate-infographic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../public');
const WAR_START = new Date('2026-02-28');
const DRY_RUN = process.argv.includes('--dry-run');

// --- Config ---
let TELEGRAM_TOKEN = null;
const TELEGRAM_CHAT_ID = '19362727';

try {
  const config = JSON.parse(readFileSync(resolve(process.env.HOME, '.openclaw/openclaw.json'), 'utf8'));
  TELEGRAM_TOKEN = config?.telegram?.botToken;
} catch { /* will print to stdout instead */ }

// --- Data loading ---
const COUNTRIES = ['uae', 'kuwait', 'qatar', 'bahrain', 'oman', 'israel', 'saudi', 'iran'];
const FLAGS = {
  uae: '🇦🇪', kuwait: '🇰🇼', qatar: '🇶🇦', bahrain: '🇧🇭',
  oman: '🇴🇲', israel: '🇮🇱', saudi: '🇸🇦', iran: '🇮🇷'
};
const NAMES = {
  uae: 'UAE', kuwait: 'Kuwait', qatar: 'Qatar', bahrain: 'Bahrain',
  oman: 'Oman', israel: 'Israel', saudi: 'Saudi Arabia', iran: 'Iran'
};

const GCC = ['uae', 'kuwait', 'qatar', 'bahrain', 'oman'];

function loadData(country) {
  try {
    return JSON.parse(readFileSync(resolve(DATA_DIR, `data-${country}.json`), 'utf8'));
  } catch { return null; }
}

function getDayN() {
  return Math.floor((new Date() - WAR_START) / (1000 * 60 * 60 * 24));
}

function getTotalDetected(c) {
  return (c.ballisticDetected || 0) + (c.cruiseDetected || 0) + (c.dronesDetected || 0);
}

function getTotalIntercepted(c) {
  return (c.ballisticIntercepted || 0) + (c.cruiseIntercepted || 0) + (c.dronesIntercepted || 0);
}

function getRate(c) {
  const t = getTotalDetected(c);
  const i = getTotalIntercepted(c);
  if (t === 0) return null;
  return ((i / t) * 100).toFixed(1);
}

// --- Tweet generators ---

function generateDailySummary() {
  // Pick a GCC country with good data
  const candidates = GCC.filter(c => {
    const d = loadData(c);
    return d?.cumulative && getTotalDetected(d.cumulative) > 0;
  });
  if (candidates.length === 0) return null;
  const country = candidates[Math.floor(Math.random() * candidates.length)];
  const data = loadData(country);
  const c = data.cumulative;
  const dayN = getDayN();
  const detected = getTotalDetected(c);
  const intercepted = getTotalIntercepted(c);
  const rate = getRate(c);
  const killed = c.killed || 0;
  const injured = c.injured || 0;

  const text = `Day ${dayN} of the Iran-GCC war.

${FLAGS[country]} ${NAMES[country]} update:
• ${detected} threats detected
• ${intercepted} intercepted (${rate}% success rate)
• ${killed} killed, ${injured} injured

Live tracker: ww3live.xyz
#IranWar #GCC #${NAMES[country].replace(/\s/g, '')}`;

  return { text, type: 'daily-summary', country, infographicType: 'stat-card' };
}

function generateCountrySpotlight() {
  const candidates = GCC.filter(c => {
    const d = loadData(c);
    return d?.cumulative && getTotalDetected(d.cumulative) > 0;
  });
  if (candidates.length === 0) return null;
  const country = candidates[Math.floor(Math.random() * candidates.length)];
  const data = loadData(country);
  const c = data.cumulative;
  const dayN = getDayN();
  const detected = getTotalDetected(c);
  const intercepted = getTotalIntercepted(c);
  const hoursPerIntercept = ((dayN * 24) / intercepted).toFixed(1);

  const text = `${FLAGS[country]} ${NAMES[country]} has intercepted ${intercepted} projectiles since Feb 28 — that's one every ${hoursPerIntercept} hours on average.

Air defenses working overtime.

Full data: ww3live.xyz
#${NAMES[country].replace(/\s/g, '')} #IranWar`;

  return { text, type: 'country-spotlight', country, infographicType: 'stat-card' };
}

function generateComparativeInsight() {
  const rows = [];
  for (const c of GCC) {
    const data = loadData(c);
    if (!data?.cumulative) continue;
    const rate = getRate(data.cumulative);
    if (rate !== null) {
      rows.push({ country: c, rate: parseFloat(rate) });
    }
  }
  if (rows.length < 2) return null;
  rows.sort((a, b) => b.rate - a.rate);

  const lines = rows.map(r => `${FLAGS[r.country]} ${NAMES[r.country]}: ${r.rate}%`).join('\n');

  const text = `Iran-GCC war interception rates:

${lines}

85%+ is considered world-class.

ww3live.xyz
#AirDefense #IranWar`;

  return { text, type: 'comparative', country: null, infographicType: 'country-comparison' };
}

function generateHormuzAlert() {
  const text = `HORMUZ WATCH: The Strait of Hormuz remains under heightened alert.

20% of global oil passes through here daily. Every day of disruption adds pressure on energy markets.

Live maritime tracker: ww3live.xyz
#Hormuz #OilMarket #IranWar`;

  return { text, type: 'hormuz', country: null, infographicType: null };
}

function generateMilestoneAlert() {
  const milestones = [100, 250, 500, 750, 1000, 1500, 2000];
  for (const c of GCC) {
    const data = loadData(c);
    if (!data?.cumulative) continue;
    const detected = getTotalDetected(data.cumulative);
    // Find the highest milestone crossed
    const crossed = milestones.filter(m => detected >= m);
    if (crossed.length === 0) continue;
    const milestone = crossed[crossed.length - 1];
    // Only alert if close to the milestone (within 10%)
    if (detected > milestone * 1.1) continue;

    const text = `${FLAGS[c]} MILESTONE: ${NAMES[c]} has now detected over ${milestone} incoming threats since the Iran-GCC war began on Feb 28.

${detected} total threats tracked and counting.

Live data: ww3live.xyz
#${NAMES[c].replace(/\s/g, '')} #IranWar`;

    return { text, type: 'milestone', country: c, infographicType: 'stat-card' };
  }
  return null;
}

// --- Main ---
const GENERATORS = [
  generateDailySummary,
  generateCountrySpotlight,
  generateComparativeInsight,
  generateHormuzAlert,
  generateMilestoneAlert,
];

async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || DRY_RUN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  });
}

async function sendTelegramPhoto(photoPath, caption) {
  if (!TELEGRAM_TOKEN || DRY_RUN) return;
  const { FormData, Blob } = await import('node-fetch');
  const fileData = readFileSync(photoPath);
  const form = new FormData();
  form.append('chat_id', TELEGRAM_CHAT_ID);
  form.append('photo', new Blob([fileData]), 'infographic.png');
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
    method: 'POST',
    body: form,
  });
}

async function main() {
  const dayN = getDayN();
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n=== ww3live.xyz Tweet Generator — Day ${dayN} (${today}) ===\n`);

  // Pick 2-3 different tweet types based on day rotation
  const dayIndex = dayN % GENERATORS.length;
  const picked = new Set();
  const drafts = [];

  // Always pick based on day rotation, then add one more random
  const indices = [dayIndex, (dayIndex + 1) % GENERATORS.length];
  // Occasionally add a third
  if (dayN % 3 === 0) {
    indices.push((dayIndex + 2) % GENERATORS.length);
  }

  for (const idx of indices) {
    if (picked.has(idx)) continue;
    picked.add(idx);
    const draft = GENERATORS[idx]();
    if (draft) drafts.push(draft);
  }

  if (drafts.length === 0) {
    console.log('No drafts could be generated (missing data?)');
    return;
  }

  // Enforce 280 char limit
  for (const draft of drafts) {
    if (draft.text.length > 280) {
      // Truncate intelligently — cut before the hashtags if needed
      const hashIdx = draft.text.lastIndexOf('\n#');
      if (hashIdx > 0 && hashIdx < 280) {
        draft.text = draft.text.slice(0, 280);
      } else {
        draft.text = draft.text.slice(0, 277) + '...';
      }
    }
  }

  // Generate infographics
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    if (draft.infographicType) {
      const outputPath = DRY_RUN
        ? `/tmp/test-infographic-${draft.infographicType}.png`
        : `/tmp/infographic-${today}-${i}.png`;
      try {
        await generateInfographic({
          type: draft.infographicType,
          country: draft.country || 'uae',
          output: outputPath,
        });
        draft.imagePath = outputPath;
      } catch (err) {
        console.error(`Infographic generation failed for draft ${i + 1}:`, err.message);
      }
    }
  }

  // Output drafts
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const num = i + 1;
    console.log(`\n--- DRAFT #${num} (${draft.type}) ---`);
    console.log(`Characters: ${draft.text.length}/280`);
    console.log(draft.text);
    if (draft.imagePath) console.log(`Infographic: ${draft.imagePath}`);
    console.log('---\n');

    // Send to Telegram
    if (!DRY_RUN && TELEGRAM_TOKEN) {
      const caption = `🗞️ DRAFT TWEET #${num}\n\n${draft.text}\n\nReply /approve${num} to post or /reject${num} to skip.`;
      if (draft.imagePath) {
        await sendTelegramPhoto(draft.imagePath, caption);
      } else {
        await sendTelegramMessage(caption);
      }
    }
  }

  // Save drafts to file
  const draftsFile = `/tmp/tweet-drafts-${today}.json`;
  writeFileSync(draftsFile, JSON.stringify(drafts, null, 2));
  console.log(`Drafts saved to ${draftsFile}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No messages sent to Telegram.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
