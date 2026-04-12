import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip as RTooltip } from 'recharts';

const AIRPORTS = [
  { key: 'DXB', name: 'Dubai (DXB)', file: 'data-flights-dxb.json', color: '#EF4444' },
  { key: 'AUH', name: 'Abu Dhabi (AUH)', file: 'data-flights-auh.json', color: '#3B82F6' },
  { key: 'DWC', name: 'Al Maktoum (DWC)', file: 'data-flights-dwc.json', color: '#10B981' },
  { key: 'MCT', name: 'Muscat (MCT)', file: 'data-flights-mct.json', color: '#F59E0B' },
  { key: 'DOH', name: 'Doha (DOH)', file: 'data-flights-doh.json', color: '#8B5CF6' },
  { key: 'TLV', name: 'Tel Aviv (TLV)', file: 'data-flights-tlv.json', color: '#EC4899', experimental: true },
  { key: 'JED', name: 'Jeddah (JED)', file: 'data-flights-jed.json', color: '#8B5CF6' },
  { key: 'RUH', name: 'Riyadh (RUH)', file: 'data-flights-ruh.json', color: '#EC4899' },
  { key: 'IKA', name: 'Tehran (IKA)', file: 'data-flights-ika.json', color: '#06B6D4', experimental: true },
];

const CHART_AIRPORTS = AIRPORTS.filter(a => !a.experimental);

const FULL_DATA_AIRPORTS = new Set(['DXB', 'AUH', 'DWC', 'MCT', 'DOH']);

const CANCELLATION_AIRPORTS = CHART_AIRPORTS.map(a => ({ key: a.key, color: a.color, name: a.name }));

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

const TODAY = new Date().toISOString().slice(0, 10);

function renderTodayDot(color) {
  return (props) => {
    const { cx, cy, payload } = props;
    if (!payload?.isToday) return null;
    return <circle cx={cx} cy={cy} r={4} fill="#6B7280" stroke="#9CA3AF" strokeWidth={1} />;
  };
}

