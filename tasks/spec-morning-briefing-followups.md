# Spec — Morning Briefing follow-ups

Second-pass review fixes for `scripts/morning-briefing.mjs`. The v1
implementation is solid; this spec captures the remaining issues found
during the post-merge review of commits 1e25f85 + 2773596.

Each item below is independent and can be applied in any order. All
changes should keep the existing 24-test suite passing
(`node tests/timezone.test.mjs`).

## 1. Fix kimi bullet split (BUG, visible in production)

**Problem.** `renderMoDTweets` splits the kimi response on `\n` to extract
bullets:

```js
const summary = raw.replace(/\\n/g, '\n');
const bullets = summary.split('\n').filter(l => l.trim()).slice(0, 3);
```

Kimi sometimes wraps a single bullet across two lines (hard line wrap at
~70 chars). The current parser then treats the second line of bullet 1 as
the start of bullet 2, producing output like:

```
   • The UAE Ministry of Defence reports its air defenses are engaging Ir
   anian ballistic missiles, cruise missiles, and UAVs.
   • The UAE Ministry of Defe
```

**Fix.** Collapse newlines first, then split on actual bullet markers
(`•`, `-`, `*`, or `\d+.`). Replace the bullet-extraction block with:

```js
const bullets = summary
  .replace(/\r?\n+/g, ' ')                          // collapse all newlines
  .split(/(?:^|\s)(?:[•\-*]|\d+\.)\s+/)             // split on bullet markers
  .map(s => s.trim())
  .filter(Boolean)
  .slice(0, 3);
```

Add a regression test to `tests/timezone.test.mjs` (or a new
`tests/render.test.mjs`) that feeds a synthetic kimi-style mid-word-wrapped
input and asserts exactly 3 unbroken bullets come out.

**Verify.** Run the script with real overnight tweet data and confirm
the bullets render as single sentences with no truncation mid-word.

## 2. Tighten KbSpikes — also check `last_activity`

**Problem.** Spec §5.4 says a "spike" requires both:
- (a) cluster `last_activity` within the overnight window, AND
- (b) tweet_ids count grew by ≥3 in the last 24h.

`loadKbClusters()` currently only checks (b). A cluster whose
`last_activity` is days old but whose `tweet_ids` array happens to
contain ≥3 recent snowflake IDs (e.g. retroactive backfill) would
still surface.

**Fix.** Pass the `overnight` window into `loadKbClusters(window)` and
filter by `new Date(c.last_activity) >= window[0]`. Update
`renderKbSpikes(window)` to forward the window from `main`.

```js
function loadKbClusters(window) {
  return safeLoad('talking-point-clusters.json', () => {
    // …
    const spikes = clusters
      .filter(c => c.verdict !== 'defunct')
      .filter(c => c.last_activity && new Date(c.last_activity) >= window[0])
      .map(/* … */)
      .filter(s => s.recentCount >= 3)
      // …
  });
}
```

Test: pass a synthetic clusters file with one cluster whose
`last_activity` is 5 days ago (but has 3 recent snowflake tweet_ids) and
assert it is excluded.

## 3. Header timestamp uses actual run time

**Problem.** `renderHeader` hardcodes `08:00`:

```js
return `☀️ Morning briefing — ${day} ${month} ${date}, 08:00 ${abbr}`;
```

If cron drift fires the script at 08:03, the header lies. Cosmetic but
worth fixing.

**Fix.** Use the actual local hour/minute from `localParts(now, tz)`:

```js
const hhmm = `${parts.hour}:${parts.minute}`;
return `☀️ Morning briefing — ${day} ${month} ${date}, ${hhmm} ${abbr}`;
```

The function already takes `now` as a parameter — no signature change.

## 4. Drop unused `tz` parameter from `renderCasualties`

**Problem.** `renderCasualties(tz)` accepts `tz` but never uses it. The
date label is built by string-parsing `last.date` directly.

**Fix.** Either:
- (a) drop the param: `function renderCasualties()` and update the
  caller in `main`, OR
- (b) actually use `tz` (e.g. by validating that `last.date` falls in the
  expected local window).

Pick (a) — simpler. The date label is already correct because
`data.daily[].date` is a `YYYY-MM-DD` string that's authoritative
regardless of tz.

## 5. `tzAbbr` should accept `now` for reproducibility

**Problem.** `tzAbbr(tz)` calls `new Date()` internally to look up the
abbreviation. Near a DST transition, two callers in the same script run
could get different abbreviations (CET vs CEST).

**Fix.** Accept an optional `now`:

```js
function tzAbbr(tz, now = new Date()) {
  // … use `now` instead of `new Date()` …
}
```

Update both call sites in `renderHeader` and `renderFooter` to pass
their `now`.

Low priority — would only matter for a script run that straddles the
DST transition instant, which is unlikely for an 08:00 daily cron.

## 6. Atomic write in `airbnb-manager/server/routes/settings.js`

**Problem.** `saveSettings()` uses `writeFileSync` directly:

```js
function saveSettings(settings) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2) + '\n');
}
```

Two simultaneous POSTs can interleave and produce a corrupted JSON file.
Single-user impact is low, but it's a 5-line fix.

**Fix.**

```js
import { writeFileSync, renameSync } from 'fs';

function saveSettings(settings) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = `${CONFIG_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n');
  renameSync(tmp, CONFIG_FILE);  // atomic on POSIX
}
```

## Acceptance criteria

- All 24 existing tests in `tests/timezone.test.mjs` continue to pass.
- Add at least one regression test for #1 (kimi bullet parsing) and #2
  (KbSpikes last_activity filter).
- Manual smoke test (`BRIEFING_TZ=Asia/Dubai node scripts/morning-briefing.mjs`)
  renders MoD bullets as single unbroken sentences.
- No new dependencies.

## Out of scope

- Full word-aware text wrapping inside bullet text (the script doesn't
  hard-wrap; the wrap was kimi's, not ours).
- Migrating from Tailscale-IP hardcoded API URL in `Settings.jsx`.
- KB sqlite reads (still not used in v1; the JSON cluster store is
  sufficient).
- Bahrain/Kuwait/Iran attack data sections (deferred to v2 per spec §11).
