#!/usr/bin/env node
/**
 * morning-briefing.mjs
 *
 * Daily 08:00 local-time briefing for Seraya, delivered via Telegram
 * through the OpenClaw agent cron (--announce flag).
 *
 * Usage:
 *   BRIEFING_TZ=Asia/Dubai node scripts/morning-briefing.mjs
 *
 * OpenClaw cron (Dubai):
 *   openclaw cron add --name "morning-briefing" --cron "0 4 * * *" --exact \
 *     --message "Run: BRIEFING_TZ=Asia/Dubai node /Users/chou/repos/uae-dashboard/scripts/morning-briefing.mjs && [print stdout to Telegram]"
 *
 * Spec: tasks/spec-morning-briefing.md
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ─── Config ──────────────────────────────────────────────────────────────────

const ALLOWED_TZ = ['Asia/Dubai', 'Europe/Zurich', 'Asia/Bangkok'];
const rawTz = process.env.BRIEFING_TZ || 'Asia/Dubai';
const TZ = ALLOWED_TZ.includes(rawTz) ? rawTz : (() => {
  console.error(`[briefing] Unknown BRIEFING_TZ "${rawTz}", falling back to Asia/Dubai`);
  return 'Asia/Dubai';
})();

const KB_DB = process.env.KB_DB || '/Users/chou/repos/xpost-automation/memory/kb.db';
const CLUSTERS_JSON = '/Users/chou/repos/xpost-automation/memory/talking-point-clusters.json';
const TWEET_CACHE_DIR = join(REPO_ROOT, '.github/scripts/tweet-cache');
const HEALTH_DIR = join(REPO_ROOT, 'public/health');

// ─── Window helpers ───────────────────────────────────────────────────────────

/** Get local year/month/day in a given timezone for a Date */
function localParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  return parts;
}

/** Get timezone abbreviation (e.g. GST, CET, ICT) */
function tzAbbr(tz) {
  // 'shortOffset' gives GMT+4 style; try 'short' first for named abbrs
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' });
    const abbr = fmt.formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';
    // Named abbreviations don't contain '+' or '-'
    if (abbr && !abbr.includes('+') && !abbr.includes('-')) return abbr;
  } catch {}
  // Fallback: derive from tz string
  const map = { 'Asia/Dubai': 'GST', 'Europe/Zurich': 'CET', 'Asia/Bangkok': 'ICT' };
  return map[tz] || tz;
}

/** Return [startUtc, endUtc] for local midnight..midnight in tz at dayOffset (0=today, -1=yesterday) */
function localDayBounds(tz, dayOffset = 0) {
  const now = new Date();
  const parts = localParts(now, tz);
  // Build midnight in that timezone using Date.parse of a local-looking string
  const localMidnight = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
  // Adjust for the timezone offset: get the UTC time that corresponds to this local midnight
  const tzOffset = (now.getTime() - Date.parse(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(now).replace(', ', 'T'))) || 0;

  // Simpler approach: find UTC for local midnight via iteration
  const todayLocal = `${parts.year}-${parts.month}-${parts.day}`;
  // Find UTC time where local date == todayLocal
  const base = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day),
    0, 0, 0
  ));
  // Offset correction: repeatedly check what local date 'base' maps to
  function toLocalMidnightUTC(localDateStr, tz) {
    const [y, m, d] = localDateStr.split('-').map(Number);
    // Try UTC midnight and adjust by tz offset
    const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    // Get what local time this UTC maps to
    const localHour = parseInt(new Intl.DateTimeFormat('en', {
      timeZone: tz, hour: '2-digit', hour12: false
    }).format(candidate));
    const tzOffsetHours = localHour; // hours ahead of UTC at local midnight
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetHours * 3600000);
  }

  // Get today's local date string
  const todayStr = `${parts.year}-${parts.month}-${parts.day}`;
  // Compute yesterday
  const dayBefore = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) + dayOffset,
    12, 0, 0 // noon to avoid DST weirdness
  ));
  const dayBeforeParts = localParts(dayBefore, tz);
  const dayBeforeStr = `${dayBeforeParts.year}-${dayBeforeParts.month}-${dayBeforeParts.day}`;

  const start = toLocalMidnightUTC(dayBeforeStr, tz);
  const tomorrow = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) + dayOffset + 1,
    12, 0, 0
  ));
  const tomorrowParts = localParts(tomorrow, tz);
  const tomorrowStr = `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}`;
  const end = toLocalMidnightUTC(tomorrowStr, tz);

  return [start, end];
}

