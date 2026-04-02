# Spec: Flight Data Day-Before Correction + Audit Log

**Status:** Draft  
**Date:** 2026-04-02  
**Project:** ww3live.xyz airport tracker  

---

## Problem Statement

The daily flight data pipeline fetches **scheduled** flights for today. Some scheduled flights will be cancelled, resulting in inflated counts. By the next day, the previous day's actual (completed) flights are available. Currently, yesterday's inflated numbers are never corrected.

## Current Architecture

- **Data files:** `public/data-flights-{iata}.json` (one per airport)
- **Data structure:** Each file has a `daily` array with entries:
  ```json
  { "date": "2026-04-02", "departures": 392, "arrivals": 399, "total": 791,
    "regions": { ... }, "source": "aerodatabox", "cancelled": 10 }
  ```
- **Data sources:** Flightradar24 (primary for today counts), OpenSky Network (parallel tracking)
- **Pipeline:** GitHub Actions workflow `update-data.yml` runs daily at 08:00 UTC
- **Scripts:**
  - `scripts/fetch-flights-fr24.js` — fetches today's live counts from FR24
  - `scripts/fetch-flights-all.js` — fetches from OpenSky with regional breakdown
  - `scripts/fetch-flights-mct-doh.js` — OpenSky for MCT/DOH specifically

---

## Feature 1: Day-Before Correction

### Overview

When the daily workflow runs, it should **also re-fetch yesterday's completed flight data** and update yesterday's entry in the `daily` array if the numbers differ from what was recorded.

### Data Source for Corrections

**Flightradar24 API** (same as current source) can provide yesterday's data by adjusting the timestamp parameter:

```js
// Current: fetches today
const timestamp = Math.floor(Date.now() / 1000);

// Correction: fetch yesterday
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);
```

The FR24 schedule endpoint (`api.flightradar24.com/common/v1/airport.json`) supports historical timestamps. By the next day, cancelled flights are excluded from results, giving actual counts.

**Alternative: AeroDataBox API** (via RapidAPI) provides a `FIDS/Flights` endpoint with status filtering:
```
GET /flights/airports/iata/{code}/{fromLocal}/{toLocal}
```
With query param `status=landed` or `status=departed` to get only completed flights. This is more explicit but costs API calls. **Recommendation:** Use FR24 first (free, already integrated); add AeroDataBox as a fallback or validation source if needed.

### Implementation

#### New script: `scripts/correct-yesterday-flights.js`

```js
#!/usr/bin/env node
/**
 * Re-fetch yesterday's flight data from FR24 and correct the daily entry
 * if numbers have changed (scheduled → actual).
 * Also writes corrections to the audit log.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const AIRPORTS = [
  { iata: "DXB" }, { iata: "AUH" }, { iata: "DWC" },
  { iata: "MCT" }, { iata: "DOH" }, { iata: "TLV" },
];

const AUDIT_FILE = join(PUBLIC_DIR, "data-flights-audit.json");

// ... (reuse fetchPage/countFlights from fetch-flights-fr24.js with timestamp param)

async function correctAirport(airport) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);
  const yesterdayTimestamp = Math.floor(yesterday.getTime() / 1000);

  const dataFile = join(PUBLIC_DIR, `data-flights-${airport.iata.toLowerCase()}.json`);
  const data = JSON.parse(readFileSync(dataFile, "utf8"));

  if (!data.daily) return;

  const idx = data.daily.findIndex(d => d.date === yesterdayDate);
  if (idx === -1) {
    console.log(`[${airport.iata}] No entry for ${yesterdayDate}, skipping correction`);
    return;
  }

  const oldEntry = { ...data.daily[idx] };

  // Fetch actual counts for yesterday
  const arrivals = await countFlightsForTimestamp(airport.iata, "arrivals", yesterdayTimestamp);
  const departures = await countFlightsForTimestamp(airport.iata, "departures", yesterdayTimestamp);
  const total = arrivals + departures;

  // Compare — only update if different
  if (oldEntry.arrivals === arrivals &&
      oldEntry.departures === departures &&
      oldEntry.total === total) {
    console.log(`[${airport.iata}] ${yesterdayDate} unchanged`);
    return;
  }

  // Update entry
  data.daily[idx] = {
    ...data.daily[idx],
    departures,
    arrivals,
    total,
    corrected: true,
    correctedAt: new Date().toISOString(),
  };

  writeFileSync(dataFile, JSON.stringify(data, null, 2) + "\n");

  // Write audit entry
  writeAuditEntry({
    iata: airport.iata,
    date: yesterdayDate,
    old: { departures: oldEntry.departures, arrivals: oldEntry.arrivals, total: oldEntry.total },
    new: { departures, arrivals, total },
    correctedAt: new Date().toISOString(),
  });

  console.log(`[${airport.iata}] Corrected ${yesterdayDate}: ` +
    `total ${oldEntry.total} → ${total} (Δ${total - oldEntry.total})`);
}
```

### Fields to Update

| Field | Update? | Notes |
|-------|---------|-------|
| `departures` | ✅ | Actual count replacing scheduled |
| `arrivals` | ✅ | Actual count replacing scheduled |
| `total` | ✅ | Recalculated as departures + arrivals |
| `regions` | ✅ if available | Re-fetch regional breakdown if source provides it |
| `cancelled` | ✅ | Update to actual cancellation count (or set to 0 if source gives only completed) |
| `corrected` | ✅ (new) | Boolean flag: `true` if entry was corrected |
| `correctedAt` | ✅ (new) | ISO timestamp of when correction was applied |
| `source` | Keep | Don't change the original source attribution |
| `date` | Keep | Never change |

### Detection Logic

