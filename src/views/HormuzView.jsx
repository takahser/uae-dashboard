import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip, Legend } from 'recharts';
import { useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import data from '../data/hormuz.json';
import MarketPanel from '../components/MarketPanel';
import { useMarketData } from '../hooks/useMarketData';

const BG = '#050B1A';
const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const GLASS_BLUR = 'blur(40px)';
const GLASS_RADIUS = 16;
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const ACCENT = '#F59E0B';
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const today = data[data.length - 1];
const closureDays = data.filter((d) => d.status === 'critical').length;

const intel = [
  'Mar 19: Qatar declares force majeure on LNG contracts to Italy, Belgium, South Korea, China — 2 of 14 LNG trains offline, 12.8M tpa capacity lost for 3–5 years (QatarEnergy CEO, Reuters)',
  'Mar 19: Kuwait — drone strikes on Mina al-Ahmadi (730K bpd) and Mina Abdullah (454K bpd) refineries; both ablaze (Reuters, AP)',
  'Mar 19: SAMREF refinery, Yanbu (Aramco-ExxonMobil JV, Red Sea) struck by drone — minimal damage confirmed; Saudi Defense Ministry (Reuters, AP)',
  'Mar 18: South Pars gas field (world\'s largest) struck — several phases offline; Asaluyeh processing facility hit (FARS)',
  'Mar 18: Aramco Riyadh — ballistic missile intercepted by Saudi defenses; no confirmed impact on facility (Reuters)',
  'Mar 18: Iran orders evacuation of petrochemical plants in UAE, Saudi Arabia and Qatar',
  'Mar 18: Iran negotiating Hormuz passage with 8 countries in exchange for yuan-denominated oil trade',
  'Mar 18: Fujairah bypass active — India\'s Jag Laadki + 2 vessels (~170,000 MT crude/LPG) loaded at Fujairah (Gulf of Oman, east of strait) avoiding Hormuz entirely',
  'Mar 18: Strait CLOSED confirmed — Jag Laadki debunked as Hormuz crossing; loaded at Fujairah bypass port',
  'Mar 16: DXB fuel depot struck — fire reported, diverted flights, 12 injured',
  'Mar 13: Iran switches to "continuous engagement" doctrine — no interception reporting since',
  'Mar 11: 3 ships struck near Hormuz — Thai Mayuree Naree on fire, 3 crew missing',
  'Mar 11: Iran planting mines; US Navy refusing escort requests',
  'Mar 11: Iran threatens $200/barrel, switches to continuous strikes doctrine',
];

function getStraitStatus(ships) {
  if (ships === 0) return { color: '#C0392B', bg: 'rgba(192,57,43,0.15)', border: '#C0392B', label: 'CLOSED', desc: 'No commercial traffic detected' };
  if (ships < 20) return { color: '#E67E22', bg: 'rgba(230,126,34,0.15)', border: '#E67E22', label: 'RESTRICTED', desc: 'Severely reduced traffic' };
  if (ships < 80) return { color: '#F1C40F', bg: 'rgba(241,196,15,0.15)', border: '#F1C40F', label: 'DISRUPTED', desc: 'Below normal traffic' };
  return { color: '#27AE60', bg: 'rgba(39,174,96,0.15)', border: '#27AE60', label: 'OPEN', desc: 'Normal operations' };
}

function parseIntelItem(text) {
  const match = text.match(/^([\w\s]+\d+):\s*(.*)$/);
  if (match) return { timestamp: match[1], body: match[2] };
  return { timestamp: '', body: text };
}

function StatCard({ label, value, color, unit }) {
  return (
    <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS, padding: '20px 16px', flex: 1, minWidth: 140, borderTop: `3px solid ${color || ACCENT}` }}>
      <div style={{ color: SUBTEXT, fontSize: '0.8rem', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || TEXT }}>{value}</div>
      {unit && <div style={{ color: SUBTEXT, fontSize: '0.72rem', marginTop: 4, opacity: 0.75 }}>{unit}</div>}
    </div>
  );
}

