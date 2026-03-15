import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip, Legend } from 'recharts';
import { useState } from 'react';
import data from '../data/hormuz.json';

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
  { pos: [25.8, 57.2], label: "Mar 11: Thai Mayuree Naree struck — fire, 3 crew missing", date: "2026-03-11" },
  { pos: [26.1, 56.9], label: "Mar 9: Container vessel Meridian Star hit by drone", date: "2026-03-09" },
  { pos: [25.6, 58.1], label: "Mar 7: Oil tanker Gulf Pioneer attacked, diverted to Fujairah", date: "2026-03-07" },
  { pos: [26.4, 56.4], label: "Mar 5: Mine detected near shipping lane — US Navy warning issued", date: "2026-03-05" },
];

const GEO_LABELS = [
  { pos: [27.0, 56.8], label: "\u{1F1EE}\u{1F1F7} Iran \u2014 controls north shore" },
  { pos: [26.2, 56.3], label: "\u{1F1F4}\u{1F1F2} Oman \u2014 controls south shore" },
  { pos: [26.8, 55.5], label: "Persian Gulf \u2192" },
  { pos: [25.5, 58.0], label: "\u2190 Gulf of Oman" },
];

const PORTS = [
  { pos: [27.18, 56.27], label: "Bandar Abbas \u2014 Iran main port & naval base", country: "Iran" },
  { pos: [24.98, 55.07], label: "Jebel Ali (UAE) \u2014 World largest man-made harbour", country: "UAE" },
  { pos: [25.13, 56.36], label: "Fujairah (UAE) \u2014 Major oil terminal & bunkering hub", country: "UAE" },
  { pos: [25.34, 56.36], label: "Khor Fakkan (UAE) \u2014 Key container port, Gulf of Oman", country: "UAE" },
  { pos: [23.62, 58.59], label: "Muscat (Oman) \u2014 Main port", country: "Oman" },
  { pos: [24.35, 56.64], label: "Sohar (Oman) \u2014 Oil & industrial port", country: "Oman" },
];

const SVG_W = 800;
const SVG_H = 480;
const MAP_BOUNDS = { latMin: 23.5, latMax: 27.5, lngMin: 54.5, lngMax: 60.0 };

function toSVG(lat, lng) {
  return {
    x: ((lng - MAP_BOUNDS.lngMin) / (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin)) * SVG_W,
    y: ((MAP_BOUNDS.latMax - lat) / (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin)) * SVG_H,
  };
}

// Simplified coastline polygons for context
const IRAN_COAST = [
  [27.5,54.5],[27.5,60.0],[26.8,60.0],[26.6,58.5],[26.3,57.8],[26.5,57.0],
  [26.7,56.5],[27.0,56.0],[27.2,55.5],[27.5,54.5],
];
const OMAN_UAE_COAST = [
  [23.5,54.5],[24.0,54.5],[24.5,54.8],[25.0,55.0],[25.4,55.4],[25.6,56.0],
  [25.8,56.3],[26.2,56.3],[26.4,56.5],[26.0,56.8],[25.6,57.0],[25.3,57.5],
  [25.0,58.0],[24.5,58.5],[24.0,59.0],[23.5,60.0],[23.5,54.5],
];

function makePath(pts) {
  return 'M' + pts.map(([lat, lng]) => { const p = toSVG(lat, lng); return `${p.x},${p.y}`; }).join(' L') + ' Z';
}