/** Get [yesterdayStart, todayMorning8am] as the overnight window */
function overnightWindow(tz) {
  const now = new Date();
  const parts = localParts(now, tz);
  const todayStr = `${parts.year}-${parts.month}-${parts.day}`;

  const yesterdayDate = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) - 1,
    12, 0, 0
  ));
  const yParts = localParts(yesterdayDate, tz);
  const yesterdayStr = `${yParts.year}-${yParts.month}-${yParts.day}`;

  function toLocalMidnightUTC(localDateStr, tz) {
    const [y, m, d] = localDateStr.split('-').map(Number);
    const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const localHour = parseInt(new Intl.DateTimeFormat('en', {
      timeZone: tz, hour: '2-digit', hour12: false
    }).format(candidate));
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - localHour * 3600000);
  }

  const start = toLocalMidnightUTC(yesterdayStr, tz);
  // End at today 08:00 local
  const todayMidnight = toLocalMidnightUTC(todayStr, tz);
  const end = new Date(todayMidnight.getTime() + 8 * 3600000);

  return [start, end];
}

function withinWindow(isoOrDate, [start, end]) {
  const t = new Date(isoOrDate).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** Snowflake tweet ID → creation Date */
function snowflakeToDate(tweetId) {
  try {
    return new Date(Number(BigInt(tweetId) >> 22n) + 1288834974657);
  } catch {
    return null;
  }
}

// ─── Kimi LLM caller ─────────────────────────────────────────────────────────

function kimi(prompt) {
  const result = spawnSync('kimi', ['--print', '-p', prompt], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env },
  });
  if (result.status !== 0) throw new Error(`kimi exited ${result.status}: ${(result.stderr || '').slice(0, 200)}`);
  // Strip TextPart wire format if present
  const m = result.stdout.match(/TextPart\([\s\S]*?type='text',[\s\S]*?text='([\s\S]*?)'\s*\)/);
  return (m ? m[1] : result.stdout).trim();
}

// ─── Number formatting ────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return '?';
  return Number(n).toLocaleString('en-US');
}

function delta(a, b) {
  if (a == null || b == null) return '';
  const d = a - b;
  if (d === 0) return ' (no change)';
  return d > 0 ? ` (+${fmt(d)})` : ` (-${fmt(Math.abs(d))})`;
}

// ─── Data loaders ─────────────────────────────────────────────────────────────

const errors = [];

function safeLoad(name, fn) {
  try {
    return fn();
  } catch (err) {
    errors.push(`${name}: ${err.message}`);
    return null;
  }
}

function loadUaeAttacks() {
  return safeLoad('data-uae.json', () => {
    const p = join(REPO_ROOT, 'public/data-uae.json');
    const d = JSON.parse(readFileSync(p, 'utf8'));
    if (!Array.isArray(d.daily) || d.daily.length === 0) throw new Error('no daily[] array');
    return d;
  });
}

function loadFlights(iata) {
  return safeLoad(`data-flights-${iata}.json`, () => {
    const p = join(REPO_ROOT, `public/data-flights-${iata.toLowerCase()}.json`);
    if (!existsSync(p)) throw new Error('file not found');
    const d = JSON.parse(readFileSync(p, 'utf8'));
    if (!Array.isArray(d.daily) || d.daily.length === 0) throw new Error('no daily[] array');
    return d;
  });
}

function loadHealthSync() {
  return safeLoad('health/*.json', () => {
    const ls = spawnSync('ls', [HEALTH_DIR], { encoding: 'utf8' });
    const files = ls.stdout.trim().split('\n').filter(f => f.endsWith('.json'));
    const health = {};
    for (const f of files) {
      try {
        const d = JSON.parse(readFileSync(join(HEALTH_DIR, f), 'utf8'));
        health[f.replace('.json', '')] = d;
      } catch {}
    }
    return health;
  });
}

