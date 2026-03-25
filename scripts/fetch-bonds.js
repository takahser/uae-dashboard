import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '81003afee8cb0d4cb74e738d46cbdfed';

// US 10Y — FRED (daily)
async function fetchFredUS() {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&observation_start=2025-01-01&api_key=${FRED_API_KEY}&file_type=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED DGS10: ${res.status} ${res.statusText}`);
  const json = await res.json();
  const data = (json.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
  return { id: 'DGS10', country: 'US', flag: 'us', name: 'US 10Y', frequency: 'daily', data };
}

// Germany 10Y — ECB (daily)
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
  return { id: 'IRLTLT01DEM156N', country: 'Germany', flag: 'de', name: 'Germany 10Y', frequency: 'daily', data };
}

// UK 10Y — Bank of England IUDMNPY (daily gilt yield)
async function fetchBoEUK() {
  const url = 'https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp?csv.x=yes&SeriesCodes=IUDMNPY&Datefrom=01/Jan/2025&Dateto=now&CSVF=TN&UsingCodes=Y&VPD=Y';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`BoE UK: ${res.status} ${res.statusText}`);
  const csv = await res.text();
  const lines = csv.split('\n').slice(1); // skip header
  const data = [];
  const MONTHS = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
  for (const line of lines) {
    const cols = line.trim().split(',');
    if (cols.length < 2 || !cols[0] || !cols[1]) continue;
    // Date format: "02 Jan 2025" → "2025-01-02"
    const parts = cols[0].trim().split(' ');
    if (parts.length !== 3) continue;
    const [dd, mon, yyyy] = parts;
    const mm = MONTHS[mon];
    if (!mm) continue;
    const date = `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
    const value = parseFloat(cols[1]);
    if (isNaN(value)) continue;
    data.push({ date, value });
  }
  data.sort((a, b) => a.date.localeCompare(b.date));
  return { id: 'IUDMNPY', country: 'UK', flag: 'gb', name: 'UK 10Y', frequency: 'daily', data };
}

// Japan 10Y — Ministry of Finance Japan (daily JGB)
// Uses the full historical CSV; date format is Japanese era (R8.3.2 = 2026-03-02)
async function fetchMoFJapan() {
  const url = 'https://www.mof.go.jp/jgbs/reference/interest_rate/data/jgbcm_all.csv';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`MoF Japan: ${res.status} ${res.statusText}`);
  // Response is Shift-JIS encoded; fetch as arraybuffer and decode
  const buf = await res.arrayBuffer();
  const csv = new TextDecoder('shift-jis').decode(buf);
  const lines = csv.split('\n');

  // Find header row (contains 10年)
  let headerIdx = -1;
  let col10Y = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].includes('10年') || lines[i].includes('10\u5e74')) {
      headerIdx = i;
      col10Y = lines[i].split(',').findIndex(c => c.trim() === '10年' || c.trim() === '10\u5e74');
      break;
    }
  }
  if (col10Y === -1) throw new Error('MoF Japan: could not find 10Y column');

  // Japanese era to Gregorian: Reiwa (R) starts 2019-05-01, year offset = 2018
  // Showa (S) starts 1926, offset = 1925
  // Heisei (H) starts 1989, offset = 1988
  function eraToGregorian(eraStr) {
    const m = eraStr.trim().match(/^([RSH])(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    const [, era, y, mo, d] = m;
    const year = era === 'R' ? 2018 + parseInt(y) : era === 'H' ? 1988 + parseInt(y) : 1925 + parseInt(y);
    return `${year}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const cutoff = '2025-01-01';
  const data = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (!cols[0] || !cols[col10Y]) continue;
    const date = eraToGregorian(cols[0]);
    if (!date || date < cutoff) continue;
    const value = parseFloat(cols[col10Y]);
    if (isNaN(value)) continue;
    data.push({ date, value });
  }
  data.sort((a, b) => a.date.localeCompare(b.date));
  return { id: 'IRLTLT01JPM156N', country: 'Japan', flag: 'jp', name: 'Japan 10Y', frequency: 'daily', data };
}

async function main() {
  const [us, germany, uk, japan] = await Promise.all([
    fetchFredUS(),
    fetchEcbGermany(),
    fetchBoEUK(),
    fetchMoFJapan(),
  ]);

  // Order: US, Germany, UK, Japan
  const series = [us, germany, uk, japan];
  const out = {
    updated: new Date().toISOString().slice(0, 10),
    warStart: '2026-02-28',
    series,
  };
  fs.writeFileSync(
    join(__dirname, '..', 'public', 'data-bonds.json'),
    JSON.stringify(out, null, 2) + '\n'
  );
  console.log(`Wrote data-bonds.json — ${series.map(s => `${s.id}: ${s.data.length} obs (${s.frequency})`).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
