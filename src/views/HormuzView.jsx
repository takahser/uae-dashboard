import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip, Legend } from 'recharts';
import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet';
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
  'Mar 18: Missile strikes on Aramco refinery in Riyadh — Saudi Arabia capital hit (via @IranObserver0)',
  'Mar 18: South Pars gas field (world\'s largest) struck — multiple processing phases offline, fires reported',
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

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS, padding: '20px 16px', flex: 1, minWidth: 140, borderTop: `3px solid ${color || ACCENT}` }}>
      <div style={{ color: SUBTEXT, fontSize: '0.8rem', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || TEXT }}>{value}</div>
    </div>
  );
}

const ATTACKS = [
  { pos: [26.2, 56.5], label: "Mar 18: South Pars gas field struck — multiple processing phases offline", date: "2026-03-18" },
  { pos: [24.68, 46.72], label: "Mar 18: Missile strikes on Aramco refinery — Riyadh, Saudi Arabia", date: "2026-03-18" },
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

const HORMUZ_ROUTE = [
  [24.0, 53.0],
  [25.5, 56.5],
  [26.5, 56.8],
  [25.5, 58.5],
  [23.5, 60.5],
];

const FUJAIRAH_BYPASS = [
  [24.0, 53.0],
  [25.1, 56.3],
  [25.5, 58.5],
  [23.5, 60.5],
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
            pathOptions={{ color: "#EF4444", weight: 2, dashArray: "8 6", opacity: 0.8 }}
          />

          {/* Fujairah Bypass — ACTIVE */}
          <Polyline
            positions={FUJAIRAH_BYPASS}
            pathOptions={{ color: "#27AE60", weight: 2.5, opacity: 0.9 }}
          />

          {/* Port markers */}
          {PORTS.map((p, i) => (
            <CircleMarker
              key={`port-${i}`}
              center={p.pos}
              radius={6}
              pathOptions={{ color: '#4a9eff', fillColor: '#4a9eff', fillOpacity: 0.8, weight: 1 }}
            />
          ))}

          {/* Attack markers */}
          {ATTACKS.filter(a =>
            a.pos[0] >= MAP_VIEW_BOUNDS.latMin && a.pos[0] <= MAP_VIEW_BOUNDS.latMax &&
            a.pos[1] >= MAP_VIEW_BOUNDS.lngMin && a.pos[1] <= MAP_VIEW_BOUNDS.lngMax
          ).map((a, i) => (
            <CircleMarker
              key={`atk-${i}`}
              center={a.pos}
              radius={8}
              pathOptions={{ color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.85, weight: 1 }}
            />
          ))}
        </MapContainer>

        {/* Route legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
          background: 'rgba(5,11,26,0.85)', backdropFilter: 'blur(12px)',
          border: `1px solid ${GLASS_BORDER}`, borderRadius: 8,
          padding: '10px 16px', fontSize: '0.78rem', color: SUBTEXT, lineHeight: 1.8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#EF4444', fontSize: '0.9rem' }}>&#x1F534;</span>
            <span style={{ color: '#EF4444', letterSpacing: 2 }}>── ──</span>
            <span>Hormuz Transit (CLOSED)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#27AE60', fontSize: '0.9rem' }}>&#x1F7E2;</span>
            <span style={{ color: '#27AE60', letterSpacing: 1 }}>──────</span>
            <span>Fujairah Bypass (ACTIVE)</span>
          </div>
        </div>
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
  const { data: marketData, history: marketHistory, error: marketError, lastUpdated, loading: marketLoading, refetch } = useMarketData();
  const [activeLines, setActiveLines] = useState({ "BZ=F": true, "CL=F": true, "DUBAI": true, "NG=F": false });

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
          <StatCard label="Oil Blocked" value={`${(20.5 - today.oil_mbpd).toFixed(1)} mb/d`} color="#C0392B" />
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
    </div>
  );
}
