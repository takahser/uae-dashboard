# Spec — Morning Briefing

Daily 08:00 local-time briefing for Seraya, delivered via Telegram from the
Mac mini OpenClaw agent. Reads from the existing UAE-dashboard data files
and the xpost-automation KB; produces a short scannable digest.

## 1. Goals & non-goals

**Goals**
- One short message in the morning that tells Seraya what happened overnight
  (attacks, MoD posts, KB topics that spiked, flight numbers, data gaps).
- Always trustworthy: never lie, never silently break, never spam an empty
  message.
- Minimal infra: a single Node script + an OpenClaw cron entry. No new
  service, no new database.

**Non-goals**
- Not a real-time alert system. (See spec-attack-alarm-chart.md for that.)
- Not a chat assistant. The briefing is one-way text only.
- Not a full report. Target read time ~30 seconds, max ~400 words.

## 2. Configuration

Single env var: `BRIEFING_TZ`.

| Value           | Status     | Notes                                  |
| --------------- | ---------- | -------------------------------------- |
| `Asia/Dubai`    | **default**| UTC+4 fixed. No DST.                   |
| `Europe/Zurich` | supported  | UTC+1/+2, DST. Cron must change twice/yr. |
| `Asia/Bangkok`  | supported  | UTC+7 fixed. No DST.                   |

All "today / yesterday / overnight" window math MUST resolve to wall-clock
time in `BRIEFING_TZ`. Use `Intl.DateTimeFormat` with `timeZone: tz` to do
the local-day decomposition; never assume UTC == local.

If `BRIEFING_TZ` is unset → `Asia/Dubai`.
If `BRIEFING_TZ` is set to anything else → log a warning, fall back to
`Asia/Dubai`, do not crash.

### Cron schedule (08:00 in BRIEFING_TZ)

| BRIEFING_TZ     | Cron (UTC)              | Notes                              |
| --------------- | ----------------------- | ---------------------------------- |
| Asia/Dubai      | `0 4 * * *`             | year-round                         |
| Asia/Bangkok    | `0 1 * * *`             | year-round                         |
| Europe/Zurich   | `0 7 * * *` (winter, CET)<br>`0 6 * * *` (summer, CEST) | switch on DST transitions |

For Zurich, the cleanest implementation is to schedule at the *winter* time
(`0 7 * * *`) and let the script self-check on each run: if local time is
not 08:00 ±1h in the configured tz, exit 0 silently. That makes DST
self-correcting at the cost of one extra wake per DST shift.

## 3. Data sources

All read-only.

### 3.1 KB SQLite

`/Users/chou/repos/xpost-automation/memory/kb.db`

- `tweet_queue` — `tweet_id, author_handle, content, received_at, relevant,
  processed_cluster, processed_facts, source`
- `facts` — exists (per existing pipeline). Columns: `id, statement,
  embedding, entities, event_date, location, numeric_value, numeric_unit,
  source_tweet_id, source_account, first_seen_at, last_seen_at, seen_count,
  confidence, is_stale`. Filter `is_stale = 0`.
- `crawl_log` — for staleness checks (last successful scrape per author).
- Open with `better-sqlite3` in `{ readonly: true }` mode. The KB is owned by
  another process; never write.

Cluster JSON store (talking points are NOT in sqlite):
`/Users/chou/repos/xpost-automation/memory/talking-point-clusters.json`
- Each entry: `{ talking_point, first_seen, last_activity, tweet_ids,
  verdict, … }`. Filter out `verdict === "defunct"`.

### 3.2 UAE attack stats

`/Users/chou/repos/uae-dashboard/public/data-uae.json`
- `cumulative.{ballisticDetected, ballisticIntercepted, cruiseDetected,
  cruiseIntercepted, dronesDetected, dronesIntercepted, killed, injured}`
- `daily[]` ordered chronologically; `daily[N-1]` is the most recent day
  the parser had data for. Use `daily[N-1]` vs `daily[N-2]` to compute
  "yesterday's delta".

Equivalent files exist for other countries (`data-bahrain.json`,
`data-kuwait.json`, `data-iran.json`, etc.) — only UAE is required for v1.

### 3.3 Health indicators

`/Users/chou/repos/uae-dashboard/public/health/*.json`

Each file is a single source's health record. Used to detect "data
collection gap" anomalies. Keys of interest per file:
- `lastUpdated` (ISO timestamp)
- `lastValue` and `lastNewValueAt` (last time the value changed)
- `method`, `sourceUrl`

