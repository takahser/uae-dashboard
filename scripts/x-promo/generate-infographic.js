#!/usr/bin/env node
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../public');
const WAR_START = new Date('2026-02-28');
const CHROMIUM_PATH = '/Users/chou/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const FLAGS = {
  uae: '🇦🇪', kuwait: '🇰🇼', qatar: '🇶🇦', bahrain: '🇧🇭',
  oman: '🇴🇲', israel: '🇮🇱', saudi: '🇸🇦', iran: '🇮🇷'
};

const NAMES = {
  uae: 'UAE', kuwait: 'Kuwait', qatar: 'Qatar', bahrain: 'Bahrain',
  oman: 'Oman', israel: 'Israel', saudi: 'Saudi Arabia', iran: 'Iran'
};

function loadData(country) {
  const raw = readFileSync(resolve(DATA_DIR, `data-${country}.json`), 'utf8');
  return JSON.parse(raw);
}

function getDayN() {
  const now = new Date();
  return Math.floor((now - WAR_START) / (1000 * 60 * 60 * 24));
}

function getInterceptionRate(c) {
  const total = (c.ballisticDetected || 0) + (c.cruiseDetected || 0) + (c.dronesDetected || 0);
  const intercepted = (c.ballisticIntercepted || 0) + (c.cruiseIntercepted || 0) + (c.dronesIntercepted || 0);
  if (total === 0) return null;
  return ((intercepted / total) * 100).toFixed(1);
}

