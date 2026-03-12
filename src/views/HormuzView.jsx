import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import data from '../data/hormuz.json';

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