function loadMoDTweets(window) {
  return safeLoad('tweet-cache', () => {
    const countries = ['uae', 'bahrain', 'kuwait', 'qatar', 'saudi', 'israel', 'iran'];
    const all = [];
    for (const c of countries) {
      const p = join(TWEET_CACHE_DIR, `${c}.json`);
      if (!existsSync(p)) continue;
      try {
        const d = JSON.parse(readFileSync(p, 'utf8'));
        const filtered = (d.tweets || []).filter(t => withinWindow(t.time, window));
        for (const t of filtered) all.push({ ...t, country: c, account: d.account });
      } catch {}
    }
    all.sort((a, b) => new Date(b.time) - new Date(a.time));
    return all;
  });
}

function loadKbClusters(window) {
  return safeLoad('talking-point-clusters.json', () => {
    if (!existsSync(CLUSTERS_JSON)) throw new Error('file not found');
    const raw = JSON.parse(readFileSync(CLUSTERS_JSON, 'utf8'));
    const clusters = Array.isArray(raw) ? raw : Object.values(raw);
    const now = Date.now();
    const windowStart = window[0].getTime();
    const cutoff24h = now - 24 * 3600000;

    const spikes = [];
    for (const c of clusters) {
      if (c.verdict === 'defunct') continue;
      // Count tweet_ids whose snowflake time is within last 24h
      const recentCount = (c.tweet_ids || []).filter(id => {
        const d = snowflakeToDate(id);
        return d && d.getTime() >= cutoff24h;
      }).length;
      if (recentCount >= 3) {
        spikes.push({ talking_point: c.talking_point, recentCount });
      }
    }
    spikes.sort((a, b) => b.recentCount - a.recentCount);
    return spikes.slice(0, 3);
  });
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderHeader(tz) {
  const now = new Date();
  const parts = localParts(now, tz);
  const abbr = tzAbbr(tz);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(Date.UTC(parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day), 12));
  const dayName = dayNames[d.getUTCDay()];
  const monthName = monthNames[parseInt(parts.month) - 1];
  return `☀️ Morning briefing — ${dayName} ${monthName} ${parseInt(parts.day)}, 08:00 ${abbr}`;
}

function renderAttacks(tz) {
  const data = loadUaeAttacks();
  if (!data) return null;

  const daily = data.daily;
  if (daily.length < 1) return null;

  const last = daily[daily.length - 1];
  const prev = daily.length >= 2 ? daily[daily.length - 2] : null;

  // Check freshness: last entry should be yesterday in TZ
  const parts = localParts(new Date(), tz);
  const yesterdayDate = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) - 1, 12
  ));
  const yParts = localParts(yesterdayDate, tz);
  const yesterdayStr = `${yParts.year}-${yParts.month}-${yParts.day}`;

  // Allow data that's yesterday or today (scraper may have already run today)
  const twoDaysAgoDate = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) - 2, 12
  ));
  const tdParts = localParts(twoDaysAgoDate, tz);
  const twoDaysAgoStr = `${tdParts.year}-${tdParts.month}-${tdParts.day}`;
  if (last.date <= twoDaysAgoStr) {
    errors.push(`UAE attack data stale, last entry ${last.date}`);
    return null;
  }

  const lines = [];
  const ballistic = (last.ballisticIntercepted ?? last.ballisticDetected ?? 0);
  const prevBallistic = prev ? (prev.ballisticIntercepted ?? prev.ballisticDetected ?? 0) : null;
  const drones = (last.dronesIntercepted ?? last.dronesDetected ?? 0);
  const prevDrones = prev ? (prev.dronesIntercepted ?? prev.dronesDetected ?? 0) : null;
  const cruise = (last.cruiseIntercepted ?? last.cruiseDetected ?? 0);
  const prevCruise = prev ? (prev.cruiseIntercepted ?? prev.cruiseDetected ?? 0) : null;

  if (ballistic === 0 && drones === 0 && cruise === 0) return null;

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, m, d] = last.date.split('-');
  const dateLabel = `${monthNames[parseInt(m)-1]} ${parseInt(d)}`;

  lines.push(`🛡 UAE overnight (${dateLabel})`);
  if (ballistic > 0) {
    lines.push(`   Ballistic: ${fmt(ballistic)} intercepted${prevBallistic != null ? delta(ballistic, prevBallistic) + ' vs prior day' : ''}`);
  }
  if (cruise > 0) {
    lines.push(`   Cruise: ${fmt(cruise)} intercepted${prevCruise != null ? delta(cruise, prevCruise) + ' vs prior day' : ''}`);
  }
  if (drones > 0) {
    lines.push(`   Drones: ${fmt(drones)} intercepted${prevDrones != null ? delta(drones, prevDrones) + ' vs prior day' : ''}`);
  }

  // Cumulative from data.cumulative
  const cum = data.cumulative || {};
  const cumBallistic = cum.ballisticIntercepted ?? cum.ballisticDetected;
  const cumDrones = cum.dronesIntercepted ?? cum.dronesDetected;
  if (cumBallistic || cumDrones) {
    const cumParts = [];
    if (cumBallistic) cumParts.push(`${fmt(cumBallistic)} ballistic`);
    if (cumDrones) cumParts.push(`${fmt(cumDrones)} drones`);
    lines.push(`   Cumulative: ${cumParts.join(' / ')} since war start`);
  }

  return lines.join('\n');
}

