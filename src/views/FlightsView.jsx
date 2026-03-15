import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const BG = '#050B1A';
const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const GLASS_BLUR = 'blur(40px)';
const GLASS_RADIUS = 16;
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const ACCENT = '#F59E0B';
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const AIRPORTS = [
  { code: 'DXB', name: 'Dubai International', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', file: 'data-flights-dxb.json' },
  { code: 'AUH', name: 'Abu Dhabi International (Zayed)', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', file: 'data-flights-auh.json' },
  { code: 'DWC', name: 'Al Maktoum (Dubai World Central)', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', file: 'data-flights-dwc.json' },
  { code: 'MCT', name: 'Muscat International', country: 'Oman', flag: '\u{1F1F4}\u{1F1F2}', file: 'data-flights-mct.json' },
  { code: 'DOH', name: 'Hamad International', country: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}', file: 'data-flights-doh.json' },
  { code: 'TLV', name: 'Ben Gurion', country: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', file: 'data-flights-tlv.json' },
];

const AIRPORT_COLORS = {
  DXB: '#F59E0B',
  AUH: '#3B82F6',
  DWC: '#8B5CF6',
  MCT: '#10B981',
  DOH: '#EF4444',
  TLV: '#60A5FA',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D1525',
      border: `1px solid ${GLASS_BORDER}`,
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: '0.75rem',
    }}>
      <div style={{ color: 'rgba(232,232,237,0.4)', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value != null ? `${p.value}%` : '—'}
        </div>
      ))}
    </div>
  );
};

function getStatus(capacity) {
  if (capacity <= 0) return { label: 'CLOSED', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
  if (capacity < 50) return { label: 'RESTRICTED', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' };
  return { label: 'OPERATIONAL', color: '#34D399', bg: 'rgba(52,211,153,0.15)' };
}

function AirportCard({ airport, data }) {
  const baseline = data?.baselineDailyAvg?.total || 0;
  const daily = data?.daily || [];
  const latest = daily.length > 0 ? daily[daily.length - 1] : null;
  const todayTotal = latest?.total ?? 0;
  const capacity = baseline > 0 ? Math.round((todayTotal / baseline) * 100) : 0;
  const status = getStatus(capacity);
  const lastUpdated = data?.lastUpdated;

  return (
    <div style={{
      background: CARD_BG,
      backdropFilter: GLASS_BLUR,
      border: `1px solid ${GLASS_BORDER}`,
      borderRadius: GLASS_RADIUS,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{airport.flag}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: TEXT }}>{airport.code}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: SUBTEXT }}>{airport.name}</div>
        <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginTop: 2 }}>{airport.country}</div>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: status.bg, borderRadius: 8, padding: '6px 12px', alignSelf: 'flex-start',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: status.color, letterSpacing: 0.5 }}>{status.label}</span>
      </div>

      {/* Flight count */}
      <div>
        <div style={{ fontSize: '0.75rem', color: SUBTEXT, marginBottom: 4 }}>Today vs Historical Avg</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: TEXT }}>{todayTotal.toLocaleString()}</span>
          <span style={{ fontSize: '0.8rem', color: SUBTEXT }}>/ {baseline.toLocaleString()}</span>
        </div>
      </div>

      {/* Capacity bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.7rem', color: SUBTEXT }}>Capacity</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: ACCENT }}>{capacity}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(capacity, 100)}%`,
            borderRadius: 4,
            background: `linear-gradient(90deg, ${ACCENT}, #D97706)`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: 'auto' }}>
          Updated: {new Date(lastUpdated).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}

export default function FlightsView({ onBack }) {
  const [airportData, setAirportData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      AIRPORTS.map(a =>
        fetch(`/${a.file}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      const map = {};
      AIRPORTS.forEach((a, i) => { map[a.code] = results[i]; });
      setAirportData(map);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: DM_SANS, padding: '40px 20px', position: 'relative', overflowX: 'hidden' }}>
      {/* Background gradient orbs */}
      <div style={{ position: 'fixed', top: -200, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, #F59E0B11 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -200, left: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #3B82F611 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 24, fontFamily: DM_SANS }}
        >
          ← Back to Dashboard
        </button>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
          GCC AIRPORT FLIGHT TRACKER
        </h1>
        <p style={{ fontSize: '0.85rem', color: SUBTEXT, marginBottom: 32 }}>
          Real-time flight operations across conflict-zone airports
        </p>

        {/* Airport grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: SUBTEXT }}>Loading flight data...</div>
        ) : (
          <div className="flights-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            <style>{`
              @media (max-width: 900px) {
                .flights-grid { grid-template-columns: repeat(2, 1fr) !important; }
              }
              @media (max-width: 600px) {
                .flights-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
            {AIRPORTS.map(a => (
              <AirportCard key={a.code} airport={a} data={airportData[a.code]} />
            ))}
          </div>
        )}

        {/* Capacity Over Time chart */}
        {!loading && (() => {
          // Build unified date list from all airports
          const dateSet = new Set();
          AIRPORTS.forEach(a => {
            (airportData[a.code]?.daily || []).forEach(d => dateSet.add(d.date));
          });
          const dates = [...dateSet].sort();

          const chartData = dates.map(date => {
            const row = { date: date.slice(5) }; // MM-DD
            AIRPORTS.forEach(a => {
              const d = airportData[a.code];
              if (!d) return;
              const baseline = d.baselineDailyAvg?.total || 0;
              const entry = (d.daily || []).find(x => x.date === date);
              row[a.code] = entry && baseline > 0
                ? Math.round((entry.total / baseline) * 100)
                : null;
            });
            return row;
          });

          return (
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: GLASS_BLUR,
              border: `1px solid ${GLASS_BORDER}`,
              borderRadius: GLASS_RADIUS,
              padding: 24,
              marginTop: 24,
            }}>
              <div style={{
                fontSize: 11,
                letterSpacing: 2,
                color: 'rgba(232,232,237,0.4)',
                textTransform: 'uppercase',
                marginBottom: 16,
                fontWeight: 600,
              }}>
                CAPACITY OVER TIME
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(232,232,237,0.4)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(232,232,237,0.4)', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                    domain={[0, 'auto']}
                    tickFormatter={v => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'rgba(232,232,237,0.4)' }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="rgba(245,158,11,0.4)"
                    strokeDasharray="4 4"
                    label={{ value: 'Pre-war baseline', fill: 'rgba(245,158,11,0.4)', fontSize: 10, position: 'insideTopRight' }}
                  />
                  {AIRPORTS.map(a => (
                    <Line
                      key={a.code}
                      type="monotone"
                      dataKey={a.code}
                      name={a.code}
                      stroke={AIRPORT_COLORS[a.code]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Source note */}
        <div style={{ textAlign: 'center', marginTop: 32, fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
          Data sourced from OpenSky Network / official airport announcements
        </div>
      </div>
    </div>
  );
}