Anomaly rule: if `lastUpdated` is more than 36 hours stale OR
`lastNewValueAt` is more than 72 hours stale, flag as a gap.

### 3.4 MoD tweet cache

`/Users/chou/repos/uae-dashboard/.github/scripts/tweet-cache/{country}.json`

Countries: `uae, bahrain, kuwait, qatar, saudi, israel, iran`. Each file:
`{ account, country, fetchedAt, source: "kb-database", tweetCount, tweets:
[{ text, time, url, likes, retweets }] }`. Times are ISO 8601 UTC.

Use the tweet `time` field for window filtering. Filter to only those that
fall inside the overnight window (see §4) AND from accounts the operator
cares about (default: all 7).

### 3.5 Flight counts

`/Users/chou/repos/uae-dashboard/public/data-flights-{dxb,doh,jed,auh}.json`
- `daily[]` with `{ date: "YYYY-MM-DD", departures, arrivals, total }`
- Use `daily[last]` (most recent complete day) vs `daily[last-1]` for the
  delta. The most recent entry's date should equal *yesterday* in
  `BRIEFING_TZ`; if it's older than that, treat as a gap and flag in §6.

## 4. Window definitions

All in `BRIEFING_TZ`.

- **Overnight** = `[yesterday 00:00, today 08:00)` local. This catches both
  the previous full day's events and the early-morning hours.
- **Yesterday** = `[yesterday 00:00, today 00:00)` local. Used for daily
  totals and flight comparisons.
- **Last 24h** = `[now - 24h, now]`. Used for the "tweets since last
  briefing" digest (since briefings run daily, the previous briefing was
  ~24h ago).

Helper to compute UTC bounds for a local window:

```js
function localDayBounds(tz, dayOffset = 0) {
  // Returns [startUtc, endUtc] for the local day at offset (0 = today,
  // -1 = yesterday). Implementation uses Intl.DateTimeFormat to extract
  // year/month/day in tz, then constructs Date.UTC offset by the tz's
  // current offset. See helpers/timezone.mjs in the eventual impl.
}
```

## 5. Content sections (in order)

Render each section only if it has content. Empty sections are omitted
entirely — no "nothing to report" filler.

### 5.1 Header
```
☀️ Morning briefing — Mon Apr 7, 08:00 GST
```
Date in `BRIEFING_TZ`. The tz abbreviation (`GST`/`CET`/`ICT`) is derived
via `Intl.DateTimeFormat({ timeZoneName: 'short' })`.

### 5.2 Overnight attacks
Pull `daily[last]` from `data-uae.json`. If its date is *yesterday* in
`BRIEFING_TZ`, render:
```
🛡 UAE overnight (Apr 6)
   Ballistic: 9 intercepted (vs 6 prior day, +3)
   Drones:    50 intercepted (vs 38, +12)
   Cumulative: 196 ballistic / 1072 drones since war start
```
Numbers come from `daily[last]` minus `daily[last-1]` for the delta. If the
delta is zero across all categories, omit this section.

If `daily[last].date` is older than yesterday in `BRIEFING_TZ`, suppress
this section entirely and emit a §5.7 anomaly: "UAE attack data stale,
last entry $date".

### 5.3 MoD tweet digest
Read all 7 tweet-cache files. Filter tweets where `time` is within the
overnight window. Group by country.

If 0 tweets across all countries → omit.
If ≤3 tweets total → render verbatim text (truncate each to 200 chars):
```
📡 MoD posts overnight
   @modgovae (UAE): "<verbatim text…>"
   @IDF (Israel): "<verbatim text…>"
```

If >3 tweets total → call Kimi CLI (see §6) with the full set, ask for a
3-bullet summary, render the 3 bullets:
```
📡 MoD posts (12 overnight)
   • UAE intercepts 9 ballistic + 50 drones in overnight wave
   • IDF reports 90 Hezbollah fighters killed in S. Lebanon
   • Iran's Khamenei threatens "big surprise" against US/Israel
```

### 5.4 KB cluster spikes
A "spike" = a cluster whose `last_activity` is within the overnight window
AND whose tweet_ids count grew by ≥3 in the last 24h. Compute the delta by
counting tweet_ids whose snowflake-decoded timestamp falls in the last 24h.

