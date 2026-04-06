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
 * Cron schedules (08:00 local):
 *   Asia/Dubai    → 0 4 * * *  (UTC+4, no DST)
 *   Asia/Bangkok  → 0 1 * * *  (UTC+7, no DST)
 *   Europe/Zurich → 0 7 * * *  (winter, UTC+1) / 0 6 * * * (summer, UTC+2)
 *
 * Spec: tasks/spec-morning-briefing.md
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ─── Config ───────────────────────────────────────────────────────────────────

const ALLOWED_TZ = ['Asia/Dubai', 'Europe/Zurich', 'Asia/Bangkok'];
const SETTINGS_FILE = '/Users/chou/repos/airbnb-manager/server/data/settings.json';

function loadTz() {
  // Priority: env var → settings file → default
  if (process.env.BRIEFING_TZ) {
    const tz = process.env.BRIEFING_TZ;
    if (ALLOWED_TZ.includes(tz)) return tz;
    console.error(`[briefing] Unknown BRIEFING_TZ env "${tz}", checking settings file`);
  }
  try {
    if (existsSync(SETTINGS_FILE)) {
      const s = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
      if (s.briefingTz && ALLOWED_TZ.includes(s.briefingTz)) return s.briefingTz;
    }
  } catch {}
  return 'Asia/Dubai';
}

const TZ = loadTz();

const CLUSTERS_JSON = '/Users/chou/repos/xpost-automation/memory/talking-point-clusters.json';
const TWEET_CACHE_DIR = join(REPO_ROOT, '.github/scripts/tweet-cache');
const HEALTH_DIR = join(REPO_ROOT, 'public/health');

// ─── Window helpers ───────────────────────────────────────────────────────────

/** Get local year/month/day/hour/minute in a given timezone for a Date */
export function localParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
}

/**
 * Given a local date string "YYYY-MM-DD" and a timezone, return the UTC Date
 * corresponding to local midnight (00:00:00) in that timezone.
 *
 * Strategy: start from UTC midnight of that calendar date, then check what
 * local hour that UTC time maps to, and subtract those hours. Works for any
 * timezone with a whole-hour offset (all three we support: UTC+4, UTC+7, UTC+1/+2).
 */
export function toLocalMidnightUTC(localDateStr, tz) {
  const [y, m, d] = localDateStr.split('-').map(Number);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // What local hour does UTC midnight correspond to in this TZ?
  const localHour = parseInt(
    new Intl.DateTimeFormat('en', { timeZone: tz, hour: '2-digit', hour12: false })
      .format(utcMidnight),
    10
  );
  // Subtract those hours to get the UTC time for local midnight
  return new Date(utcMidnight.getTime() - localHour * 3600_000);
}

/**
 * Return the "overnight" window: [yesterday 00:00, today 08:00) in local TZ.
 * Accepts an optional `now` for testability.
 */
export function overnightWindow(tz, now = new Date()) {
  const parts = localParts(now, tz);
  const todayStr = `${parts.year}-${parts.month}-${parts.day}`;

  // Yesterday date in local TZ (use noon UTC to avoid DST day-boundary issues)
  const yesterdayMid = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) - 1,
    12, 0, 0
  ));
  const yParts = localParts(yesterdayMid, tz);
  const yesterdayStr = `${yParts.year}-${yParts.month}-${yParts.day}`;

  const start = toLocalMidnightUTC(yesterdayStr, tz);
  const todayMidnight = toLocalMidnightUTC(todayStr, tz);
  const end = new Date(todayMidnight.getTime() + 8 * 3_600_000); // +8h = 08:00 local

  return [start, end];
}

