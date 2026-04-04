import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');
const WRITE_HEALTH = join(REPO_ROOT, 'scripts/write-health.py');

/**
 * Update health file for a flight source.
 * @param {string} sourceId - e.g. 'flight_auh', 'flight_mct'
 * @param {object} opts - { oldValue, newValue, method, sourceUrl }
 */
export function updateHealth(sourceId, opts = {}) {
  const args = [sourceId];
  if (opts.oldValue) args.push(`--old-value="${opts.oldValue}"`);
  if (opts.newValue) args.push(`--new-value="${opts.newValue}"`);
  if (opts.method) args.push(`--method="${opts.method}"`);
  if (opts.sourceUrl) args.push(`--source-url="${opts.sourceUrl}"`);

  const cmd = `python3 ${WRITE_HEALTH} ${args.join(' ')}`;
  console.log(`[health] ${cmd}`);

  try {
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`[health] Failed to update ${sourceId}:`, err.message);
    return false;
  }
}

/**
 * Batch update for "others" category.
 */
export function updateFlightOthers(airports) {
  for (const airport of airports) {
    updateHealth(`flight_${airport.code.toLowerCase()}`, {
      newValue: String(airport.total),
      method: 'playwright',
      sourceUrl: airport.source
    });
  }

  const total = airports.reduce((sum, a) => sum + a.total, 0);
  updateHealth('flight_others', {
    newValue: String(total),
    method: 'playwright-aggregate'
  });
}
