import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, CircleMarker, Tooltip as MapTooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import data from '../data/hormuz.json';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: null, iconUrl: null, shadowUrl: null });

const BG = '#0A0F1E';
const CARD_BG = '#0F1829';
const BORDER = '#1A2840';
const TEXT = '#E8EDF5';
const SUBTEXT = '#8899BB';
const GOLD = '#C4A135';

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
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '20px 16px', flex: 1, minWidth: 140, borderTop: `3px solid ${color || GOLD}` }}>
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
  { pos: [27.0, 56.8], label: "🇮🇷 Iran — controls north shore" },
  { pos: [26.2, 56.3], label: "🇴🇲 Oman — controls south shore" },
  { pos: [26.8, 55.5], label: "Persian Gulf →" },
  { pos: [25.5, 58.0], label: "← Gulf of Oman" },
];

const PORTS = [
  { pos: [27.18, 56.27], label: "🏭 Bandar Abbas — Iran main port & naval base", country: "Iran" },
  { pos: [24.98, 55.07], label: "🏭 Jebel Ali (UAE) — World largest man-made harbour", country: "UAE" },
  { pos: [25.13, 56.36], label: "⛽ Fujairah (UAE) — Major oil terminal & bunkering hub", country: "UAE" },
  { pos: [25.34, 56.36], label: "🚢 Khor Fakkan (UAE) — Key container port, Gulf of Oman", country: "UAE" },
  { pos: [23.62, 58.59], label: "🏭 Muscat (Oman) — Main port", country: "Oman" },
  { pos: [24.35, 56.64], label: "⛽ Sohar (Oman) — Oil & industrial port", country: "Oman" },
];

function HormuzMap() {
  return (
    <div style={{ position: 'relative', marginBottom: 32 }}>
      <style>{`
        @keyframes pulse-attack {
          0% { opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { opacity: 0.8; }
        }
        .attack-marker {
          animation: pulse-attack 2s ease-in-out infinite;
        }
      `}</style>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12, color: TEXT }}>
        🗺️ Strait of Hormuz — Live Threat Map
      </h3>
      <MapContainer
        center={[26.0, 56.5]}
        zoom={7}
        style={{ height: 420, borderRadius: 10 }}
        scrollWheelZoom={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {/* Chokepoint line */}
        <Polyline
          positions={[[26.35, 56.25], [26.60, 56.95]]}
          pathOptions={{ color: '#ff4444', dashArray: '8 6', weight: 2 }}
        >
          <MapTooltip sticky>Narrowest Point — ~3.5 miles</MapTooltip>
        </Polyline>

        {/* Chokepoint zone */}
        <Circle
          center={[26.48, 56.6]}
          radius={8000}
          pathOptions={{ color: '#ff4444', fillColor: '#ff4444', fillOpacity: 0.15, weight: 1 }}
        />

        {/* Geographic labels */}
        {GEO_LABELS.map((g, i) => (
          <CircleMarker key={`geo-${i}`} center={g.pos} radius={0} pathOptions={{ opacity: 0 }}>
            <MapTooltip permanent direction="center" className="geo-label">
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{g.label}</span>
            </MapTooltip>
          </CircleMarker>
        ))}

        {/* Attack markers */}
        {ATTACKS.map((a, i) => (
          <CircleMarker
            key={`atk-${i}`}
            center={a.pos}
            radius={8}
            pathOptions={{ color: '#ff4444', fillColor: '#ff4444', fillOpacity: 0.8 }}
            className="attack-marker"
          >
            <Popup>
              <span style={{ fontSize: '0.8rem', color: '#111' }}>{a.label}</span>
            </Popup>
          </CircleMarker>
        ))}
        {/* Port markers */}
        {PORTS.map((p, i) => (
          <CircleMarker
            key={`port-${i}`}
            center={p.pos}
            radius={7}
            pathOptions={{ color: '#4a9eff', fillColor: '#4a9eff', fillOpacity: 0.8 }}
          >
            <Popup>
              <span style={{ fontSize: '0.8rem', color: '#111' }}>{p.label}</span>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 1000,
        background: 'rgba(15,24,41,0.9)', border: `1px solid ${BORDER}`,
        borderRadius: 6, padding: '6px 12px', fontSize: '0.7rem', color: SUBTEXT
      }}>
        🔴 Ship attack &nbsp; ⚠️ Chokepoint zone &nbsp; 🔵 Port
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
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, padding: '40px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: GOLD, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 24 }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 20 }}>
          🛢️ Hormuz Watch
        </h1>

        {/* Strait Status Banner */}
        <div style={{
          background: status.bg, border: `1px solid ${status.border}`, borderRadius: 10,
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
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 32 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" stroke={BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} />
              <YAxis stroke={BORDER} tick={{ fontSize: 11, fill: SUBTEXT }} />
              <Tooltip contentStyle={{ background: '#0D1525', border: `1px solid ${BORDER}`, borderRadius: 6, color: TEXT }} />
              <Legend />
              <ReferenceLine x="02-28" stroke="#C0392B" strokeDasharray="4 4" label={{ value: 'Feb 28', fill: '#C0392B', fontSize: 11 }} />
              <Line type="monotone" dataKey="ships" stroke={GOLD} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tankers" stroke="#4a9eff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hormuz Map */}
        <HormuzMap />

        {/* Chokepoint Facts */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 32 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16, color: GOLD }}>Chokepoint Facts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {FACTS.map((f, i) => (
              <div key={i} style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: GOLD, marginBottom: 4 }}>{f.value}</div>
                <div style={{ fontSize: '0.8rem', color: SUBTEXT, lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Incidents */}
        <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, color: GOLD }}>Recent Incidents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {intel.map((item, i) => {
              const { timestamp, body } = parseIntelItem(item);
              return (
                <div key={i} style={{
                  background: BG, border: `1px solid ${BORDER}`, borderRadius: 8,
                  padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    {timestamp && <div style={{ fontSize: '0.75rem', color: '#C0392B', fontWeight: 700, marginBottom: 4 }}>{timestamp}</div>}
                    <div style={{ fontSize: '0.85rem', color: TEXT, lineHeight: 1.5 }}>{body}</div>
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        fontSize: '0.65rem', color: SUBTEXT, background: 'rgba(26,40,64,0.6)',
                        border: `1px solid ${BORDER}`, borderRadius: 4, padding: '2px 8px'
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