function renderMoDTweets(window) {
  const tweets = loadMoDTweets(window);
  if (!tweets || tweets.length === 0) return null;

  const lines = [`📡 MoD posts overnight (${tweets.length})`];

  if (tweets.length <= 3) {
    for (const t of tweets) {
      const text = t.text.replace(/\n+/g, ' ').slice(0, 200);
      lines.push(`   ${t.account}: "${text}${t.text.length > 200 ? '…' : ''}"`);
    }
    return lines.join('\n');
  }

  // >3 tweets: summarise with Kimi
  try {
    const tweetList = tweets.slice(0, 20).map((t, i) =>
      `${i + 1}. ${t.account}: ${t.text.replace(/\n+/g, ' ').slice(0, 300)}`
    ).join('\n');

    const prompt = `You are summarizing overnight Middle East war updates from official MoD accounts. Output exactly 3 bullets, each one short factual sentence in present tense, no preamble, no headings, no emoji. Each bullet must name the source country/account.

Tweets:
${tweetList}`;

    const summary = kimi(prompt);
    const bullets = summary.split('\n').filter(l => l.trim()).slice(0, 3);
    for (const b of bullets) {
      lines.push(`   ${b.replace(/^[-•*]\s*/, '• ')}`);
    }
    return lines.join('\n');
  } catch (err) {
    // LLM fallback: show first 3 verbatim
    errors.push(`kimi MoD digest failed: ${err.message.slice(0, 100)}`);
    const fallbackLines = [`📡 MoD posts overnight (${tweets.length})`];
    for (const t of tweets.slice(0, 3)) {
      const text = t.text.replace(/\n+/g, ' ').slice(0, 200);
      fallbackLines.push(`   ${t.account}: "${text}${t.text.length > 200 ? '…' : ''}"`);
    }
    return fallbackLines.join('\n');
  }
}

function renderKbSpikes(window) {
  const spikes = loadKbClusters(window);
  if (!spikes || spikes.length === 0) return null;

  const lines = [`📈 KB topics spiking`];
  for (const s of spikes) {
    const label = s.talking_point.slice(0, 60);
    lines.push(`   • ${label} — ${s.recentCount} new tweets`);
  }
  return lines.join('\n');
}

