import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '81003afee8cb0d4cb74e738d46cbdfed';

const FRED_SERIES = [
  { id: 'DGS10', country: 'US', flag: 'us', name: 'US 10Y', frequency: 'daily' },
  { id: 'IRLTLT01GBM156N', country: 'UK', flag: 'gb', name: 'UK 10Y (monthly)', frequency: 'monthly' },
  { id: 'IRLTLT01JPM156N', country: 'Japan', flag: 'jp', name: 'Japan 10Y (monthly)', frequency: 'monthly' },
];

const ECB_GERMANY = {
  id: 'IRLTLT01DEM156N',
  country: 'Germany',
  flag: 'de',
  name: 'Germany 10Y (ECB)',
  frequency: 'daily',
};

async function fetchFredSeries(s) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&observation_start=2025-01-01&api_key=${FRED_API_KEY}&file_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${s.id}: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const data = (json.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
  return { ...s, data };
}

async function fetchEcbGermany() {
  const url = 'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?format=csvdata&startPeriod=2025-01-01';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ECB Germany: ${res.status} ${res.statusText}`);
  const csv = await res.text();
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const dateIdx = header.indexOf('TIME_PERIOD');
  const valueIdx = header.indexOf('OBS_VALUE');
  if (dateIdx === -1 || valueIdx === -1) throw new Error('ECB CSV: missing TIME_PERIOD or OBS_VALUE columns');
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (!cols[dateIdx] || !cols[valueIdx]) continue;
    const value = parseFloat(cols[valueIdx]);
    if (isNaN(value)) continue;
    data.push({ date: cols[dateIdx], value });
  }
  return { ...ECB_GERMANY, data };
}

async function main() {
  const [germany, ...fredResults] = await Promise.all([
    fetchEcbGermany(),
    ...FRED_SERIES.map(fetchFredSeries),
  ]);
  // Order: US, Germany, UK, Japan
  const series = [fredResults[0], germany, fredResults[1], fredResults[2]];
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
