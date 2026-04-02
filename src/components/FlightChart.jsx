import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip } from 'recharts';

const AIRPORTS = [
  { key: 'DXB', name: 'Dubai (DXB)', file: 'data-flights-dxb.json', color: '#EF4444' },
  { key: 'AUH', name: 'Abu Dhabi (AUH)', file: 'data-flights-auh.json', color: '#3B82F6' },
  { key: 'DWC', name: 'Al Maktoum (DWC)', file: 'data-flights-dwc.json', color: '#10B981' },
  { key: 'MCT', name: 'Muscat (MCT)', file: 'data-flights-mct.json', color: '#F59E0B' },
  { key: 'DOH', name: 'Doha (DOH)', file: 'data-flights-doh.json', color: '#8B5CF6' },
  { key: 'TLV', name: 'Tel Aviv (TLV)', file: 'data-flights-tlv.json', color: '#EC4899' },
  { key: 'JED', name: 'Jeddah (JED)', file: 'data-flights-jed.json', color: '#8B5CF6' },
  { key: 'RUH', name: 'Riyadh (RUH)', file: 'data-flights-ruh.json', color: '#EC4899' },
  { key: 'IKA', name: 'Tehran (IKA)', file: 'data-flights-ika.json', color: '#06B6D4' },
];

const FULL_DATA_AIRPORTS = new Set(['DXB', 'AUH', 'DWC', 'MCT', 'DOH']);

const TIMEFRAMES = [
  { key: '1W', days: 7 },
  { key: '2W', days: 14 },
  { key: '1M', days: 30 },
  { key: 'ALL', days: null },
];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#050B1A', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, fontSize: 12, marginBottom: 2 }}>
          {p.name}: {p.value != null ? p.value.toLocaleString() : 'N/A'}
        </div>
      ))}
    </div>
  );
}

const btnBase = {
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
};

const btnActive = {
  ...btnBase,
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  borderColor: 'rgba(255,255,255,0.4)',
};

export default function FlightChart() {
  const [airportData, setAirportData] = useState({});
  const [viewMode, setViewMode] = useState('combined');
  const [timeframe, setTimeframe] = useState('ALL');
  const [visible, setVisible] = useState(
    Object.fromEntries(AIRPORTS.map(a => [a.key, FULL_DATA_AIRPORTS.has(a.key)]))
  );

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    AIRPORTS.forEach(a => {
      fetch(base + a.file)
        .then(r => r.ok ? r.json() : null)
        .then(json => {
          if (json?.daily) {
            setAirportData(prev => ({ ...prev, [a.key]: json.daily }));
          }
        })
        .catch(() => {});
    });
  }, []);

  // Airports with only 1 data point can't render a meaningful chart line
  const limitedAirports = useMemo(() => {
    const limited = [];
    for (const a of AIRPORTS) {
      const daily = airportData[a.key];
      if (daily && daily.length <= 1) limited.push(a.key);
    }
    return limited;
  }, [airportData]);

  const chartData = useMemo(() => {
    const dateMap = {};
    for (const a of AIRPORTS) {
      if (limitedAirports.includes(a.key)) continue;
      for (const pt of (airportData[a.key] || [])) {
        if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
        dateMap[pt.date][`${a.key}_dep`] = pt.departures;
        dateMap[pt.date][`${a.key}_arr`] = pt.arrivals;
        dateMap[pt.date][`${a.key}_total`] = pt.total;
      }
    }
    let rows = Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => ({ ...row, dateLabel: formatDate(row.date) }));

    const tf = TIMEFRAMES.find(t => t.key === timeframe);
    if (tf?.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - tf.days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      rows = rows.filter(row => row.date >= cutoffStr);
    }
    return rows;
  }, [airportData, timeframe, limitedAirports]);

  const warLabel = formatDate('2026-02-28');

  const toggleAirport = (key) => {
    if (limitedAirports.includes(key)) return;
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (Object.keys(airportData).length === 0) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.11)',
      borderRadius: 16,
      padding: 20,
    }}>
      <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '0.05em', marginBottom: 2 }}>
        AIRPORT FLIGHT VOLUME
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
        Daily departures &amp; arrivals per airport since Feb 18
      </div>

      {/* View mode + Timeframe selectors */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['combined', 'split'].map(mode => (
            <button
              key={mode}
              style={viewMode === mode ? btnActive : btnBase}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'combined' ? 'Combined' : 'Split'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TIMEFRAMES.map(t => (
            <button
              key={t.key}
              style={timeframe === t.key ? btnActive : btnBase}
              onClick={() => setTimeframe(t.key)}
            >
              {t.key}
            </button>
          ))}
        </div>
      </div>

      {/* Airport toggles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {AIRPORTS.map(a => {
          const isLimited = limitedAirports.includes(a.key);
          return (
            <div
              key={a.key}
              onClick={() => toggleAirport(a.key)}
              title={isLimited ? 'Limited data — not enough points to chart' : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                cursor: isLimited ? 'default' : 'pointer',
                fontSize: 11,
                opacity: isLimited ? 0.25 : (visible[a.key] ? 1 : 0.35),
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: a.color,
                display: 'inline-block',
              }} />
              {a.name}
              {isLimited && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>(Limited data)</span>}
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <RTooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={warLabel}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{ value: 'War start', fill: '#EF4444', fontSize: 10, position: 'top' }}
          />
          {AIRPORTS.filter(a => !limitedAirports.includes(a.key)).map(a =>
            viewMode === 'combined' ? (
              <Line
                key={`${a.key}_total`}
                type="monotone"
                dataKey={`${a.key}_total`}
                name={a.name}
                stroke={a.color}
                strokeWidth={2}
                dot={false}
                connectNulls
                hide={!visible[a.key]}
              />
            ) : [
              <Line
                key={`${a.key}_dep`}
                type="monotone"
                dataKey={`${a.key}_dep`}
                name={`${a.name} Dep`}
                stroke={a.color}
                strokeWidth={2}
                dot={false}
                connectNulls
                hide={!visible[a.key]}
              />,
              <Line
                key={`${a.key}_arr`}
                type="monotone"
                dataKey={`${a.key}_arr`}
                name={`${a.name} Arr`}
                stroke={a.color}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
                hide={!visible[a.key]}
              />,
            ]
          )}
        </LineChart>
      </ResponsiveContainer>

      {viewMode === 'split' && (
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          <span>— Solid = Departures</span>
          <span>- - Dashed = Arrivals</span>
        </div>
      )}
    </div>
  );
}