```
IF yesterday's entry exists in daily[]
  AND (old.total ≠ new.total OR old.departures ≠ new.departures OR old.arrivals ≠ new.arrivals)
THEN update + audit
```

### Edge Cases

| Case | Handling |
|------|----------|
| **First run ever** | No yesterday entry exists → skip silently with log message |
| **Missing yesterday entry** | `findIndex` returns -1 → skip with warning |
| **API failure (FR24 down)** | `continue-on-error: true` in workflow; log warning, don't overwrite with 0 |
| **Zero returned from API** | Treat as API failure (guard: `if (total === 0) return` — airports always have flights) |
| **Already corrected** | Check `corrected: true` flag; still re-correct (actuals may refine further within 48h) |
| **Workflow runs multiple times/day** | Idempotent: re-fetching yesterday with same actual data produces same result |
| **Weekend/holiday lower counts** | Not an edge case — legitimate data; no special handling |
| **Timezone boundary** | Use UTC consistently (FR24 API uses UTC timestamps) |

### Workflow Integration

Add to `.github/workflows/update-data.yml` **before** the current flight fetch steps:

```yaml
      - name: Correct yesterday's flight data
        run: node scripts/correct-yesterday-flights.js
        continue-on-error: true
```

This ensures yesterday is corrected before today's data is fetched, keeping the pipeline sequential.

---

## Feature 2: Audit Log

### Purpose

Track every correction made to flight data, enabling transparency and debugging.

### File Format

**Single consolidated file:** `public/data-flights-audit.json`

Rationale: One file is simpler to query and keeps all corrections in one place. With 6 airports × 1 correction/day max, volume is ~180 entries/month — trivially small.

### Schema

```json
{
  "corrections": [
    {
      "iata": "DXB",
      "date": "2026-04-01",
      "old": {
        "departures": 410,
        "arrivals": 415,
        "total": 825
      },
      "new": {
        "departures": 392,
        "arrivals": 399,
        "total": 791
      },
      "delta": {
        "departures": -18,
        "arrivals": -16,
        "total": -34
      },
      "correctedAt": "2026-04-02T08:22:45.000Z",
      "reason": "day-before-correction"
    }
  ],
  "lastPruned": "2026-04-02T08:22:45.000Z"
}
```

### Write Logic

```js
function writeAuditEntry(entry) {
  let audit = { corrections: [] };
  try {
    audit = JSON.parse(readFileSync(AUDIT_FILE, "utf8"));
  } catch { /* first run */ }

  const correction = {
    iata: entry.iata,
    date: entry.date,
    old: entry.old,
    new: entry.new,
    delta: {
      departures: entry.new.departures - entry.old.departures,
      arrivals: entry.new.arrivals - entry.old.arrivals,
      total: entry.new.total - entry.old.total,
    },
    correctedAt: entry.correctedAt,
    reason: "day-before-correction",
  };

  // Deduplicate: replace if same iata+date already has a correction
  const existIdx = audit.corrections.findIndex(
    c => c.iata === entry.iata && c.date === entry.date
  );
  if (existIdx !== -1) {
    audit.corrections[existIdx] = correction;
  } else {
    audit.corrections.push(correction);
  }

  // Prune: keep only last 90 days
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  audit.corrections = audit.corrections.filter(c => c.date >= cutoffStr);
  audit.lastPruned = new Date().toISOString();

  writeFileSync(AUDIT_FILE, JSON.stringify(audit, null, 2) + "\n");
}
```

### Retention

- **90 days** of corrections retained
- Pruning happens on every write (cheap operation given small volume)
- Older entries silently removed

### UI Surfacing

#### Option A: Tooltip on corrected data points (Recommended)

In the flight chart component, when rendering a data point where `corrected: true`:

- Add a small indicator (e.g., `*` or subtle dot) next to the data point
- On hover/tooltip, show: `"Corrected: originally 825, actual 791 (−34)"`
- Minimal UI impact, adds transparency without clutter

```jsx
// In chart tooltip renderer
{point.corrected && (
  <span className="text-xs text-amber-500">
    ⟳ Corrected from {point.originalTotal ?? '?'}
  </span>
)}
```

#### Option B: Admin/debug view (Optional, lower priority)

- Route: `/admin/audit` or `?debug=audit`
- Table showing all corrections: date, airport, old → new, delta
- Useful for monitoring data quality over time
- Can be built later; the audit JSON is the foundation

**Recommendation:** Start with Option A (tooltip). The `corrected` flag on daily entries is sufficient. Option B can be added later by reading `data-flights-audit.json` directly.

---

## Implementation Plan

### Phase 1: Core correction + audit (1 PR)

1. Create `scripts/correct-yesterday-flights.js`
   - Extract shared FR24 fetch logic into `scripts/lib/fr24.js` (used by both scripts)
   - Implement yesterday correction with audit logging
2. Create empty `public/data-flights-audit.json` (`{"corrections":[]}`)
3. Add workflow step to `update-data.yml`
4. Add `corrected` / `correctedAt` fields to daily entry type

### Phase 2: UI indicator (separate PR)

1. Add tooltip indicator for corrected data points in flight chart
2. Load audit data if needed for detailed correction info

### Estimated API impact

- **FR24:** +12 API calls/day (6 airports × 2 directions) — well within free tier
- **No new API keys required**

---

## Open Questions

1. **Should we also correct day-before-yesterday (T-2)?** Some flights may finalize status later. Recommendation: Start with T-1 only; extend to T-2 if data shows significant late corrections.
2. **Should OpenSky data also be corrected?** The `-opensky.json` files are parallel tracking. Recommendation: Correct only the primary files (non-opensky) since those power the UI.
3. **FR24 historical accuracy window:** Verify that FR24 returns accurate completed-flight data for T-1. If not, consider AeroDataBox `status=landed|departed` endpoint as primary correction source.
