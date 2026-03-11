import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import data from '../data/hormuz.json';

const today = data[data.length - 1];
const closureDays = data.filter((d) => d.status === 'critical').length;

const intel = [
  'Mar 11: 3 ships struck near Hormuz — Thai Mayuree Naree on fire, 3 crew missing',
  'Mar 11: Iran planting mines; US Navy refusing escort requests',
  'Mar 11: Iran threatens $200/barrel, switches to continuous strikes doctrine',
];

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 10, padding: '20px 16px', flex: 1, minWidth: 140 }}>
      <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: color || '#E8E8E8' }}>{value}</div>
    </div>
  );
}

export default function HormuzView({ onBack }) {
  const chartData = data.map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#E8E8E8', padding: '40px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: '#C4A135', cursor: 'pointer', fontSize: '0.95rem', marginBottom: 24 }}
        >
          ← Back
        </button>

        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 24 }}>
          🛢️ Hormuz Watch
        </h1>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
          <StatCard label="Ships Today" value={today.ships} color={today.ships === 0 ? '#ff4444' : '#E8E8E8'} />
          <StatCard label="Tankers Today" value={today.tankers} color={today.tankers === 0 ? '#ff4444' : '#E8E8E8'} />
          <StatCard label="Oil Blocked" value={`${(20.5 - today.oil_mbpd).toFixed(1)} mb/d`} color="#ff4444" />
          <StatCard label="Days Since Closure" value={closureDays} color="#ff4444" />
        </div>

        {/* Chart */}
        <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 20, marginBottom: 32 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" stroke="#555" tick={{ fontSize: 11 }} />
              <YAxis stroke="#555" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6 }} />
              <Legend />
              <ReferenceLine x="02-28" stroke="#ff4444" strokeDasharray="4 4" label={{ value: 'Feb 28', fill: '#ff4444', fontSize: 11 }} />
              <Line type="monotone" dataKey="ships" stroke="#C4A135" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tankers" stroke="#4a9eff" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Intel */}
        <div style={{ background: '#111111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, color: '#C4A135' }}>Latest Intel</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {intel.map((item, i) => (
              <li key={i} style={{ color: '#ccc', fontSize: '0.9rem', padding: '8px 0', borderBottom: i < intel.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                • {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
