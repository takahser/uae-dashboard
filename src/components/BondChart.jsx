import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip, Legend } from 'recharts';

const COLORS = {
  DGS10: '#EF4444',
  IRLTLT01DEM156N: '#3B82F6',
  IRLTLT01GBM156N: '#10B981',
  IRLTLT01JPM156N: '#F59E0B',
};

const TIMEFRAMES = [
  { key: '1W', days: 7 },
  { key: '2W', days: 14 },
  { key: '1M', days: 30 },
  { key: 'ALL', days: null, fromWarStart: true },
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
          {p.name}: {p.value?.toFixed(2)}%
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

export default function BondChart({ data }) {
  if (!data?.series) return null;

  const [timeframe, setTimeframe] = useState('1M');
  const [visible, setVisible] = useState(() =>
    Object.fromEntries(data.series.map(s => [s.id, true]))
  );

  const toggleSeries = (id) => {
    setVisible(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Merge all series into unified date-keyed rows
  const dateMap = {};
  for (const s of data.series) {
    for (const pt of s.data) {
      if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
      dateMap[pt.date][s.id] = pt.value;
    }
  }
  let chartData = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => ({ ...row, dateLabel: formatDate(row.date) }));

  // Apply timeframe filter
  const tf = TIMEFRAMES.find(t => t.key === timeframe);
  if (tf?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tf.days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    chartData = chartData.filter(row => row.date >= cutoffStr);
  } else if (tf?.fromWarStart && data.warStart) {
    // "ALL" means all war-period data (from warStart), not full historical pre-war data.
    // This ensures the ALL view and shorter timeframes show consistent data ranges
    // and the y-axis scale reflects only the war period.
    chartData = chartData.filter(row => row.date >= data.warStart);
  }

  const warLabel = formatDate(data.warStart);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.11)',
      borderRadius: 16,
      padding: 20,
    }}>
      <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '0.05em', marginBottom: 2 }}>
        10Y GOVERNMENT BOND YIELDS
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
        Since Feb 28 2026 war start
      </div>

      {/* Timeframe selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
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

      {/* Series toggles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {data.series.map(s => (
          <div
            key={s.id}
            onClick={() => toggleSeries(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'pointer', fontSize: 11,
              opacity: visible[s.id] ? 1 : 0.35,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: COLORS[s.id],
              display: 'inline-block',
            }} />
            {s.name}
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            tickLine={false}
            tickFormatter={v => v.toFixed(2)}
            domain={['auto', 'auto']}
          />
          <RTooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={warLabel}
            stroke="#EF4444"
            strokeDasharray="4 4"
            label={{ value: 'War start', fill: '#EF4444', fontSize: 10, position: 'top' }}
          />
          {data.series.map(s => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.name}
              stroke={COLORS[s.id]}
              strokeWidth={2}
              dot={false}
              connectNulls
              hide={!visible[s.id]}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
