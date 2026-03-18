import { useState } from 'react';

const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const GLASS_BLUR = 'blur(40px)';
const GLASS_RADIUS = 16;
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const ACCENT = '#F59E0B';

const OIL_SYMBOLS = [
  { key: 'BZ=F', label: 'Brent Crude', unit: '$/bbl' },
  { key: 'CL=F', label: 'WTI Crude', unit: '$/bbl' },
  { key: 'NG=F', label: 'Natural Gas', unit: '$/MMBtu' },
  { key: 'DUBAI', label: 'Dubai Crude', unit: '$/bbl', placeholder: true },
];

const STOCK_SYMBOLS = [
  { key: '2222.SR', label: 'Saudi Aramco', sector: 'Producer' },
  { key: 'FRO', label: 'Frontline', sector: 'Tanker' },
  { key: 'STNG', label: 'Scorpio Tnk', sector: 'Tanker' },
  { key: 'RTX', label: 'RTX Corp', sector: 'Defense' },
  { key: 'LMT', label: 'Lockheed', sector: 'Defense' },
];

// Platts Dubai crude — no live API available; static latest known value
const DUBAI_CRUDE = { price: 150.42, date: 'Mar 16', label: 'Dubai Crude (Platts)' };

export default function MarketPanel({ data, error, lastUpdated, loading, refetch }) {
  const [collapsed, setCollapsed] = useState(false);

  if (loading && !data) {
    return (
      <div style={{
        background: CARD_BG, border: `1px solid ${GLASS_BORDER}`,
        borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 32
      }}>
        <div style={{ color: SUBTEXT, fontSize: '0.85rem' }}>Loading market data...</div>
      </div>
    );
  }

  const brent = data?.['BZ=F']?.price ?? 0;
  const wti = data?.['CL=F']?.price ?? 0;
  const spread = brent - wti;
  const isStale = lastUpdated && (Date.now() - lastUpdated.getTime() > 300_000);

  return (
    <div style={{
      background: CARD_BG, backdropFilter: GLASS_BLUR,
      border: `1px solid ${GLASS_BORDER}`, borderRadius: GLASS_RADIUS,
      padding: 20, marginBottom: 32
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 16 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: ACCENT, margin: 0 }}>
          Market Impact
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: '0.65rem', color: SUBTEXT }}>Delayed up to 30 min</span>
          {lastUpdated && (
            <span style={{ fontSize: '0.65rem', color: isStale ? '#F59E0B' : SUBTEXT }}>
              {isStale ? 'Stale — ' : ''}{lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={refetch} aria-label="Refresh market data" style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${GLASS_BORDER}`,
            borderRadius: 6, padding: '4px 10px', color: SUBTEXT,
            fontSize: '0.7rem', cursor: 'pointer'
          }}>
            Refresh
          </button>
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: 'none', border: 'none', color: SUBTEXT,
            fontSize: '1rem', cursor: 'pointer', padding: '0 4px'
          }}>
            {collapsed ? '+' : '\u2212'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Error banner */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', borderRadius: 6,
              padding: '6px 10px', marginBottom: 12, fontSize: '0.7rem', color: '#EF4444'
            }}>
              Refresh failed: {error}. Showing last known data.
            </div>
          )}

          {/* Dubai Crude (Platts) — prominent featured price */}
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.25)`,
            borderRadius: 10, padding: '14px 18px', marginBottom: 14, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: ACCENT, fontWeight: 600, marginBottom: 4 }}>
                {DUBAI_CRUDE.label}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: TEXT }}>
                ${DUBAI_CRUDE.price.toFixed(2)}
                <span style={{ fontSize: '0.7rem', color: SUBTEXT, marginLeft: 6 }}>$/bbl</span>
              </div>
            </div>
            <div style={{
              fontSize: '0.6rem', color: SUBTEXT, background: 'rgba(255,255,255,0.06)',
              borderRadius: 4, padding: '3px 8px', textAlign: 'right', lineHeight: 1.5
            }}>
              Static &middot; {DUBAI_CRUDE.date}<br />
              No live feed available
            </div>
          </div>

          {/* Oil prices row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {OIL_SYMBOLS.map(s => {
              if (s.placeholder) return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
                }}>
                  <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: SUBTEXT }}>--</div>
                  <div style={{ fontSize: '0.6rem', color: SUBTEXT }}>EIA key pending</div>
                </div>
              );
              const q = data?.[s.key];
              if (!q) return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
                }}>
                  <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: SUBTEXT }}>--</div>
                </div>
              );
              const isUp = q.change >= 0;
              return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
                }}>
                  <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TEXT }}>
                    ${q.price?.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isUp ? '#27AE60' : '#EF4444', fontWeight: 600 }}>
                    {isUp ? '\u25B2' : '\u25BC'} {Math.abs(q.change).toFixed(2)} ({Math.abs(q.changePercent).toFixed(1)}%)
                  </div>
                </div>
              );
            })}

            {/* Brent-WTI spread */}
            {data?.['BZ=F'] && data?.['CL=F'] && (
              <div style={{
                background: spread > 10 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${spread > 20 ? '#EF4444' : spread > 10 ? '#E67E22' : GLASS_BORDER}`,
                borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
              }}>
                <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4 }}>Brent-WTI Spread</div>
                <div style={{
                  fontSize: '1.3rem', fontWeight: 700,
                  color: spread > 20 ? '#EF4444' : spread > 10 ? '#E67E22' : spread > 5 ? '#F1C40F' : '#27AE60'
                }}>
                  +${spread.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.65rem', color: SUBTEXT }}>
                  {spread > 20 ? 'Severe disruption signal' : spread > 10 ? 'Significant premium' : spread > 5 ? 'Elevated' : 'Normal range'}
                </div>
              </div>
            )}
          </div>

          {/* Watchlist */}
          <div style={{ fontSize: '0.75rem', color: SUBTEXT, marginBottom: 8, fontWeight: 600 }}>
            WATCHLIST
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {STOCK_SYMBOLS.map(s => {
              const q = data?.[s.key];
              if (!q) return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '10px 12px'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: SUBTEXT }}>{s.key}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: SUBTEXT }}>--</div>
                </div>
              );
              const isUp = q.change >= 0;
              return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '10px 12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: TEXT }}>{s.key}</span>
                    <span style={{
                      fontSize: '0.6rem', color: SUBTEXT, background: 'rgba(255,255,255,0.06)',
                      borderRadius: 3, padding: '1px 5px'
                    }}>{s.sector}</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: TEXT }}>${q.price?.toFixed(2)}</div>
                  <div style={{ fontSize: '0.7rem', color: isUp ? '#27AE60' : '#EF4444', fontWeight: 600 }}>
                    {isUp ? '\u25B2' : '\u25BC'} {Math.abs(q.changePercent).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
