/**
 * Validates that data-bonds.json contains data for all expected series.
 * Catches the case where monthly FRED series return 0 or 1 data points
 * due to an observation_start date that is too recent.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { strict as assert } from 'assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'data-bonds.json'), 'utf8'));

const REQUIRED_SERIES = ['DGS10', 'IRLTLT01DEM156N', 'IRLTLT01GBM156N', 'IRLTLT01JPM156N'];
const MIN_DATA_POINTS = 3; // monthly series must have at least 3 months of data
const MIN_DAILY_POINTS = 20; // daily series (Germany ECB) should have >20 points since Jan 2025

for (const id of REQUIRED_SERIES) {
  const s = data.series.find(s => s.id === id);
  assert(s, `Missing series: ${id}`);
  const minPts = s.frequency === 'daily' ? MIN_DAILY_POINTS : MIN_DATA_POINTS;
  assert(
    s.data.length >= minPts,
    `Series ${id} (${s.frequency}) has only ${s.data.length} data points (minimum: ${minPts}). Check fetch-bonds.js.`
  );
  console.log(`✓ ${id} (${s.frequency}): ${s.data.length} data points`);
}

console.log('All bond data validation checks passed.');