Top 3 spikes by tweet_ids growth, omit otherwise:
```
📈 KB topics spiking
   • US-Iran F-15 rescue op — 47 new tweets
   • Strait of Hormuz tanker traffic update — 23 new tweets
   • Israeli strikes on southern Beirut — 18 new tweets
```

If 0 clusters spiked → omit.

### 5.5 Flights
For each of DXB, DOH, JED, AUH: pull `daily[last]` and `daily[last-1]`
from `data-flights-<iata>.json`. Render as a one-line per airport summary
ONLY if `daily[last].date == yesterday` in `BRIEFING_TZ`:

```
✈️ Yesterday's flights
   DXB: 1,247 (-32 vs prior day)
   DOH: 893 (+14)
   JED: 612 (+8)
   AUH: 487 (-19)
```

Airports with stale data are omitted from this section and listed in §5.7
as anomalies. If ALL four are stale → omit the section.

### 5.6 Killed / injured (only if non-zero overnight)
If `daily[last]` has any non-zero `killed` or `injured`, append a one-liner:
```
☹️ Casualties (Apr 6): 3 killed, 17 injured (UAE)
```
Omit otherwise.

### 5.7 Data anomalies
List any data source that failed the freshness check from §3.3 or any
section that detected stale data:
```
⚠️ Data gaps
   • flight_tlv: no update for 4 days
   • kb-database (qatar): no MoD posts in 48h (uncommon)
```

If everything is fresh → omit.

### 5.8 Footer
```
—
Generated 2026-04-07 08:00 GST · BRIEFING_TZ=Asia/Dubai
```

## 6. LLM usage

The only LLM-dependent section is §5.3 (when >3 tweets). Use Kimi CLI:

```js
import { spawnSync } from 'child_process';
function kimi(prompt) {
  const result = spawnSync('kimi', ['--print', '-p', prompt], {
    encoding: 'utf8', timeout: 60_000, env: { ...process.env },
  });
  if (result.status !== 0) throw new Error(`kimi failed: ${result.stderr?.slice(0,200)}`);
  // Strip TextPart wire format if present (see assign-cluster.js for the regex).
  const m = result.stdout.match(/TextPart\([\s\S]*?type='text',[\s\S]*?text='([\s\S]*?)'\s*\)/);
  return (m ? m[1] : result.stdout).trim();
}
```

Prompt template for the tweet digest:
```
You are summarizing overnight Middle East war updates from official MoD
accounts. Output exactly 3 bullets, each one short factual sentence in
present tense, no preamble, no headings, no emoji. Each bullet must name
the source country/account.

Tweets:
1. @modgovae: <text>
2. @IDF: <text>
…
```

**No Claude. No Groq. No Anthropic API.** If kimi fails, fall back to
verbatim rendering of the first 3 tweets (see §5.3 ≤3 path). Never block
the briefing on LLM availability.

## 7. Output format

- Plain text only. No markdown bold/italic, no tables, no code blocks.
- Emoji used as section headers only (☀️ 🛡 📡 📈 ✈️ ☹️ ⚠️). No inline emoji
  in body text.
- Hard wrap at ~70 chars (Telegram renders it fine without wrapping but
  this keeps it scannable in narrow clients).
- Total budget: target 250–400 words. Hard cap 600. If over budget, drop
  §5.4 (cluster spikes) first, then truncate §5.3.
- Numbers use locale-agnostic formatting: `1,247` (commas as thousands
  separators, period for decimals). Always.

## 8. Delivery

### 8.1 Script

Path: `/Users/chou/repos/uae-dashboard/scripts/morning-briefing.mjs`

Behavior:
- Reads BRIEFING_TZ from env (default `Asia/Dubai`).
- Computes the windows from §4.
- Builds each section in order.
- If the final output is empty (no sections produced anything) → exit 0
  with no stdout. OpenClaw `--announce` will see no output and send
  nothing.
- If ≥1 section was produced → print the assembled briefing to stdout and
  exit 0.
- All errors logged to stderr; never crash mid-build (see §9).

### 8.2 OpenClaw cron registration

Run once on the Mac mini to register the cron entry:

```sh
openclaw cron add morning-briefing \
  --schedule "0 4 * * *" \
  --command "BRIEFING_TZ=Asia/Dubai node /Users/chou/repos/uae-dashboard/scripts/morning-briefing.mjs" \
  --announce
```

For Zurich/Bangkok, replace `--schedule` per the table in §2 and update
`BRIEFING_TZ` accordingly. The `--announce` flag tells OpenClaw to forward
the script's stdout to the Telegram channel for Seraya.

