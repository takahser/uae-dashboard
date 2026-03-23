import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip, Legend } from 'recharts';

const COLORS = {
  DGS10: '#F59E0B',
  IRLTLT01DEM156N: '#60A5FA',
  IRLTLT01GBM156N: '#FCD34D',
  IRLTLT01JPM156N: '#9CA3AF',
};

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

export default function BondChart({ data }) {
  if (!data?.series) return null;

  // Merge all series into unified date-keyed rows
  const dateMap = {};
  for (const s of data.series) {
    for (const pt of s.data) {
      if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
      dateMap[pt.date][s.id] = pt.value;
    }
  }
  const chartData = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => ({ ...row, dateLabel: formatDate(row.date) }));

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
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 16 }}>
        Since Feb 28 2026 war start
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
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}
          />
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
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
