import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
} from 'recharts';

// ─── Design tokens (matching App.jsx) ────────────────────────────────────────
const BG        = '#050B1A';
const CARD_BG   = 'rgba(255,255,255,0.03)';
const GLASS_BG  = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = '1px solid rgba(255,255,255,0.07)';
const GLASS_BLUR   = 'blur(40px)';
const GLASS_RADIUS = 16;
const DM_SANS  = "'DM Sans', -apple-system, sans-serif";
const TEXT     = '#E8E8ED';
const SUBTEXT  = '#E8E8ED88';
const AMBER    = '#F59E0B';

// ─── Country config (only countries with daily data) ─────────────────────────
const COUNTRIES = [
  { code: 'uae',    name: 'UAE',          flag: '🇦🇪', file: 'data-uae.json',    color: '#EF4444' },
  { code: 'kuwait', name: 'Kuwait',        flag: '🇰🇼', file: 'data-kuwait.json', color: '#F59E0B' },
  { code: 'qatar',  name: 'Qatar',         flag: '🇶🇦', file: 'data-qatar.json',  color: '#8B5CF6' },
  { code: 'saudi',  name: 'Saudi Arabia',  flag: '🇸🇦', file: 'data-saudi.json',  color: '#A855F7' },
  { code: 'oman',   name: 'Oman',          flag: '🇴🇲', file: 'data-oman.json',   color: '#F97316' },
  { code: 'bahrain',name: 'Bahrain',       flag: '🇧🇭', file: 'data-bahrain.json',color: '#06B6D4' },
];

// ─── Weapon colors (for stacked bars in per-country view) ─────────────────────
const WEAPON_COLORS = {
  ballistic: '#EF4444',
  drones:    '#3B82F6',
  cruise:    '#8B5CF6',
};

// ─── Reporting-change marker ──────────────────────────────────────────────────
const REPORTING_CHANGE_DATE = '2026-03-13';

// ─── Timeframes ───────────────────────────────────────────────────────────────
const TIMEFRAMES = [
  { id: 'ALL', label: 'All' },
  { id: '1M',  label: '1 Month' },
  { id: '2W',  label: '2 Weeks' },
  { id: '1W',  label: '1 Week' },
];

// ─── Helper: normalize one daily entry ────────────────────────────────────────
function normalizeEntry(entry) {
  const ballistic =
    entry.ballisticEngaged ??
    entry.ballisticIntercepted ??
    entry.ballisticDetected ?? 0;
  const drones =
    entry.dronesEngaged ??
    entry.dronesIntercepted ??
    entry.dronesDetected ?? 0;
  const cruise =
    entry.cruiseEngaged ??
    entry.cruiseIntercepted ??
    entry.cruiseDetected ?? 0;
  const total = entry.total ?? (ballistic + drones + cruise);
  return {
    date:     entry.date,
    label:    entry.label ?? entry.date.slice(5),
    ballistic: ballistic || null,
    drones:    drones    || null,
    cruise:    cruise    || null,
    total:     total     || null,
    source:    entry.source ?? null,
    reportingType: entry.reportingType ?? 'intercepted',
  };
}

// ─── Helper: filter by timeframe ─────────────────────────────────────────────
function filterByTimeframe(entries, tf) {
  if (tf === 'ALL') return entries;
  const days = tf === '1W' ? 7 : tf === '2W' ? 14 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return entries.filter(e => new Date(e.date) >= cutoff);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function AttackTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const dateStr = d?.date
    ? new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : label;
  return (
    <div style={{
      background: '#0D1B2Aee',
      border: `1px solid rgba(255,255,255,0.12)`,
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      backdropFilter: GLASS_BLUR,
      fontFamily: DM_SANS,
      minWidth: 170,
    }}>
      <p style={{ color: AMBER, fontWeight: 700, margin: '0 0 6px', fontSize: 12 }}>📅 {dateStr}</p>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, marginBottom: 4 }} />
      {payload.filter(p => p.value != null && p.value > 0).map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0', fontWeight: 500 }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
      {d?.total != null && (
        <p style={{ color: TEXT, margin: '6px 0 2px', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 4 }}>
          🎯 Total: <strong>{d.total?.toLocaleString()}</strong>
        </p>
      )}
      {d?.reportingType === 'engaged' && (
        <p style={{ color: AMBER, fontSize: 9, margin: '6px 0 0', fontStyle: 'italic', opacity: 0.8 }}>
          † "Engaged" era — interception rate not tracked
        </p>
      )}
      {d?.source && (
        <>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '6px 0 4px' }} />
          <a
            href={d.source}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#60A5FA', fontSize: 10, textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            🔗 Source ↗
          </a>
        </>
      )}
    </div>
  );
}