/** True if an ISO timestamp (or Date) falls in [start, end). */
export function withinWindow(isoOrDate, [start, end]) {
  const t = new Date(isoOrDate).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** Twitter/X snowflake ID → creation Date */
function snowflakeToDate(tweetId) {
  try {
    return new Date(Number(BigInt(tweetId) >> 22n) + 1_288_834_974_657);
  } catch {
    return null;
  }
}

/** Timezone display abbreviation */
function tzAbbr(tz) {
  try {
    const abbr = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find(p => p.type === 'timeZoneName')?.value || '';
    if (abbr && !abbr.includes('+') && !abbr.includes('-')) return abbr;
  } catch {}
  return { 'Asia/Dubai': 'GST', 'Europe/Zurich': 'CET', 'Asia/Bangkok': 'ICT' }[tz] || tz;
}

// ─── Kimi LLM caller ─────────────────────────────────────────────────────────

function kimi(prompt) {
  const result = spawnSync('kimi', ['--print', '-p', prompt], {
    encoding: 'utf8', timeout: 60_000, env: { ...process.env },
  });
  if (result.status !== 0)
    throw new Error(`kimi exited ${result.status}: ${(result.stderr || '').slice(0, 200)}`);
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

/** YYYY-MM-DD for "yesterday" in a given timezone */
function yesterdayStr(tz, now = new Date()) {
  const parts = localParts(now, tz);
  const yMid = new Date(Date.UTC(
    parseInt(parts.year), parseInt(parts.month) - 1, parseInt(parts.day) - 1, 12
  ));
  const yp = localParts(yMid, tz);
  return `${yp.year}-${yp.month}-${yp.day}`;
}

// ─── Data loaders ─────────────────────────────────────────────────────────────

const errors = [];

function safeLoad(name, fn) {
  try { return fn(); }
  catch (err) { errors.push(`${name}: ${err.message}`); return null; }
}

function loadUaeAttacks() {
  return safeLoad('data-uae.json', () => {
    const d = JSON.parse(readFileSync(join(REPO_ROOT, 'public/data-uae.json'), 'utf8'));
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

function loadMoDTweets(window) {
  return safeLoad('tweet-cache', () => {
    const countries = ['uae', 'bahrain', 'kuwait', 'qatar', 'saudi', 'israel', 'iran'];
    const all = [];
    for (const c of countries) {
      const p = join(TWEET_CACHE_DIR, `${c}.json`);
      if (!existsSync(p)) continue;
      try {
        const d = JSON.parse(readFileSync(p, 'utf8'));
        for (const t of (d.tweets || []).filter(t => withinWindow(t.time, window))) {
          all.push({ ...t, country: c, account: d.account });
        }
      } catch {}
    }
    return all.sort((a, b) => new Date(b.time) - new Date(a.time));
  });
}

function loadKbClusters() {
  return safeLoad('talking-point-clusters.json', () => {
    if (!existsSync(CLUSTERS_JSON)) throw new Error('file not found');
    const raw = JSON.parse(readFileSync(CLUSTERS_JSON, 'utf8'));
    const clusters = Array.isArray(raw) ? raw : Object.values(raw);
    const cutoff24h = Date.now() - 24 * 3_600_000;

    const spikes = clusters
      .filter(c => c.verdict !== 'defunct')
      .map(c => ({
        talking_point: c.talking_point,
        recentCount: (c.tweet_ids || []).filter(id => {
          const d = snowflakeToDate(id);
          return d && d.getTime() >= cutoff24h;
        }).length,
      }))
      .filter(s => s.recentCount >= 3)
      .sort((a, b) => b.recentCount - a.recentCount)
      .slice(0, 3);

    return spikes;
  });
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderHeader(tz, now = new Date()) {
  const parts = localParts(now, tz);
  const abbr = tzAbbr(tz);
  const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // Use a noon-UTC date to get the right weekday regardless of TZ
  const d = new Date(Date.UTC(parseInt(parts.year), parseInt(parts.month)-1, parseInt(parts.day), 12));
  return `☀️ Morning briefing — ${DAY[d.getUTCDay()]} ${MON[parseInt(parts.month)-1]} ${parseInt(parts.day)}, 08:00 ${abbr}`;
}

function renderAttacks(tz, now = new Date()) {
  const data = loadUaeAttacks();
  if (!data) return null;
  const daily = data.daily;
  if (!daily.length) return null;

  const last = daily[daily.length - 1];
  const prev = daily.length >= 2 ? daily[daily.length - 2] : null;

  // Freshness: accept yesterday or today (scraper may have already run today).
  // Flag as stale only if data is 2+ days old.
  const yStr = yesterdayStr(tz, now);
  const parts = localParts(now, tz);
  const twoDaysAgoMid = new Date(Date.UTC(parseInt(parts.year), parseInt(parts.month)-1, parseInt(parts.day)-2, 12));
  const tdp = localParts(twoDaysAgoMid, tz);
  const twoDaysAgoStr = `${tdp.year}-${tdp.month}-${tdp.day}`;

  if (last.date <= twoDaysAgoStr) {
    errors.push(`UAE attack data stale, last entry ${last.date}`);
    return null;
  }

  const ballistic = last.ballisticIntercepted ?? last.ballisticDetected ?? 0;
  const cruise    = last.cruiseIntercepted    ?? last.cruiseDetected    ?? 0;
  const drones    = last.dronesIntercepted    ?? last.dronesDetected    ?? 0;
  if (ballistic === 0 && cruise === 0 && drones === 0) return null;

  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, m, d] = last.date.split('-');
  const dateLabel = `${MON[parseInt(m)-1]} ${parseInt(d)}`;

  const lines = [`🛡 UAE overnight (${dateLabel})`];
  if (ballistic > 0) {
    const pb = prev ? (prev.ballisticIntercepted ?? prev.ballisticDetected ?? 0) : null;
    lines.push(`   Ballistic: ${fmt(ballistic)} intercepted${pb != null ? delta(ballistic, pb) + ' vs prior day' : ''}`);
  }
  if (cruise > 0) {
    const pc = prev ? (prev.cruiseIntercepted ?? prev.cruiseDetected ?? 0) : null;
    lines.push(`   Cruise: ${fmt(cruise)} intercepted${pc != null ? delta(cruise, pc) + ' vs prior day' : ''}`);
  }
  if (drones > 0) {
    const pd = prev ? (prev.dronesIntercepted ?? prev.dronesDetected ?? 0) : null;
    lines.push(`   Drones: ${fmt(drones)} intercepted${pd != null ? delta(drones, pd) + ' vs prior day' : ''}`);
  }

  const cum = data.cumulative || {};
  const cumB = cum.ballisticIntercepted ?? cum.ballisticDetected;
  const cumD = cum.dronesIntercepted   ?? cum.dronesDetected;
  const cumParts = [cumB && `${fmt(cumB)} ballistic`, cumD && `${fmt(cumD)} drones`].filter(Boolean);
  if (cumParts.length) lines.push(`   Cumulative: ${cumParts.join(' / ')} since war start`);

  return lines.join('\n');
}

function renderMoDTweets(window) {
  const tweets = loadMoDTweets(window);
  if (!tweets?.length) return null;

  if (tweets.length <= 3) {
    const lines = [`📡 MoD posts overnight (${tweets.length})`];
    for (const t of tweets) {
      const text = t.text.replace(/\n+/g, ' ').slice(0, 200);
      lines.push(`   ${t.account}: "${text}${t.text.length > 200 ? '…' : ''}"`);
    }
    return lines.join('\n');
  }

  // >3 tweets → Kimi digest; fall back to verbatim on failure
  try {
    const tweetList = tweets.slice(0, 20).map((t, i) =>
      `${i+1}. ${t.account}: ${t.text.replace(/\n+/g, ' ').slice(0, 300)}`
    ).join('\n');
    const prompt = `You are summarizing overnight Middle East war updates from official MoD accounts. Output exactly 3 bullets, each one short factual sentence in present tense, no preamble, no headings, no emoji. Each bullet must name the source country/account.

Tweets:
${tweetList}`;
    const raw = kimi(prompt);
    // Kimi may return literal \n sequences — normalise to real newlines
    const summary = raw.replace(/\\n/g, '\n');
    const bullets = summary.split('\n').filter(l => l.trim()).slice(0, 3);
    const lines = [`📡 MoD posts (${tweets.length} overnight)`];
    for (const b of bullets) lines.push(`   ${b.replace(/^[-•*]\s*/, '• ')}`);
    return lines.join('\n');
  } catch (err) {
    errors.push(`kimi MoD digest failed: ${err.message.slice(0, 100)}`);
    const lines = [`📡 MoD posts overnight (${tweets.length})`];
    for (const t of tweets.slice(0, 3)) {
      const text = t.text.replace(/\n+/g, ' ').slice(0, 200);
      lines.push(`   ${t.account}: "${text}${t.text.length > 200 ? '…' : ''}"`);
    }
    return lines.join('\n');
  }
}

function renderKbSpikes() {
  const spikes = loadKbClusters();
  if (!spikes?.length) return null;
  const lines = ['📈 KB topics spiking'];
  for (const s of spikes) lines.push(`   • ${s.talking_point.slice(0, 60)} — ${s.recentCount} new tweets`);
  return lines.join('\n');
}

function renderFlights(tz, now = new Date()) {
  const airports = ['DXB', 'DOH', 'JED', 'AUH'];
  const yStr = yesterdayStr(tz, now);
  const lines = [];

  for (const iata of airports) {
    const data = loadFlights(iata);
    if (!data) continue;
    const daily = data.daily;
    if (!daily.length) continue;

    const last = daily[daily.length - 1];

    // Data is stale only if it's genuinely older than yesterday.
    // If last.date > yesterdayStr (scraper already wrote today's data), that's fine — show it.
    if (last.date < yStr) {
      errors.push(`flight_${iata.toLowerCase()}: last entry ${last.date}, expected ≥ ${yStr}`);
      continue;
    }
    const prev = daily.length >= 2 ? daily[daily.length - 2] : null;
    lines.push(`   ${iata}: ${fmt(last.total)}${delta(last.total, prev?.total)}`);
  }

  return lines.length ? ['✈️ Yesterday\'s flights', ...lines].join('\n') : null;
}

function renderCasualties(tz) {
  const data = loadUaeAttacks();
  if (!data?.daily?.length) return null;
  const last = data.daily[data.daily.length - 1];
  const killed = last.killed || 0;
  const injured = last.injured || 0;
  if (!killed && !injured) return null;
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [, m, d] = last.date.split('-');
  return `☹️ Casualties (${MON[parseInt(m)-1]} ${parseInt(d)}): ${fmt(killed)} killed, ${fmt(injured)} injured (UAE)`;
}

function renderAnomalies() {
  // Append any health-file staleness to the errors array
  try {
    const now = Date.now();
    for (const f of readdirSync(HEALTH_DIR).filter(f => f.endsWith('.json'))) {
      try {
        const d = JSON.parse(readFileSync(join(HEALTH_DIR, f), 'utf8'));
        if (!d.lastUpdated) continue;
        const staleHours = (now - new Date(d.lastUpdated).getTime()) / 3_600_000;
        if (staleHours > 36)
          errors.push(`${f.replace('.json', '')}: no update for ${Math.round(staleHours / 24)} days`);
      } catch {}
    }
  } catch {}

  if (!errors.length) return null;
  return ['⚠️ Data gaps', ...errors.slice(0, 5).map(e => `   • ${e}`)].join('\n');
}

function renderFooter(tz, now = new Date()) {
  const p = localParts(now, tz);
  return `—\nGenerated ${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${tzAbbr(tz)} · BRIEFING_TZ=${tz}`;
}

// ─── Assembler ────────────────────────────────────────────────────────────────

export function truncate(text, maxWords = 600) {
  if (text.split(/\s+/).length <= maxWords) return text;
  // Drop the cluster spikes section first (lowest priority content)
  // Use non-capturing group (?:...) to avoid accidental captures
  const withoutSpikes = text.replace(/📈 KB topics spiking[\s\S]*?(?:\n\n|$)/, '\n\n').trim();
  if (withoutSpikes.split(/\s+/).length <= maxWords) return withoutSpikes;
  return withoutSpikes.split(/\s+/).slice(0, maxWords).join(' ') + '…';
}

async function main() {
  const now = new Date();
  const overnight = overnightWindow(TZ, now);

  const sections = [
    renderHeader(TZ, now),
    renderAttacks(TZ, now),
    renderMoDTweets(overnight),
    renderKbSpikes(),
    renderFlights(TZ, now),
    renderCasualties(TZ),
    renderAnomalies(),
    renderFooter(TZ, now),
  ];

  const filled = sections.filter(s => s?.trim());
  const body = filled.join('\n\n');

  // Header (index 0) and footer (last) are always present.
  // Suppress the briefing if those are the ONLY two sections — nothing interesting happened.
  // Using a counter avoids re-calling renderers (which could produce different timestamps).
  if (filled.length <= 2) process.exit(0);

  process.stdout.write(truncate(body) + '\n');
}

// Only run main when invoked directly (not imported by tests)
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(err => {
    console.error('[briefing] Fatal:', err);
    process.exit(1);
  });
}