// Strategic infrastructure sites — capacity/recovery data (experimental)
const STRATEGIC_SITES = [
  {
    pos: [25.93, 51.53],
    name: "Ras Laffan Industrial City",
    country: "Qatar",
    type: "LNG / Petrochemical",
    capacityPct: 83,
    recoveryEst: "3–5 years",
    recoverySource: "QatarEnergy CEO, Reuters Mar 19",
    attacked: "2026-03-04",
    notes: "2 of 14 LNG trains offline; 1 of 2 GTL facilities damaged; 12.8M tpa offline",
  },
  {
    pos: [29.07, 48.13],
    name: "Mina al-Ahmadi Refinery",
    country: "Kuwait",
    type: "Refinery",
    capacityPct: null,
    recoveryEst: null,
    recoverySource: null,
    attacked: "2026-03-19",
    notes: "730K bpd capacity; ablaze as of Mar 19 — damage assessment ongoing",
  },
  {
    pos: [28.96, 48.17],
    name: "Mina Abdullah Refinery",
    country: "Kuwait",
    type: "Refinery",
    capacityPct: null,
    recoveryEst: null,
    recoverySource: null,
    attacked: "2026-03-19",
    notes: "454K bpd capacity; ablaze as of Mar 19 — damage assessment ongoing",
  },
  {
    pos: [27.1, 52.6],
    name: "South Pars Gas Field (offshore)",
    country: "Iran",
    type: "Gas Field",
    capacityPct: null,
    recoveryEst: null,
    recoverySource: null,
    attacked: "2026-03-18",
    notes: "World's largest gas field; several phases offline (FARS). No confirmed % figure yet.",
  },
  {
    pos: [27.47, 52.61],
    name: "Asaluyeh Gas Processing Facility",
    country: "Iran",
    type: "Gas Processing",
    capacityPct: null,
    recoveryEst: null,
    recoverySource: null,
    attacked: "2026-03-18",
    notes: "Onshore South Pars processing hub; parts of Asaluyeh refinery hit — FARS confirmed",
  },
];

const ATTACKS = [
  { pos: [29.07, 48.13], label: "Mar 19: Drone strike — Mina al-Ahmadi refinery, Kuwait (730,000 bpd capacity)", date: "2026-03-19" },
  { pos: [28.96, 48.17], label: "Mar 19: Drone strike — Mina Abdullah refinery ablaze, Kuwait (454,000 bpd capacity)", date: "2026-03-19" },
  { pos: [27.1, 52.6], label: "Mar 18: South Pars gas field struck — multiple processing phases offline", date: "2026-03-18" },
  // Riyadh Mar 18: missile intercepted, no confirmed facility impact — removed
  // SAMREF Yanbu Mar 19: minimal damage confirmed, but outside Hormuz map bounds (lng 38°E)
  { pos: [25.8, 57.2], label: "Mar 11: Thai Mayuree Naree struck — fire, 3 crew missing", date: "2026-03-11" },
  { pos: [26.1, 56.9], label: "Mar 9: Container vessel Meridian Star hit by drone", date: "2026-03-09" },
  { pos: [25.6, 58.1], label: "Mar 7: Oil tanker Gulf Pioneer attacked, diverted to Fujairah", date: "2026-03-07" },
  { pos: [26.4, 56.4], label: "Mar 5: Mine detected near shipping lane — US Navy warning issued", date: "2026-03-05" },
];

const RECENT_DATE = new Date("2026-03-18");
const isRecent = (a) => {
  const d = new Date(a.date);
  return (RECENT_DATE - d) / 86400000 <= 2;
};

const PORTS = [
  { pos: [27.18, 56.27], label: "Bandar Abbas \u2014 Iran main port & naval base", country: "Iran" },
  { pos: [24.98, 55.07], label: "Jebel Ali (UAE) \u2014 World largest man-made harbour", country: "UAE" },
  { pos: [25.13, 56.36], label: "Fujairah (UAE) \u2014 Major oil terminal & bunkering hub", country: "UAE" },
  { pos: [25.34, 56.36], label: "Khor Fakkan (UAE) \u2014 Key container port, Gulf of Oman", country: "UAE" },
  { pos: [23.62, 58.59], label: "Muscat (Oman) \u2014 Main port", country: "Oman" },
  { pos: [24.35, 56.64], label: "Sohar (Oman) \u2014 Oil & industrial port", country: "Oman" },
];