// ─── Combined tooltip for line chart ─────────────────────────────────────────
function CombinedTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0D1B2Aee',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      backdropFilter: GLASS_BLUR,
      fontFamily: DM_SANS,
      minWidth: 160,
    }}>
      <p style={{ color: AMBER, fontWeight: 700, margin: '0 0 6px', fontSize: 12 }}>📅 {label}</p>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }} />
      {payload.filter(p => p.value != null && p.value > 0).map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0', fontWeight: 500 }}>
          {p.name}: <strong>{p.value?.toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Per-country stacked bar chart ───────────────────────────────────────────
function CountryBarChart({ country, entries, allDates, timeframe }) {
  const filtered = filterByTimeframe(entries, timeframe);
  // Build date-indexed map for fast lookup
  const byDate = Object.fromEntries(filtered.map(e => [e.date, e]));

  // Only dates that have data (sparse — gaps = no bar)
  const chartData = allDates
    .filter(date => byDate[date])
    .map(date => {
      const e = byDate[date];
      const shortLabel = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      return {
        date,
        label: shortLabel,
        ballistic: e.ballistic || null,
        drones:    e.drones    || null,
        cruise:    e.cruise    || null,
        total:     e.total     || null,
        source:    e.source    || null,
        reportingType: e.reportingType,
      };
    });

  if (chartData.length === 0) return null;

  const hasCruise = chartData.some(d => d.cruise != null && d.cruise > 0);
  const refLineDate = allDates.includes(REPORTING_CHANGE_DATE)
    ? new Date(REPORTING_CHANGE_DATE + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;
  const showRefLine = chartData.some(d => d.label === refLineDate);

  return (
    <div style={{
      background: GLASS_BG,
      backdropFilter: GLASS_BLUR,
      border: GLASS_BORDER,
      borderRadius: GLASS_RADIUS,
      padding: 20,
      marginBottom: 16,
    }}>
      {/* Country header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{country.flag}</span>
        <span style={{
          fontSize: 14, fontWeight: 700, color: TEXT, fontFamily: DM_SANS,
          borderBottom: `2px solid ${country.color}`, paddingBottom: 2,
        }}>
          {country.name}
        </span>
        <span style={{ fontSize: 11, color: SUBTEXT, marginLeft: 4 }}>
          {chartData.length} days with data
        </span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barCategoryGap="25%" margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: SUBTEXT, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
          />
          <YAxis tick={{ fill: SUBTEXT, fontSize: 9 }} axisLine={false} tickLine={false} />
          <Tooltip content={<AttackTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, color: SUBTEXT }}
            iconSize={8}
          />
          {/* Reporting-change reference line */}
          {showRefLine && (
            <ReferenceLine
              x={refLineDate}
              stroke={AMBER}
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{
                value: '→ engaged',
                position: 'top',
                fill: AMBER,
                fontSize: 8,
                fontFamily: DM_SANS,
              }}
            />
          )}
          <Bar dataKey="ballistic" name="Ballistic" stackId="s" fill={WEAPON_COLORS.ballistic} radius={[0,0,0,0]} maxBarSize={28} />
          <Bar dataKey="drones"    name="Drones"    stackId="s" fill={WEAPON_COLORS.drones}    radius={[0,0,0,0]} maxBarSize={28} />
          {hasCruise && <Bar dataKey="cruise" name="Cruise" stackId="s" fill={WEAPON_COLORS.cruise} radius={[2,2,0,0]} maxBarSize={28} />}
          {!hasCruise && <Bar dataKey="drones" name="" stackId="s" fill="transparent" radius={[2,2,0,0]} maxBarSize={28} legendType="none" />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main AttackChart component ───────────────────────────────────────────────
export default function AttackChart() {
  const [allData, setAllData]   = useState({});     // { code: normalizedEntries[] }
  const [loading, setLoading]   = useState(true);
  const [viewMode, setViewMode] = useState('per-country'); // 'per-country' | 'combined'
  const [timeframe, setTimeframe] = useState('ALL');
  const [collapsed, setCollapsed] = useState(false);
  const [activeCountries, setActiveCountries] = useState(
    Object.fromEntries(COUNTRIES.map(c => [c.code, true]))
  );

  // ── Fetch data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
    Promise.all(
      COUNTRIES.map(c =>
        fetch(base + c.file)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      const data = {};
      COUNTRIES.forEach((c, i) => {
        const raw = results[i];
        if (raw?.daily?.length > 0) {
          data[c.code] = raw.daily.map(normalizeEntry);
        }
      });
      setAllData(data);
      setLoading(false);
    });
  }, []);

  // ── Countries with data (filtered) ──────────────────────────────────────────
  const countriesWithData = useMemo(
    () => COUNTRIES.filter(c => allData[c.code]?.length > 0),
    [allData]
  );

  // ── All dates (union across all countries) ───────────────────────────────────
  const allDates = useMemo(() => {
    const dateSet = new Set();
    countriesWithData.forEach(c => {
      allData[c.code].forEach(e => dateSet.add(e.date));
    });
    return Array.from(dateSet).sort();
  }, [allData, countriesWithData]);

  // ── Date labels (for axis) ────────────────────────────────────────────────
  const dateLabels = useMemo(() =>
    allDates.map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
    [allDates]
  );

  // ── Combined chart data ───────────────────────────────────────────────────
  const combinedData = useMemo(() => {
    const filteredDates = filterByTimeframe(
      allDates.map(d => ({ date: d })),
      timeframe
    ).map(e => e.date);

    return filteredDates.map(date => {
      const row = {
        date,
        label: new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      };
      countriesWithData.forEach(c => {
        const entry = allData[c.code]?.find(e => e.date === date);
        row[c.code] = entry?.total ?? null;
      });
      return row;
    }).filter(row => countriesWithData.some(c => row[c.code] != null));
  }, [allData, countriesWithData, allDates, timeframe]);

  // ── Toggle country in combined view ──────────────────────────────────────
  function toggleCountry(code) {
    setActiveCountries(prev => ({ ...prev, [code]: !prev[code] }));
  }

  // ── Reference line label (for combined chart) ─────────────────────────────
  const refLineLabel = useMemo(() => {
    const idx = combinedData.findIndex(d => d.date === REPORTING_CHANGE_DATE);
    return idx >= 0 ? combinedData[idx].label : null;
  }, [combinedData]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div id="attacks" style={{ margin: '24px 0 0', fontFamily: DM_SANS }}>
      {/* Section header */}
      <div
        onClick={() => setCollapsed(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '12px 0 8px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <h2 style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: -0.3,
          }}>
            Attack Alarm Frequency
          </h2>
          <span style={{
            fontSize: 10,
            color: SUBTEXT,
            background: 'rgba(255,255,255,0.05)',
            border: GLASS_BORDER,
            borderRadius: 20,
            padding: '2px 8px',
          }}>
            Daily projectiles
          </span>
        </div>
        <span style={{ color: SUBTEXT, fontSize: 14 }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {!collapsed && (
        <div>
          {/* Controls row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            marginBottom: 16,
          }}>
            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: GLASS_BORDER, overflow: 'hidden' }}>
              {['per-country', 'combined'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    background: viewMode === mode ? 'rgba(245,158,11,0.15)' : 'transparent',
                    color: viewMode === mode ? AMBER : SUBTEXT,
                    border: 'none',
                    borderRight: mode === 'per-country' ? GLASS_BORDER : 'none',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: viewMode === mode ? 600 : 400,
                    fontFamily: DM_SANS,
                  }}
                >
                  {mode === 'per-country' ? '🌐 Per Country' : '📊 Combined'}
                </button>
              ))}
            </div>

            {/* Timeframe filter */}
            <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: GLASS_BORDER, overflow: 'hidden' }}>
              {TIMEFRAMES.map((tf, i) => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  style={{
                    background: timeframe === tf.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                    color: timeframe === tf.id ? '#60A5FA' : SUBTEXT,
                    border: 'none',
                    borderRight: i < TIMEFRAMES.length - 1 ? GLASS_BORDER : 'none',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: timeframe === tf.id ? 600 : 400,
                    fontFamily: DM_SANS,
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div style={{ color: SUBTEXT, fontSize: 12, padding: '20px 0' }}>Loading attack data…</div>
          )}

          {/* ── Per-country view ──────────────────────────────────────────── */}
          {!loading && viewMode === 'per-country' && (
            <div>
              {countriesWithData.length === 0 && (
                <div style={{ color: SUBTEXT, fontSize: 12, padding: '20px 0' }}>No attack data available.</div>
              )}
              {countriesWithData.map(country => (
                <CountryBarChart
                  key={country.code}
                  country={country}
                  entries={allData[country.code]}
                  allDates={allDates}
                  timeframe={timeframe}
                />
              ))}
              {/* Reporting-change annotation */}
              <div style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11,
                color: AMBER,
                marginTop: 8,
              }}>
                <strong>⚠ 13 Mar 2026 — UAE Reporting Change:</strong>{' '}
                <span style={{ color: SUBTEXT }}>
                  UAE MoD switched from &quot;intercepted&quot; (confirmed kills) to &quot;engaged&quot; (engagement attempts).
                  Interception rate is no longer tracked post this date.
                  The amber line on UAE&apos;s chart marks this boundary.
                </span>
              </div>
            </div>
          )}

          {/* ── Combined line chart ───────────────────────────────────────── */}
          {!loading && viewMode === 'combined' && (
            <div>
              {/* Country toggle chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {countriesWithData.map(c => (
                  <button
                    key={c.code}
                    onClick={() => toggleCountry(c.code)}
                    style={{
                      background: activeCountries[c.code] ? `${c.color}22` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeCountries[c.code] ? c.color : 'rgba(255,255,255,0.08)'}`,
                      color: activeCountries[c.code] ? c.color : SUBTEXT,
                      borderRadius: 20,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: activeCountries[c.code] ? 600 : 400,
                      fontFamily: DM_SANS,
                      transition: 'all 0.15s',
                    }}
                  >
                    {c.flag} {c.name}
                  </button>
                ))}
              </div>

              <div style={{
                background: GLASS_BG,
                backdropFilter: GLASS_BLUR,
                border: GLASS_BORDER,
                borderRadius: GLASS_RADIUS,
                padding: '20px 20px 12px',
              }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={combinedData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: SUBTEXT, fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      interval={Math.max(0, Math.floor(combinedData.length / 10) - 1)}
                    />
                    <YAxis tick={{ fill: SUBTEXT, fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CombinedTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: SUBTEXT }} iconSize={8} />
                    {/* Reporting-change reference line */}
                    {refLineLabel && (
                      <ReferenceLine
                        x={refLineLabel}
                        stroke={AMBER}
                        strokeDasharray="4 2"
                        strokeWidth={1.5}
                        label={{
                          value: 'Reporting changed: intercepted→engaged',
                          position: 'top',
                          fill: AMBER,
                          fontSize: 8,
                          fontFamily: DM_SANS,
                        }}
                      />
                    )}
                    {countriesWithData
                      .filter(c => activeCountries[c.code])
                      .map(c => (
                        <Line
                          key={c.code}
                          type="monotone"
                          dataKey={c.code}
                          name={`${c.flag} ${c.name}`}
                          stroke={c.color}
                          strokeWidth={2}
                          dot={{ fill: c.color, r: 2.5 }}
                          activeDot={{ r: 5 }}
                          connectNulls={false}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Reporting-change note */}
              <div style={{
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 11,
                color: AMBER,
                marginTop: 12,
              }}>
                <strong>⚠ 13 Mar 2026 — UAE Reporting Change:</strong>{' '}
                <span style={{ color: SUBTEXT }}>
                  UAE MoD switched from &quot;intercepted&quot; to &quot;engaged&quot; terminology.
                  The amber vertical line marks this date. Interception success rate is no longer tracked after this point.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