### 8.3 Manual test

```sh
BRIEFING_TZ=Asia/Dubai node scripts/morning-briefing.mjs
```

This should print the same briefing it would send. No env-var overrides
should ever change the output other than BRIEFING_TZ and standard `DEBUG`
logging.

## 9. Error handling

**Per-source isolation.** Wrap each data-source read in its own try/catch.
A failing flight file does not stop tweets from rendering. Push any caught
error to an in-memory `errors[]` array and surface them in §5.7 as
anomalies.

**LLM optional.** If Kimi is unavailable or returns garbage that doesn't
parse into 3 bullets, fall back to the verbatim ≤3-tweet rendering.

**Empty briefing rule.** If after all sections are tried `body.trim() ===
""`, exit 0 with no output. Better silence than a broken message.

**No silent corruption.** If a critical assumption is violated (e.g.
data-uae.json exists but has no `daily[]` array), log to stderr and treat
as a §5.7 anomaly. Don't `throw`.

**Idempotent.** Running the script twice in the same minute must produce
identical output. No timestamps in the body other than the header (which
uses the cron run time, naturally identical within a minute).

## 10. Implementation steps

In order. Each step lists what already exists and what's new.

1. **Create the script skeleton** *(new, ~30 LOC)*
   - `scripts/morning-briefing.mjs` with arg parsing, BRIEFING_TZ resolution,
     `tz` validation against allowlist, header rendering.

2. **Window helpers** *(new, ~40 LOC)*
   - `localDayBounds(tz, dayOffset)` returning `[Date, Date]` UTC.
   - `withinWindow(iso, [start, end])`.
   - Unit-test against the three TZs (write a tiny `tests/timezone.test.mjs`).

3. **Data loaders** *(mostly new, ~80 LOC total)*
   - `loadUaeAttacks()` from `data-uae.json` — exists, just read.
   - `loadFlights(iata)` for each of dxb/doh/jed/auh — exists.
   - `loadHealth()` glob `public/health/*.json` — exists.
   - `loadMoDTweets(window)` glob `tweet-cache/*.json` and filter — exists.
   - `loadKbClusters(window)` from `talking-point-clusters.json` plus
     snowflake-time decoding for tweet_ids — *new code path*. The cluster
     JSON exists; the spike calculation is new.
   - `loadKbFacts(window)` (optional v2) — facts table exists.

4. **Section renderers** *(new, one function per §5.x, ~150 LOC total)*
   - Each takes the loaded data + window and returns a string or `null`.
   - Section is omitted if it returns `null`/`""`.

5. **Kimi caller** *(new, ~25 LOC)*
   - Copy the `kimi()` helper from §6. No retries (it's already a
     fallback path; just fail to verbatim).

6. **Assembler** *(new, ~30 LOC)*
   - Run all renderers in order, filter out empties, join with `\n\n`, run
     length budget logic from §7.

7. **Empty-briefing guard** *(new, ~5 LOC)*
   - If body is empty after assembly → exit 0 silently.

8. **Manual test on Mac mini** *(no code)*
   - Run with each of the three BRIEFING_TZ values, verify output.

9. **Register OpenClaw cron** *(no code)*
   - Run the `openclaw cron add` command from §8.2.

10. **Monitor first 3 mornings** *(no code)*
    - Spot-check the briefings. Tune the cluster-spike threshold (§5.4) if
      it's too noisy or too quiet.

**Estimated complexity**: ~350 LOC of new code, all in one file. No new
dependencies (`better-sqlite3` already in xpost-automation, but the
briefing script lives in uae-dashboard — add it as a dep there, or read
the SQLite file via a small `child_process` call to a sibling node script
in xpost-automation if you want to keep the dependency boundary clean).

## 11. Open questions for the implementer

- Should the briefing include Bahrain/Kuwait/Iran attack data alongside
  UAE? v1 says UAE only; bump to v2 if Seraya wants more.
- Cluster spike threshold: ≥3 new tweets per cluster in 24h is a guess.
  Tune after first week.
- Should §5.3 (MoD digest) include retweet/like counts for context? Cache
  files have them but they're 0 (not collected). Skip for v1.
- Failure notification: if the briefing exits silently for ≥2 days in a
  row, should it nudge Seraya via a separate "briefing went silent"
  channel? Probably yes, but out of scope for v1.