function baseStyles() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px; height: 675px;
      background: #050B1A;
      font-family: 'DM Sans', sans-serif;
      color: #E8E8ED;
      position: relative;
      overflow: hidden;
    }
    .orb-amber {
      position: absolute; top: -120px; right: -120px;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .orb-blue {
      position: absolute; bottom: -120px; left: -120px;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .glass {
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(40px);
      -webkit-backdrop-filter: blur(40px);
      border: 1px solid rgba(255,255,255,0.11);
      border-radius: 16px;
    }
    .watermark {
      position: absolute; bottom: 16px; right: 24px;
      font-size: 13px; color: #F59E0B; opacity: 0.6;
      font-weight: 500;
    }
    .branding {
      position: absolute; bottom: 16px; left: 24px;
      font-size: 12px; color: rgba(232,232,237,0.4);
    }
    .logo {
      position: absolute; top: 24px; left: 28px;
      display: flex; align-items: center; gap: 10px;
    }
    .logo-w {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #F59E0B, #D97706);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 20px; color: #050B1A;
    }
    .logo-text { font-size: 18px; font-weight: 600; color: #E8E8ED; letter-spacing: 0.5px; }
    .date-badge {
      position: absolute; top: 28px; right: 28px;
      font-size: 14px; color: rgba(232,232,237,0.5);
    }
  `;
}

function renderStatCard(country) {
  const data = loadData(country);
  const c = data.cumulative;
  const dayN = getDayN();
  const name = NAMES[country];
  const flag = FLAGS[country];

  const totalDetected = (c.ballisticDetected || 0) + (c.cruiseDetected || 0) + (c.dronesDetected || 0);
  const totalIntercepted = (c.ballisticIntercepted || 0) + (c.cruiseIntercepted || 0) + (c.dronesIntercepted || 0);
  const rate = getInterceptionRate(c) || 'N/A';
  const killed = c.killed || 0;
  const injured = c.injured || 0;

  const ballisticPct = totalDetected > 0 ? (((c.ballisticDetected || 0) / totalDetected) * 100).toFixed(0) : 0;
  const dronePct = totalDetected > 0 ? (((c.dronesDetected || 0) / totalDetected) * 100).toFixed(0) : 0;
  const cruisePct = totalDetected > 0 ? (((c.cruiseDetected || 0) / totalDetected) * 100).toFixed(0) : 0;

  const today = new Date().toISOString().slice(0, 10);

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
    .country-badge {
      position: absolute; top: 24px; right: 28px;
      display: flex; align-items: center; gap: 12px;
    }
    .country-flag { font-size: 32px; }
    .country-info { text-align: right; }
    .country-name-badge { font-size: 18px; font-weight: 600; }
    .headline {
      position: absolute; top: 140px; left: 0; right: 0;
      text-align: center; font-size: 15px; letter-spacing: 3px;
      color: rgba(232,232,237,0.4); text-transform: uppercase;
    }
    .country-title {
      position: absolute; top: 175px; left: 0; right: 0;
      text-align: center; font-size: 38px; font-weight: 700; color: #E8E8ED;
    }
    .day-badge-center {
      position: absolute; top: 230px; left: 0; right: 0;
      text-align: center;
    }
    .day-badge {
      display: inline-block; padding: 4px 14px; border-radius: 8px;
      background: rgba(245,158,11,0.2); color: #F59E0B;
      font-size: 14px; font-weight: 600;
    }
    .stats-row {
      display: flex; gap: 20px; justify-content: center;
      position: absolute; top: 300px; left: 50%; transform: translateX(-50%);
      width: 90%;
    }
    .stat-card {
      flex: 1; padding: 28px 20px; text-align: center;
    }
    .stat-value { font-size: 42px; font-weight: 700; color: #F59E0B; margin-bottom: 8px; }
    .stat-label { font-size: 14px; color: rgba(232,232,237,0.6); text-transform: uppercase; letter-spacing: 1px; }
    .stat-sub { font-size: 13px; color: rgba(232,232,237,0.5); margin-top: 4px; }
    .breakdown-bar {
      position: absolute; bottom: 60px; left: 40px; right: 40px;
      height: 32px; border-radius: 16px; overflow: hidden;
      display: flex; background: rgba(255,255,255,0.05);
    }
    .bar-segment { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; }
    .bar-ballistic { background: rgba(245,158,11,0.6); }
    .bar-cruise { background: rgba(168,85,247,0.5); }
    .bar-drone { background: rgba(59,130,246,0.5); }
    .breakdown-labels {
      position: absolute; bottom: 38px; left: 40px; right: 40px;
      display: flex; justify-content: center; gap: 24px; font-size: 11px; color: rgba(232,232,237,0.45);
    }
  </style></head><body>
    <div class="orb-amber"></div>
    <div class="orb-blue"></div>
    <div class="logo"><div class="logo-w">W</div><div class="logo-text">ww3live.xyz</div></div>
    <div class="country-badge">
      <div class="country-info">
        <div class="country-name-badge">${flag} ${name}</div>
      </div>
    </div>
    <div class="headline">Day ${dayN} of the Iran-GCC War</div>
    <div class="country-title">${name} Air Defense Summary</div>
    <div class="day-badge-center"><div class="day-badge">DAY ${dayN}</div></div>
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-value">${totalDetected.toLocaleString()}</div>
        <div class="stat-label">Detected</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-value">${totalIntercepted.toLocaleString()}</div>
        <div class="stat-label">Intercepted</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-value">${rate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
      <div class="stat-card glass">
        <div class="stat-value">${killed}</div>
        <div class="stat-label">Killed</div>
        <div class="stat-sub">+${injured} injured</div>
      </div>
    </div>
    <div class="breakdown-bar">
      <div class="bar-segment bar-ballistic" style="width:${ballisticPct}%">${ballisticPct > 10 ? 'Ballistic' : ''}</div>
      <div class="bar-segment bar-cruise" style="width:${cruisePct}%">${cruisePct > 10 ? 'Cruise' : ''}</div>
      <div class="bar-segment bar-drone" style="width:${dronePct}%">${dronePct > 10 ? 'Drones' : ''}</div>
    </div>
    <div class="breakdown-labels">
      <span>■ Ballistic ${ballisticPct}%</span>
      <span>■ Cruise ${cruisePct}%</span>
      <span>■ Drones ${dronePct}%</span>
    </div>
    <div class="branding">ww3live.xyz | Data: Official MoD sources | ${today}</div>
    <div class="watermark">ww3live.xyz</div>
  </body></html>`;
}

function renderCountryComparison() {
  const dayN = getDayN();
  const countries = ['uae', 'kuwait', 'qatar', 'bahrain', 'oman'];
  const rows = [];

  for (const c of countries) {
    try {
      const data = loadData(c);
      const cum = data.cumulative;
      const rate = getInterceptionRate(cum);
      if (rate !== null) {
        rows.push({ country: c, name: NAMES[c], flag: FLAGS[c], rate: parseFloat(rate) });
      }
    } catch { /* skip */ }
  }

  rows.sort((a, b) => b.rate - a.rate);

  const rowsHtml = rows.map(r => `
    <div class="comp-row glass">
      <div class="comp-flag">${r.flag}</div>
      <div class="comp-name">${r.name}</div>
      <div class="comp-bar-container">
        <div class="comp-bar-bg">
          <div class="comp-bar-fill" style="width: ${r.rate}%"></div>
        </div>
      </div>
      <div class="comp-rate">${r.rate}%</div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
    .title {
      position: absolute; top: 80px; left: 0; right: 0;
      text-align: center; font-size: 22px; font-weight: 700;
      letter-spacing: 2px; text-transform: uppercase;
    }
    .title span { color: #F59E0B; }
    .comp-container {
      position: absolute; top: 140px; left: 60px; right: 60px; bottom: 60px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .comp-row {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 24px; flex: 1;
    }
    .comp-flag { font-size: 28px; }
    .comp-name { font-size: 16px; font-weight: 600; width: 120px; }
    .comp-bar-container { flex: 1; }
    .comp-bar-bg { height: 20px; border-radius: 10px; background: rgba(255,255,255,0.06); overflow: hidden; }
    .comp-bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #F59E0B, #D97706); }
    .comp-rate { font-size: 20px; font-weight: 700; color: #F59E0B; width: 80px; text-align: right; }
  </style></head><body>
    <div class="orb-amber"></div>
    <div class="orb-blue"></div>
    <div class="logo"><div class="logo-w">W</div><div class="logo-text">ww3live.xyz</div></div>
    <div class="date-badge">DAY ${dayN}</div>
    <div class="title">GCC Interception Rates — <span>Day ${dayN}</span></div>
    <div class="comp-container">${rowsHtml}</div>
    <div class="branding">ww3live.xyz | Data: Official MoD sources</div>
    <div class="watermark">ww3live.xyz</div>
  </body></html>`;
}

function renderAttackTimeline(country) {
  const data = loadData(country);
  const dayN = getDayN();
  const name = NAMES[country];
  const flag = FLAGS[country];

  const daily = (data.daily || []);
  if (daily.length === 0) {
    throw new Error(`No daily data for ${country}`);
  }

  const maxVal = Math.max(...daily.map(d =>
    (d.ballisticDetected || 0) + (d.cruiseDetected || 0) + (d.dronesDetected || 0)
  ), 1);

  const barsHtml = daily.map(d => {
    const ballistic = d.ballisticDetected || 0;
    const drones = d.dronesDetected || 0;
    const cruise = d.cruiseDetected || 0;
    const total = ballistic + cruise + drones;
    const bH = (ballistic / maxVal) * 280;
    const cH = (cruise / maxVal) * 280;
    const dH = (drones / maxVal) * 280;
    const dateLabel = d.label || d.date?.slice(5) || '';
    return `
      <div class="bar-group">
        <div class="bar-stack">
          <div class="bar bar-ballistic" style="height:${bH}px" title="Ballistic: ${ballistic}"></div>
          <div class="bar bar-cruise" style="height:${cH}px" title="Cruise: ${cruise}"></div>
          <div class="bar bar-drone" style="height:${dH}px" title="Drones: ${drones}"></div>
        </div>
        <div class="bar-total">${total}</div>
        <div class="bar-date">${dateLabel}</div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><style>
    ${baseStyles()}
    .title {
      position: absolute; top: 80px; left: 0; right: 0;
      text-align: center; font-size: 20px; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase;
    }
    .title span { color: #F59E0B; }
    .chart-area {
      position: absolute; top: 140px; left: 80px; right: 80px; bottom: 80px;
      display: flex; align-items: flex-end; justify-content: center; gap: 28px;
    }
    .bar-group { display: flex; flex-direction: column; align-items: center; }
    .bar-stack { display: flex; flex-direction: column; align-items: center; }
    .bar { width: 56px; border-radius: 6px 6px 0 0; min-height: 2px; }
    .bar-ballistic { background: rgba(245,158,11,0.7); }
    .bar-cruise { background: rgba(168,85,247,0.6); }
    .bar-drone { background: rgba(59,130,246,0.6); }
    .bar-total { margin-top: 6px; font-size: 14px; font-weight: 600; color: #F59E0B; }
    .bar-date { font-size: 12px; color: rgba(232,232,237,0.5); margin-top: 2px; }
    .legend {
      position: absolute; bottom: 48px; left: 0; right: 0;
      display: flex; justify-content: center; gap: 28px; font-size: 12px; color: rgba(232,232,237,0.5);
    }
    .legend-dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: middle; }
  </style></head><body>
    <div class="orb-amber"></div>
    <div class="orb-blue"></div>
    <div class="logo"><div class="logo-w">W</div><div class="logo-text">ww3live.xyz</div></div>
    <div class="date-badge">DAY ${dayN}</div>
    <div class="title">${flag} Daily Attacks — <span>${name}</span> — Since Feb 28</div>
    <div class="chart-area">${barsHtml}</div>
    <div class="legend">
      <span><span class="legend-dot" style="background:rgba(245,158,11,0.7)"></span>Ballistic</span>
      <span><span class="legend-dot" style="background:rgba(168,85,247,0.6)"></span>Cruise</span>
      <span><span class="legend-dot" style="background:rgba(59,130,246,0.6)"></span>Drones</span>
    </div>
    <div class="branding">ww3live.xyz | Data: Official MoD sources</div>
    <div class="watermark">ww3live.xyz</div>
  </body></html>`;
}

export async function generateInfographic({ type, country, output }) {
  let html;
  switch (type) {
    case 'stat-card':
      html = renderStatCard(country || 'uae');
      break;
    case 'country-comparison':
      html = renderCountryComparison();
      break;
    case 'attack-timeline':
      html = renderAttackTimeline(country || 'uae');
      break;
    default:
      throw new Error(`Unknown type: ${type}`);
  }

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 675 });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: output, type: 'png' });
    console.log(`Infographic saved: ${output}`);
  } finally {
    await browser.close();
  }
}

// CLI entry point
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const { values } = parseArgs({
    options: {
      type: { type: 'string', default: 'stat-card' },
      country: { type: 'string', default: 'uae' },
      output: { type: 'string', default: '/tmp/infographic.png' },
    },
  });
  generateInfographic(values).catch(err => { console.error(err); process.exit(1); });
}
