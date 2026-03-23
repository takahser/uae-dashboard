import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '81003afee8cb0d4cb74e738d46cbdfed';

const SERIES = [
  { id: 'DGS10', country: 'US', flag: 'us', name: 'US 10Y', frequency: 'daily' },
  { id: 'IRLTLT01DEM156N', country: 'Germany', flag: 'de', name: 'Germany 10Y', frequency: 'monthly' },
  { id: 'IRLTLT01GBM156N', country: 'UK', flag: 'gb', name: 'UK 10Y', frequency: 'monthly' },
  { id: 'IRLTLT01JPM156N', country: 'Japan', flag: 'jp', name: 'Japan 10Y', frequency: 'monthly' },
];

async function fetchSeries(s) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&observation_start=2026-02-01&api_key=${FRED_API_KEY}&file_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${s.id}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const data = (json.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
  return { ...s, data };
}

async function main() {
  const series = await Promise.all(SERIES.map(fetchSeries));
  const out = {
    updated: new Date().toISOString().slice(0, 10),
    warStart: '2026-02-28',
    series,
  };
  fs.writeFileSync(
    join(__dirname, '..', 'public', 'data-bonds.json'),
    JSON.stringify(out, null, 2) + '\n'
  );
  console.log(`Wrote data-bonds.json — ${series.map(s => `${s.id}: ${s.data.length} obs`).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