function renderFlights(tz) {
  const airports = ['DXB', 'DOH', 'JED', 'AUH'];
  const parts = localParts(new Date(), tz);
  const yesterdayDate = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) - 1, 12
  ));
  const yParts = localParts(yesterdayDate, tz);
  const yesterdayStr = `${yParts.year}-${yParts.month}-${yParts.day}`;

  const lines = [];
  for (const iata of airports) {
    const data = loadFlights(iata);
    if (!data) continue;
    const daily = data.daily;
    if (daily.length < 1) continue;

    const last = daily[daily.length - 1];
    // Accept data that's yesterday or today (scraper may already have today's data)
    if (last.date < yesterdayStr) {
      errors.push(`flight_${iata.toLowerCase()}: last entry ${last.date}, expected ${yesterdayStr}`);
      continue;
    }
    const prev = daily.length >= 2 ? daily[daily.length - 2] : null;
    const d = delta(last.total, prev?.total);
    lines.push(`   ${iata}: ${fmt(last.total)}${d}`);
  }

  if (lines.length === 0) return null;
  return ['✈️ Yesterday\'s flights', ...lines].join('\n');
}

function renderCasualties(tz) {
  const data = loadUaeAttacks();
  if (!data) return null;
  const daily = data.daily;
  if (daily.length < 1) return null;

  const last = daily[daily.length - 1];
  const killed = last.killed || 0;
  const injured = last.injured || 0;
  if (killed === 0 && injured === 0) return null;

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, m, d] = last.date.split('-');
  const dateLabel = `${monthNames[parseInt(m)-1]} ${parseInt(d)}`;

  return `☹️ Casualties (${dateLabel}): ${fmt(killed)} killed, ${fmt(injured)} injured (UAE)`;
}

function renderAnomalies() {
  // Check health file staleness
  try {
    const lsResult = spawnSync('ls', [HEALTH_DIR], { encoding: 'utf8' });
    const files = lsResult.stdout.trim().split('\n').filter(f => f.endsWith('.json'));
    const now = Date.now();
    for (const f of files) {
      try {
        const d = JSON.parse(readFileSync(join(HEALTH_DIR, f), 'utf8'));
        if (!d.lastUpdated) continue; // skip health files without a timestamp
        const lastUpdated = new Date(d.lastUpdated).getTime();
        const staleHours = (now - lastUpdated) / 3600000;
        if (staleHours > 36) {
          errors.push(`${f.replace('.json', '')}: no update for ${Math.round(staleHours / 24)} days`);
        }
      } catch {}
    }
  } catch {}

  if (errors.length === 0) return null;
  const lines = ['⚠️ Data gaps'];
  for (const e of errors.slice(0, 5)) lines.push(`   • ${e}`);
  return lines.join('\n');
}

function renderFooter(tz) {
  const now = new Date();
  const parts = localParts(now, tz);
  const abbr = tzAbbr(tz);
  const ts = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${abbr}`;
  return `—\nGenerated ${ts} · BRIEFING_TZ=${tz}`;
}

// ─── Assembler ────────────────────────────────────────────────────────────────

function truncate(text, maxWords = 600) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  // Drop cluster spikes section first, then hard truncate
  const withoutSpikes = text.replace(/📈 KB topics spiking[\s\S]*?(\n\n|$)/, '\n\n').trim();
  const words2 = withoutSpikes.split(/\s+/);
  if (words2.length <= maxWords) return withoutSpikes;
  return words2.slice(0, maxWords).join(' ') + '…';
}

async function main() {
  const now = new Date();
  const overnight = overnightWindow(TZ);

  const sections = [
    renderHeader(TZ),
    renderAttacks(TZ),
    renderMoDTweets(overnight),
    renderKbSpikes(overnight),
    renderFlights(TZ),
    renderCasualties(TZ),
    renderAnomalies(),
    renderFooter(TZ),
  ];

  const body = sections
    .filter(s => s && s.trim())
    .join('\n\n');

  if (!body.trim() || body.trim() === renderHeader(TZ) + '\n\n' + renderFooter(TZ)) {
    // Only header + footer = nothing interesting happened
    process.exit(0);
  }

  const final = truncate(body);
  process.stdout.write(final + '\n');
}

main().catch(err => {
  console.error('[briefing] Fatal:', err);
  process.exit(1);
});