function CustomTooltip({ active, payload, label, todayDate }) {
  if (!active || !payload?.length) return null;
  const isToday = payload[0]?.payload?.date === TODAY;
  return (
    <div style={{ background: '#050B1A', border: `1px solid ${isToday ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 }}>{label}</div>
      {isToday && (
        <div style={{ color: '#9CA3AF', fontSize: 11, marginBottom: 6, fontStyle: 'italic' }}>
          ⚠ Partial estimate — day not yet complete
        </div>
      )}
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: isToday ? '#9CA3AF' : p.color, fontSize: 12, marginBottom: 2 }}>
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

function parseAirportsParam() {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const airportsParam = params.get('airports');
  if (!airportsParam?.trim()) return null;
  const requested = airportsParam.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
  const validCodes = new Set(AIRPORTS.map(a => a.key));
  const filtered = requested.filter(code => validCodes.has(code));
  return filtered.length > 0 ? new Set(filtered) : null;
}

export default function FlightChart() {
  const [airportData, setAirportData] = useState({});
  const [viewMode, setViewMode] = useState('combined');
  const [timeframe, setTimeframe] = useState('ALL');
  const [visible, setVisible] = useState(() => {
    const fromUrl = parseAirportsParam();
    if (fromUrl) {
      return Object.fromEntries(CHART_AIRPORTS.map(a => [a.key, fromUrl.has(a.key)]));
    }
    return Object.fromEntries(CHART_AIRPORTS.map(a => [a.key, FULL_DATA_AIRPORTS.has(a.key)]));
  });
  // DWC (Al Maktoum) is Dubai's primary cargo hub. None of our data sources
  // (AeroDataBox, OpenSky, FR24) provide cargo vs passenger breakdown per flight.
  // So we treat "cargo" as toggling DWC airport entirely, which is the best
  // approximation given available data.
  const [includeCargo, setIncludeCargo] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(
    Object.fromEntries(CHART_AIRPORTS.map(a => [a.key, true]))
  );
  const toggleCancel = (key) => setCancelVisible(v => ({ ...v, [key]: !v[key] }));

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
    for (const a of CHART_AIRPORTS) {
      const daily = airportData[a.key];
      if (daily && daily.length <= 1) limited.push(a.key);
    }
    return limited;
  }, [airportData]);

  const chartData = useMemo(() => {
    const dateMap = {};
    for (const a of CHART_AIRPORTS) {
      if (limitedAirports.includes(a.key)) continue;
      if (a.key === 'DWC' && !includeCargo) continue;
      for (const pt of (airportData[a.key] || [])) {
        if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
        dateMap[pt.date][`${a.key}_dep`] = pt.departures;
        dateMap[pt.date][`${a.key}_arr`] = pt.arrivals;
        dateMap[pt.date][`${a.key}_total`] = pt.total;
      }
    }
    let rows = Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => ({ ...row, dateLabel: formatDate(row.date), isToday: row.date === TODAY }));

    const tf = TIMEFRAMES.find(t => t.key === timeframe);
    if (tf?.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - tf.days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      rows = rows.filter(row => row.date >= cutoffStr);
    }
    return rows;
  }, [airportData, timeframe, limitedAirports, includeCargo]);

  const cancellationData = useMemo(() => {
    const dateMap = {};
    for (const a of CANCELLATION_AIRPORTS) {
      for (const pt of (airportData[a.key] || [])) {
        if (pt.cancelled == null) continue;
        if (!dateMap[pt.date]) dateMap[pt.date] = { date: pt.date };
        dateMap[pt.date][`${a.key}_cancelled`] = pt.cancelled;
      }
    }
    let rows = Object.values(dateMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(row => ({ ...row, dateLabel: formatDate(row.date), isToday: row.date === TODAY }));

    const tf = TIMEFRAMES.find(t => t.key === timeframe);
    if (tf?.days) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - tf.days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      rows = rows.filter(row => row.date >= cutoffStr);
    }
    return rows;
  }, [airportData, timeframe]);

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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeCargo}
            onChange={(e) => setIncludeCargo(e.target.checked)}
            style={{ accentColor: '#3B82F6' }}
          />
          Include DWC (cargo hub)
        </label>
      </div>

      {/* Airport toggles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {CHART_AIRPORTS.map(a => {
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
          {CHART_AIRPORTS.filter(a => !limitedAirports.includes(a.key)).map(a =>
            viewMode === 'combined' ? (
              <Line
                key={`${a.key}_total`}
                type="monotone"
                dataKey={`${a.key}_total`}
                name={a.name}
                stroke={a.color}
                strokeWidth={2}
                dot={renderTodayDot(a.color)}
                connectNulls
                hide={!visible[a.key] || (a.key === 'DWC' && !includeCargo)}
              />
            ) : [
              <Line
                key={`${a.key}_dep`}
                type="monotone"
                dataKey={`${a.key}_dep`}
                name={`${a.name} Dep`}
                stroke={a.color}
                strokeWidth={2}
                dot={renderTodayDot(a.color)}
                connectNulls
                hide={!visible[a.key] || (a.key === 'DWC' && !includeCargo)}
              />,
              <Line
                key={`${a.key}_arr`}
                type="monotone"
                dataKey={`${a.key}_arr`}
                name={`${a.name} Arr`}
                stroke={a.color}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={renderTodayDot(a.color)}
                connectNulls
                hide={!visible[a.key] || (a.key === 'DWC' && !includeCargo)}
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

      {/* Cancellations chart */}
      {cancellationData.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '0.05em', marginBottom: 2 }}>
            FLIGHT CANCELLATIONS
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 12 }}>
            Daily cancelled flights across all airports
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {CANCELLATION_AIRPORTS.map(a => (
              <div
                key={a.key}
                onClick={() => toggleCancel(a.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  cursor: 'pointer',
                  fontSize: 11,
                  opacity: cancelVisible[a.key] ? 1 : 0.35,
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: a.color,
                  display: 'inline-block',
                }} />
                {a.name}
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cancellationData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} />
              <RTooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={warLabel}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: 'War start', fill: '#EF4444', fontSize: 10, position: 'top' }}
              />
              {CANCELLATION_AIRPORTS.map(a => (
                <Bar
                  key={`${a.key}_cancelled`}
                  stackId="cancel"
                  dataKey={`${a.key}_cancelled`}
                  name={`${a.name} cancelled`}
                  fill={a.color}
                  hide={!cancelVisible[a.key]}
                >
                  {cancellationData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.isToday ? '#6B7280' : a.color} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
