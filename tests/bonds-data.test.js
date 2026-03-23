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

for (const id of REQUIRED_SERIES) {
  const s = data.series.find(s => s.id === id);
  assert(s, `Missing series: ${id}`);
  assert(
    s.data.length >= MIN_DATA_POINTS,
    `Series ${id} has only ${s.data.length} data points (minimum: ${MIN_DATA_POINTS}). Check observation_start in fetch-bonds.js.`
  );
  console.log(`✓ ${id}: ${s.data.length} data points`);
}

console.log('All bond data validation checks passed.');
