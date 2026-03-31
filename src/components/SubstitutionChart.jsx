import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Tooltip as RTooltip } from 'recharts';

const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const GLASS_RADIUS = 16;
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const YANBU_COLOR = '#3B82F6';
const FUJAIRAH_COLOR = '#14B8A6';
const PRE_WAR_COLOR = '#EF4444';

const TIMEFRAMES = [
  { key: '1W', days: 7 },
  { key: '2W', days: 14 },
  { key: '4W', days: 28 },
  { key: 'ALL', days: null },
];

const btnBase = {
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  fontFamily: DM_SANS,
};

const btnActive = {
  ...btnBase,
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  borderColor: 'rgba(255,255,255,0.4)',
};

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const yanbuStr = row.yanbu_vessel_only
    ? `n/a (${row.yanbu_vessels ?? 0} vessels tracked)`
    : row.yanbu_mbpd != null ? `${row.yanbu_mbpd.toFixed(2)} mb/d` : '—';
  const fujStr = row.fujairah_vessel_only
    ? `n/a (${row.fujairah_vessels ?? 0} vessels tracked)`
    : row.fujairah_mbpd != null ? `${row.fujairah_mbpd.toFixed(2)} mb/d` : '—';

  const total = (row.yanbu_vessel_only ? 0 : (row.yanbu_mbpd || 0)) +
                (row.fujairah_vessel_only ? 0 : (row.fujairah_mbpd || 0));
  const gap = 21 - total;

  return (
    <div style={{ background: '#050B1A', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '10px 14px', fontFamily: DM_SANS }}>
      <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{row.dateLabel}</div>
      <div style={{ color: YANBU_COLOR, fontSize: 12, marginBottom: 2 }}>Yanbu: {yanbuStr}</div>
      <div style={{ color: FUJAIRAH_COLOR, fontSize: 12, marginBottom: 2 }}>Fujairah: {fujStr}</div>
      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
        Total: {total.toFixed(2)} mb/d
      </div>
      <div style={{ color: PRE_WAR_COLOR, fontSize: 11 }}>
        Gap: {gap.toFixed(2)} mb/d below pre-war
      </div>
    </div>
  );
}

export default function SubstitutionChart({ data }) {
  const [timeframe, setTimeframe] = useState('ALL');

  const { chartData, currentTotal } = useMemo(() => {
    const yanbuHistory = data?.routes?.yanbu?.history || [];
    const fujairahHistory = data?.routes?.fujairah?.history || [];
    const preWar = data?.hormuz?.pre_war_mbpd || 21;

    // Collect all unique dates
    const dateMap = {};
    let lastYanbuMbpd = 0;
    let lastFujairahMbpd = 0;

    // Index by date
    const yanbuByDate = {};
    for (const e of yanbuHistory) yanbuByDate[e.date] = e;
    const fujByDate = {};
    for (const e of fujairahHistory) fujByDate[e.date] = e;

    const allDates = [...new Set([
      ...yanbuHistory.map(e => e.date),
      ...fujairahHistory.map(e => e.date),
    ])].sort();

    // Track last known mbpd for vessel-only fallback
    let lastYanbu = 0;
    let lastFuj = 0;

    const rows = allDates.map(date => {
      const y = yanbuByDate[date];
      const f = fujByDate[date];

      const yanbuVesselOnly = y ? (y.mbpd === null && y.vessel_count != null) : false;
      const fujVesselOnly = f ? (f.mbpd === null && f.vessel_count != null) : false;

      if (y?.mbpd != null) lastYanbu = y.mbpd;
      if (f?.mbpd != null) lastFuj = f.mbpd;

      return {
        date,
        dateLabel: formatDate(date),
        yanbu_mbpd: yanbuVesselOnly ? lastYanbu : (y?.mbpd ?? null),
        fujairah_mbpd: fujVesselOnly ? lastFuj : (f?.mbpd ?? null),
        yanbu_vessels: y?.vessel_count ?? null,
        fujairah_vessels: f?.vessel_count ?? null,
        yanbu_vessel_only: yanbuVesselOnly,
        fujairah_vessel_only: fujVesselOnly,
      };
    });

    // Compute current total from last non-vessel-only entries
    let total = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!rows[i].yanbu_vessel_only && rows[i].yanbu_mbpd != null) { total += rows[i].yanbu_mbpd; break; }
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      if (!rows[i].fujairah_vessel_only && rows[i].fujairah_mbpd != null) { total += rows[i].fujairah_mbpd; break; }
    }

    return { chartData: rows, currentTotal: total };
  }, [data]);

  if (!chartData.length) return null;

  // Apply timeframe filter
  const tf = TIMEFRAMES.find(t => t.key === timeframe);
  let filtered = chartData;
  if (tf?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tf.days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    filtered = chartData.filter(row => row.date >= cutoffStr);
  }

  const preWar = data?.hormuz?.pre_war_mbpd || 21;
  const gap = preWar - currentTotal;

  return (
    <div style={{
      background: CARD_BG,
      border: `1px solid ${GLASS_BORDER}`,
      borderRadius: GLASS_RADIUS,
      padding: 20,
    }}>
      <div style={{ color: TEXT, fontWeight: 600, fontSize: 11, letterSpacing: '0.1em', marginBottom: 2, fontFamily: DM_SANS }}>
        OIL FLOW SUBSTITUTION — YANBU + FUJAIRAH
      </div>
      <div style={{ color: SUBTEXT, fontSize: '0.8rem', marginBottom: 12, fontFamily: DM_SANS }}>
        Current: {currentTotal.toFixed(1)} mb/d | Pre-war Hormuz: {preWar} mb/d | Gap: {gap.toFixed(1)} mb/d
      </div>

      {/* Time range buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
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

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: YANBU_COLOR, display: 'inline-block' }} />
          Yanbu
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: FUJAIRAH_COLOR, display: 'inline-block' }} />
          Fujairah
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: PRE_WAR_COLOR, display: 'inline-block', opacity: 0.7 }} />
          Pre-War Hormuz
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filtered} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            tickLine={false}
            domain={[0, 25]}
            tickFormatter={v => `${v}`}
          />
          <RTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <ReferenceLine
            y={preWar}
            stroke={PRE_WAR_COLOR}
            strokeDasharray="4 4"
            label={{ value: `Pre-War Hormuz (${preWar} mb/d)`, fill: PRE_WAR_COLOR, fontSize: 10, position: 'right' }}
          />
          <Bar dataKey="yanbu_mbpd" name="Yanbu" stackId="stack" fill={YANBU_COLOR} radius={[0, 0, 0, 0]}>
            {filtered.map((entry, i) => (
              <Cell key={i} fillOpacity={entry.yanbu_vessel_only ? 0.5 : 1} />
            ))}
          </Bar>
          <Bar dataKey="fujairah_mbpd" name="Fujairah" stackId="stack" fill={FUJAIRAH_COLOR} radius={[2, 2, 0, 0]}>
            {filtered.map((entry, i) => (
              <Cell key={i} fillOpacity={entry.fujairah_vessel_only ? 0.5 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