// Ships leaving Persian Gulf ports, transiting through the strait
const HORMUZ_ROUTE = [
  [25.5, 54.5],  // Persian Gulf (Abu Dhabi / Dubai offshore)
  [26.0, 55.8],  // Approaching strait
  [26.55, 56.25], // Narrowest point (Musandam)
  [25.8, 57.2],  // Gulf of Oman exit
  [24.0, 58.5],  // Open Indian Ocean
];

// Abu Dhabi Crude Oil Pipeline (ADCOP) — land route from Habshan fields to Fujairah terminal
// Approximate waypoints through UAE interior / Hajar mountains
const ADCOP_PIPELINE = [
  [24.47, 54.37], // Abu Dhabi / offshore fields area
  [24.18, 54.90], // Habshan / Ruwais inland
  [24.10, 55.50], // UAE desert interior
  [24.35, 55.85], // Approaching Hajar mountains
  [24.72, 56.10], // Through the mountains
  [25.13, 56.36], // Fujairah terminal
];

// Fujairah bypass: crude piped INLAND from Abu Dhabi fields to Fujairah terminal,
// then ships load at Fujairah and sail east — never entering the strait
const FUJAIRAH_BYPASS = [
  [25.13, 56.36], // Fujairah terminal (loading point)
  [24.6, 57.8],   // Gulf of Oman, offshore
  [23.6, 59.2],   // Further offshore, past Muscat
  [22.4, 60.5],   // Past Ras al Hadd (eastern tip of Oman) — open Arabian Sea
];

// Map view bounds for filtering attacks
const MAP_VIEW_BOUNDS = { latMin: 22.5, latMax: 30.5, lngMin: 52.5, lngMax: 60.5 };

