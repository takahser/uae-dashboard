/**
 * Validates that data-bonds.json contains data for all expected series.
 * - All 4 required series must be present
 * - Each series must have sufficient daily data points (≥20)
 * - Each series must have data within the last 5 calendar days (warns if stale)
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { strict as assert } from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data-bonds.json'), 'utf8'));

const REQUIRED_SERIES = ['DGS10', 'IRLTLT01DEM156N', 'IRLTLT01GBM156N', 'IRLTLT01JPM156N'];
const MIN_DAILY_POINTS = 20;
// Allow 5 calendar days lag to handle weekends + holidays
const FRESHNESS_DAYS = 5;

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const freshnessThreshold = daysAgo(FRESHNESS_DAYS);
let hasWarnings = false;

for (const id of REQUIRED_SERIES) {
  const s = data.series.find(s => s.id === id);
  assert(s, `Missing series: ${id}`);
  assert(
    s.data.length >= MIN_DAILY_POINTS,
    `Series ${id} has only ${s.data.length} data points (minimum: ${MIN_DAILY_POINTS}). Check fetch-bonds.js.`
  );

  const lastDate = s.data.length > 0 ? s.data[s.data.length - 1].date : null;
  if (!lastDate || lastDate < freshnessThreshold) {
    console.warn(`⚠️  WARNING: ${id} last data point is ${lastDate} — older than ${FRESHNESS_DAYS} days (threshold: ${freshnessThreshold}). Data may be stale.`);
    hasWarnings = true;
  } else {
    console.log(`✓ ${id} (${s.frequency}): ${s.data.length} pts, last: ${lastDate}`);
  }
}

if (hasWarnings) {
  // Warn but don't fail — stale data on weekends/holidays is expected
  console.warn('Some series have stale data. Run the fetch-bonds workflow to refresh.');
} else {
  console.log('All bond data validation checks passed.');
}