function HormuzMap() {
  const [hover, setHover] = useState(null);

  const chokeA = toSVG(26.35, 56.25);
  const chokeB = toSVG(26.60, 56.95);

  return (
    <div style={{ position: 'relative', marginBottom: 32 }}>
      <style>{`
        @keyframes pulse-attack {
          0% { opacity: 0.85; }
          50% { opacity: 0.35; }
          100% { opacity: 0.85; }
        }
      `}</style>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, color: TEXT }}>
        Strait of Hormuz — Live Threat Map
      </h3>
      <div style={{ background: '#070E1E', borderRadius: GLASS_RADIUS, border: `1px solid ${GLASS_BORDER}`, overflow: 'hidden', position: 'relative' }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Water background */}
          <rect width={SVG_W} height={SVG_H} fill="#0a1628" />

          {/* Grid lines */}
          {[55, 56, 57, 58, 59].map(lng => {
            const p = toSVG(25, lng);
            return <line key={`g-lng-${lng}`} x1={p.x} y1={0} x2={p.x} y2={SVG_H} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />;
          })}
          {[24, 25, 26, 27].map(lat => {
            const p = toSVG(lat, 57);
            return <line key={`g-lat-${lat}`} x1={0} y1={p.y} x2={SVG_W} y2={p.y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />;
          })}

          {/* Coordinate ticks */}
          {[55, 56, 57, 58, 59].map(lng => {
            const p = toSVG(MAP_BOUNDS.latMin, lng);
            return <text key={`t-lng-${lng}`} x={p.x} y={SVG_H - 6} fill="rgba(255,255,255,0.2)" fontSize={10} textAnchor="middle">{lng}°E</text>;
          })}
          {[24, 25, 26, 27].map(lat => {
            const p = toSVG(lat, MAP_BOUNDS.lngMin);
            return <text key={`t-lat-${lat}`} x={8} y={p.y + 3} fill="rgba(255,255,255,0.2)" fontSize={10}>{lat}°N</text>;
          })}

          {/* Land masses */}
          <path d={makePath(IRAN_COAST)} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          <path d={makePath(OMAN_UAE_COAST)} fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

          {/* Chokepoint line */}
          <line x1={chokeA.x} y1={chokeA.y} x2={chokeB.x} y2={chokeB.y}
            stroke="#ff4444" strokeWidth={2} strokeDasharray="8 6" />
          <circle cx={(chokeA.x + chokeB.x) / 2} cy={(chokeA.y + chokeB.y) / 2}
            r={30} fill="rgba(255,68,68,0.12)" stroke="#ff4444" strokeWidth={0.5} />
          <text x={(chokeA.x + chokeB.x) / 2} y={(chokeA.y + chokeB.y) / 2 - 38}
            fill="#ff4444" fontSize={9} textAnchor="middle" fontWeight={600}>
            Narrowest Point — ~3.5 mi
          </text>

          {/* Geo labels */}
          {GEO_LABELS.map((g, i) => {
            const p = toSVG(g.pos[0], g.pos[1]);
            return <text key={`geo-${i}`} x={p.x} y={p.y} fill="rgba(255,255,255,0.35)" fontSize={10} fontWeight={600} textAnchor="middle">{g.label}</text>;
          })}

          {/* Port markers */}
          {PORTS.map((p, i) => {
            const pt = toSVG(p.pos[0], p.pos[1]);
            return (
              <g key={`port-${i}`}
                onMouseEnter={() => setHover({ x: pt.x, y: pt.y, text: p.label, type: 'port' })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={pt.x} cy={pt.y} r={6} fill="#4a9eff" fillOpacity={0.8} stroke="#4a9eff" strokeWidth={1} />
                <circle cx={pt.x} cy={pt.y} r={10} fill="transparent" />
              </g>
            );
          })}

          {/* Attack markers */}
          {ATTACKS.map((a, i) => {
            const pt = toSVG(a.pos[0], a.pos[1]);
            return (
              <g key={`atk-${i}`}
                onMouseEnter={() => setHover({ x: pt.x, y: pt.y, text: a.label, type: 'attack' })}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle cx={pt.x} cy={pt.y} r={12} fill="rgba(255,68,68,0.2)" stroke="none" style={{ animation: 'pulse-attack 2s ease-in-out infinite' }} />
                <circle cx={pt.x} cy={pt.y} r={6} fill="#ff4444" fillOpacity={0.9} stroke="#ff4444" strokeWidth={1} />
                <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
              </g>
            );
          })}

          {/* Hover tooltip */}
          {hover && (
            <g>
              <rect x={hover.x - 120} y={hover.y - 38} width={240} height={26} rx={4}
                fill="rgba(5,11,26,0.95)" stroke={hover.type === 'attack' ? '#ff4444' : '#4a9eff'} strokeWidth={1} />
              <text x={hover.x} y={hover.y - 21} fill={TEXT} fontSize={9.5} textAnchor="middle" fontWeight={500}>
                {hover.text.length > 55 ? hover.text.slice(0, 55) + '…' : hover.text}
              </text>
            </g>
          )}
        </svg>

        {/* Legend overlay */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(5,11,26,0.9)', border: `1px solid ${GLASS_BORDER}`,
          borderRadius: 6, padding: '6px 12px', fontSize: '0.7rem', color: SUBTEXT
        }}>
          <span style={{ color: '#ff4444' }}>&#9679;</span> Ship attack &nbsp;
          <span style={{ color: '#ff4444' }}>- -</span> Chokepoint &nbsp;
          <span style={{ color: '#4a9eff' }}>&#9679;</span> Port
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