function HormuzMap() {
  return (
    <div style={{ position: 'relative', marginBottom: 32 }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, color: TEXT }}>
        Strait of Hormuz — Live Threat Map
      </h3>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${GLASS_BORDER}` }}>
        <MapContainer
          center={[26.5, 56.5]}
          zoom={7}
          style={{ height: 420, width: '100%', borderRadius: 12 }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {/* Hormuz Transit Route — CLOSED */}
          <Polyline
            positions={HORMUZ_ROUTE}
            pathOptions={{ color: '#EF4444', weight: 2.5, dashArray: '8 6', opacity: 0.85 }}
          >
            <Tooltip sticky>Hormuz Transit — CLOSED since Mar 13</Tooltip>
          </Polyline>

          {/* ADCOP Pipeline — land route Abu Dhabi to Fujairah */}
          <Polyline
            positions={ADCOP_PIPELINE}
            pathOptions={{ color: '#27AE60', weight: 2, dashArray: '4 5', opacity: 0.7 }}
          >
            <Tooltip sticky>Abu Dhabi Crude Oil Pipeline (ADCOP) — land route&#10;Crude pumped from Abu Dhabi fields inland through UAE to Fujairah terminal, bypassing Hormuz entirely.</Tooltip>
          </Polyline>

          {/* Fujairah Bypass — ACTIVE */}
          <Polyline
            positions={FUJAIRAH_BYPASS}
            pathOptions={{ color: '#27AE60', weight: 2.5, opacity: 0.9 }}
          >
            <Tooltip sticky>Fujairah Bypass — ACTIVE&#10;Abu Dhabi crude transported by pipeline inland to Fujairah (Gulf of Oman coast). Tankers load here and sail east — no Hormuz transit needed.</Tooltip>
          </Polyline>

          {/* Port markers */}
          {PORTS.map((p, i) => (
            <CircleMarker
              key={`port-${i}`}
              center={p.pos}
              radius={6}
              pathOptions={{ color: '#4a9eff', fillColor: '#4a9eff', fillOpacity: 0.8, weight: 1 }}
            >
              <Tooltip>{p.label}</Tooltip>
            </CircleMarker>
          ))}

          {/* Attack markers */}
          {ATTACKS.filter(a =>
            a.pos[0] >= MAP_VIEW_BOUNDS.latMin && a.pos[0] <= MAP_VIEW_BOUNDS.latMax &&
            a.pos[1] >= MAP_VIEW_BOUNDS.lngMin && a.pos[1] <= MAP_VIEW_BOUNDS.lngMax
          ).map((a, i) => (
            <CircleMarker
              key={`atk-${i}`}
              center={a.pos}
              radius={isRecent(a) ? 10 : 8}
              pathOptions={{
                color: isRecent(a) ? '#FF7800' : '#EF4444',
                fillColor: isRecent(a) ? '#FF7800' : '#EF4444',
                fillOpacity: 0.85, weight: isRecent(a) ? 2 : 1
              }}
            >
              <Tooltip>{a.label}</Tooltip>
            </CircleMarker>
          ))}

          {/* Strategic infrastructure — capacity layer (experimental) */}
          {expOn && STRATEGIC_SITES.filter(s =>
            s.pos[0] >= MAP_VIEW_BOUNDS.latMin && s.pos[0] <= MAP_VIEW_BOUNDS.latMax &&
            s.pos[1] >= MAP_VIEW_BOUNDS.lngMin && s.pos[1] <= MAP_VIEW_BOUNDS.lngMax
          ).map((s, i) => (
            <CircleMarker
              key={`site-${i}`}
              center={s.pos}
              radius={11}
              pathOptions={{
                color: s.capacityPct !== null ? '#F59E0B' : '#9CA3AF',
                fillColor: s.capacityPct !== null ? '#F59E0B' : '#374151',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '4 3',
              }}
            >
              <Tooltip sticky>{
                s.name + ' · ' + s.country + '\n' +
                s.type + '\n' +
                (s.capacityPct !== null
                  ? 'Capacity: ' + s.capacityPct + '% operational\nRecovery: ' + s.recoveryEst + '\nSource: ' + s.recoverySource
                  : 'Capacity: unconfirmed') +
                (s.notes ? '\n' + s.notes : '')
              }</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>

      </div>
      {/* Map legend */}
      <div style={{
        marginTop: 8, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center',
        background: 'rgba(5,11,26,0.75)', backdropFilter: 'blur(16px)',
        border: `1px solid ${GLASS_BORDER}`, borderRadius: 8,
        padding: '12px 16px', fontSize: '0.78rem', color: SUBTEXT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 24, height: 0, borderTop: '2px dashed #EF4444' }} />
          <span>Hormuz Transit <span style={{ color: '#EF4444', fontWeight: 700 }}>CLOSED</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 24, height: 0, borderTop: '2px dashed #27AE60', opacity: 0.7 }} />
          <span>ADCOP Pipeline (land)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', width: 24, height: 0, borderTop: '2.5px solid #27AE60' }} />
          <span>Fujairah Bypass <span style={{ color: '#27AE60', fontWeight: 700 }}>ACTIVE</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', marginLeft: 6 }}>
              Abu Dhabi crude piped inland to Fujairah, tankers load &amp; sail east
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#4a9eff' }} />
          <span>Port / Terminal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
          <span>Attack / Incident</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#FF7800' }} />
          <span style={{ color: '#FF7800', fontWeight: 600 }}>Recent (&lt;48h)</span>
        </div>
        {expOn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px dashed #F59E0B', background: 'transparent' }} />
            <span style={{ color: '#F59E0B' }}>Infrastructure capacity <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>(experimental)</span></span>
          </div>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>Hover markers for details</span>
      </div>
    </div>
  );
}

const FACTS = [
  { value: '~20%', desc: 'of global oil supply passes through daily' },
  { value: '~30%', desc: 'of global LNG trade' },
  { value: '3.5 mi', desc: 'wide at narrowest point (Musandam Peninsula)' },
  { value: 'Divided', desc: 'Iran controls north shore; Oman controls south shore' },
];

export default function HormuzView({ onBack }) {
  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }));
  const status = getStraitStatus(today.ships);
  const { data: marketData, history: marketHistory, gulf: gulfAIS, error: marketError, lastUpdated, loading: marketLoading, refetch } = useMarketData();
  const [activeLines, setActiveLines] = useState({ "BZ=F": true, "CL=F": true, "DUBAI": true, "NG=F": false });
  const [expOn, setExpOn] = useState(() => { try { return localStorage.getItem("ww3_experimental") === "true"; } catch { return false; } });
  const toggleExp = useCallback(() => setExpOn(v => { const next = !v; try { localStorage.setItem("ww3_experimental", String(next)); } catch {} return next; }), []);

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: DM_SANS, padding: '40px 20px', position: 'relative', overflowX: 'hidden' }}>
      {/* Background gradient orbs */}
      <div style={{ position: 'fixed', top: -200, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, #F59E0B11 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -200, left: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #3B82F611 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 24, fontFamily: DM_SANS }}
        >
          ← Back to Dashboard
        </button>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 20 }}>
          Hormuz Watch
        </h1>

        {/* Strait Status Banner */}
        <div style={{
          background: status.bg, border: `1px solid ${status.border}`, borderRadius: GLASS_RADIUS,
          padding: '16px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: status.color, flexShrink: 0, boxShadow: `0 0 12px ${status.color}` }} />
          <div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: status.color }}>{status.label}</span>
            <span style={{ fontSize: '0.9rem', color: SUBTEXT, marginLeft: 10 }}>— {status.desc}</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard label="Ships Today" value={today.ships} color={today.ships === 0 ? '#C0392B' : undefined} />
          <StatCard label="Tankers Today" value={today.tankers} color={today.tankers === 0 ? '#C0392B' : undefined} />
          <StatCard label="Oil Blocked" value={`${(20.5 - today.oil_mbpd).toFixed(1)} mb/d`} color="#C0392B" unit="million barrels per day" />
          {gulfAIS && gulfAIS.ships !== null && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '12px 18px', minWidth: 140 }}>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                AIS Live — Gulf
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#F59E0B' }}>
                {gulfAIS.ships.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                vessels detected · {gulfAIS.tankers} tankers
              </div>
              {gulfAIS.sampled_at && (
                <div style={{ fontSize: 10, color: '#4B5563', marginTop: 4 }}>
                  sampled {new Date(gulfAIS.sampled_at).toUTCString().slice(0,22)}
                </div>
              )}
            </div>
          )}
          <StatCard label="Days Since Closure" value={closureDays} color="#C0392B" />
        </div>

        {/* Chart */}
        <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 32 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" stroke={GLASS_BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} />
              <YAxis stroke={GLASS_BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} />
              <RTooltip contentStyle={{ background: '#0D1525', border: `1px solid ${GLASS_BORDER}`, borderRadius: 6, color: TEXT }} />
              <Legend />
              <ReferenceLine x="02-28" stroke="#C0392B" strokeDasharray="4 4" label={{ value: 'Feb 28', fill: '#C0392B', fontSize: 11 }} />
              <Line type="monotone" dataKey="ships" stroke={ACCENT} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tankers" stroke="#4a9eff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hormuz Map */}
        <HormuzMap />

        {/* Market Impact Panel */}
        <MarketPanel
          data={marketData}
          error={marketError}
          lastUpdated={lastUpdated}
          loading={marketLoading}
          refetch={refetch}
        />

        {/* Price History Chart */}
        {marketHistory && (() => {
          const PRICE_SYMBOLS = [
            { key: 'BZ=F', name: 'Brent', color: ACCENT, axis: 'crude' },
            { key: 'CL=F', name: 'WTI', color: '#4a9eff', axis: 'crude' },
            { key: 'DUBAI', name: 'Dubai', color: '#E74C3C', axis: 'crude' },
            { key: 'NG=F', name: 'Nat Gas', color: '#10B981', axis: 'gas' },
          ];
          // Merge all dates into a unified dataset
          const dateMap = {};
          for (const s of PRICE_SYMBOLS) {
            for (const pt of (marketHistory[s.key] || [])) {
              if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
              dateMap[pt.date][s.key] = pt.close;
            }
          }
          const priceData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
          // Show ~6 tick labels
          const tickInterval = Math.max(1, Math.floor(priceData.length / 6));
          const tickFormatter = (val, idx) => idx % tickInterval === 0 ? val.slice(5) : '';

          const gasActive = activeLines['NG=F'];
          const crudeActive = activeLines['BZ=F'] || activeLines['CL=F'] || activeLines['DUBAI'];

          return (
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 32 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, color: ACCENT }}>Price History (30 Days)</h3>
              {/* Toggle buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {PRICE_SYMBOLS.map(s => {
                  const active = activeLines[s.key];
                  return (
                    <button
                      key={s.key}
                      onClick={() => setActiveLines(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      style={{
                        background: active ? s.color : 'rgba(255,255,255,0.06)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${active ? s.color : 'rgba(255,255,255,0.15)'}`,
                        borderRadius: 6,
                        padding: '4px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: DM_SANS,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={priceData}>
                  <XAxis dataKey="date" stroke={GLASS_BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} tickFormatter={tickFormatter} />
                  <YAxis yAxisId="crude" stroke={GLASS_BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} hide={!crudeActive} />
                  <YAxis yAxisId="gas" orientation="right" stroke={GLASS_BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} hide={!gasActive} />
                  <RTooltip contentStyle={{ background: '#0D1525', border: `1px solid ${GLASS_BORDER}`, borderRadius: 6, color: TEXT }} />
                  <Legend />
                  <ReferenceLine yAxisId="crude" x="2026-02-28" stroke="#C0392B" strokeDasharray="4 4" label={{ value: 'War Start', fill: '#C0392B', fontSize: 11 }} />
                  {PRICE_SYMBOLS.filter(s => activeLines[s.key]).map(s => (
                    <Line key={s.key} yAxisId={s.axis} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {gasActive && crudeActive && (
                <div style={{ fontSize: '0.72rem', color: SUBTEXT, marginTop: 8, fontStyle: 'italic' }}>
                  Note: Natural Gas ($/MMBtu) uses a different scale — compare separately
                </div>
              )}
            </div>
          );
        })()}

        {/* Chokepoint Facts */}
        <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 32 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: ACCENT }}>Chokepoint Facts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {FACTS.map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`, borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: ACCENT, marginBottom: 4 }}>{f.value}</div>
                <div style={{ fontSize: '0.8rem', color: SUBTEXT, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS, padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, color: ACCENT }}>Recent Incidents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {intel.map((item, i) => {
              const { timestamp, body } = parseIntelItem(item);
              return (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`, borderRadius: 8,
                  padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M12 2L1 21h22L12 2z" fill="none" stroke="#F59E0B" strokeWidth="2" />
                    <path d="M12 9v5M12 16v1" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div style={{ flex: 1 }}>
                    {timestamp && <div style={{ fontSize: '0.75rem', color: '#C0392B', fontWeight: 700, marginBottom: 4 }}>{timestamp}</div>}
                    <div style={{ fontSize: '0.85rem', color: TEXT, lineHeight: 1.5 }}>{body}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: '0.65rem', color: SUBTEXT, background: 'rgba(255,255,255,0.06)',
                        border: `1px solid ${GLASS_BORDER}`, borderRadius: 4, padding: '2px 8px'
                      }}>Source: OSINT</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Global footer */}
      <div style={{ textAlign: 'center', marginTop: 32, paddingBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={toggleExp} style={{
          background: '#FFFFFF0A', backdropFilter: 'blur(10px)',
          border: expOn ? '1px solid #F59E0B44' : '1px solid #FFFFFF11',
          color: expOn ? '#F59E0B' : 'rgba(255,255,255,0.5)',
          borderRadius: 100, padding: '4px 12px', cursor: 'pointer',
          fontSize: 11, fontWeight: 500, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 4
        }}>
          ⚗️ {expOn ? 'Experimental: ON' : 'Experimental'}
        </button>
        <a href="https://x.com/the_seraya" target="_blank" rel="noopener noreferrer"
          style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 1200 1227" fill="currentColor"><path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284zM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854z"/></svg>
          @the_seraya
        </a>
      </div>
    </div>
  );
}
