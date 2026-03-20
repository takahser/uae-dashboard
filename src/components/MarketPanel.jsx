import { useState, useRef } from 'react';

const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const GLASS_BLUR = 'blur(40px)';
const GLASS_RADIUS = 16;
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const ACCENT = '#F59E0B';

// Feature flags — set to true once data source is verified
const FEATURE_DUBAI_PRICE = true;  // investing.com scraper — verified $136.42 Mar 19

function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 5 }}>
      <span
        onClick={e => { e.stopPropagation(); setShow(v => !v); }}
        style={{
          cursor: 'pointer', fontSize: 10, color: SUBTEXT,
          border: 'rgba(255,255,255,0.11)', borderRadius: '50%',
          width: 16, height: 16,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, position: 'relative', userSelect: 'none',
        }}
      >(i)</span>
      {show && (
        <>
          <span onClick={() => setShow(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <span style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 9999,
            marginTop: 4, background: '#0D1B2Aee',
            border: 'rgba(255,255,255,0.11)', borderRadius: 8,
            padding: '10px 14px', fontSize: 11, color: SUBTEXT,
            minWidth: 260, maxWidth: 360, lineHeight: 1.6, fontWeight: 400,
            letterSpacing: 0, whiteSpace: 'pre-line',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)', pointerEvents: 'none',
          }}>
            {text}
          </span>
        </>
      )}
    </span>
  );
}

const OIL_INFOS = {
  'BZ=F':  'Brent Crude is the global benchmark for oil prices, set in the North Sea. Used to price ~70% of world oil. Reflects European and African supply/demand.',
  'CL=F':  'WTI (West Texas Intermediate) is the US benchmark crude. Traded on NYMEX. Typically priced below Brent due to landlocked delivery point.',
  'DUBAI': 'Dubai/Oman Platts crude is the physical benchmark for Gulf oil shipped to Asia. Cash price reflects actual barrels changing hands today — no Hormuz transit means a severe premium.',
  'OMAN':  'Oman crude trades on the Dubai Mercantile Exchange (DME). Key pricing reference for Middle East oil exports to Asia. Currently reflects extreme Hormuz closure premium.',
  'NG=F':  'US natural gas futures (Henry Hub). Indirectly affected by LNG disruptions — Qatar force majeure is redirecting global LNG demand toward US exporters.',
};

const OIL_SYMBOLS = [
  { key: "BZ=F",  label: "Brent Crude",  unit: "$/bbl" },
  { key: "CL=F",  label: "WTI Crude",    unit: "$/bbl" },
  ...(FEATURE_DUBAI_PRICE ? [{ key: "DUBAI", label: "Dubai Crude", unit: "$/bbl" }] : []),
  { key: "OMAN",  label: "Oman Crude",   unit: "$/bbl" },
  { key: "NG=F",  label: "Natural Gas",  unit: "$/MMBtu" },
];

const STOCK_SYMBOLS = [
  { key: '2222.SR', label: 'Saudi Aramco', sector: 'Producer' },
  { key: 'FRO', label: 'Frontline', sector: 'Tanker' },
  { key: 'STNG', label: 'Scorpio Tnk', sector: 'Tanker' },
  { key: 'RTX', label: 'RTX Corp', sector: 'Defense' },
  { key: 'LMT', label: 'Lockheed', sector: 'Defense' },
];

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

          {/* Oil prices row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            {OIL_SYMBOLS.map(s => {
              const q = data?.[s.key];
              if (!q) return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
                }}>
                  <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4, display: 'flex', alignItems: 'center' }}>{s.label}{OIL_INFOS[s.key] && <InfoTip text={OIL_INFOS[s.key]} />}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: SUBTEXT }}>--</div>
                </div>
              );
              const hasChange = q.change != null && q.changePercent != null;
              const isUp = hasChange ? q.change >= 0 : null;
              return (
                <div key={s.key} style={{
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${GLASS_BORDER}`,
                  borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
                }}>
                  <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4, display: 'flex', alignItems: 'center' }}>{s.label}{OIL_INFOS[s.key] && <InfoTip text={OIL_INFOS[s.key]} />}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TEXT }}>
                    ${q.price?.toFixed(2)}
                  </div>
                  {hasChange && (
                    <div style={{ fontSize: '0.75rem', color: isUp ? '#27AE60' : '#EF4444', fontWeight: 600 }}>
                      {isUp ? '\u25B2' : '\u25BC'} {Math.abs(q.change).toFixed(2)} ({Math.abs(q.changePercent).toFixed(1)}%)
                    </div>
                  )}
                  {q.source && (
                    <div style={{ fontSize: '0.6rem', color: SUBTEXT, marginTop: 2 }}>{q.source}</div>
                  )}
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
                <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4, display: 'flex', alignItems: 'center' }}>Brent-WTI Spread<InfoTip text={'The price gap between Brent (global) and WTI (US) crude.\n\nPre-war: ~$3–5. An elevated spread signals global supply disruption. Brent rises faster when Middle East supply is at risk.'} /></div>
                <div style={{
                  fontSize: '1.3rem', fontWeight: 700,
                  color: spread > 20 ? '#EF4444' : spread > 10 ? '#E67E22' : spread > 5 ? '#F1C40F' : '#27AE60'
                }}>
                  +${spread.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.72rem', color: spread > 10 ? '#E67E22' : SUBTEXT, fontWeight: 600, marginTop: 2 }}>
                  +{wti > 0 ? (spread / wti * 100).toFixed(1) : '0.0'}%
                </div>
                <div style={{ fontSize: '0.65rem', color: SUBTEXT }}>
                  {spread > 20 ? 'Severe disruption signal' : spread > 10 ? 'Significant premium' : spread > 5 ? 'Elevated' : 'Normal range'}
                </div>
              </div>
            )}

            {/* Gulf-WTI Premium */}
            {data?.['OMAN'] && data?.['CL=F'] && (() => {
              const gulfPremium = (data['OMAN'].price ?? 0) - wti;
              const gpColor = gulfPremium > 60 ? '#EF4444' : gulfPremium > 40 ? '#E67E22' : gulfPremium > 20 ? '#F1C40F' : '#27AE60';
              const gpBg = gulfPremium > 40 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)';
              const gpBorder = gulfPremium > 60 ? '#EF4444' : gulfPremium > 40 ? '#E67E22' : GLASS_BORDER;
              return (
                <div style={{
                  background: gpBg, border: `1px solid ${gpBorder}`,
                  borderRadius: 8, padding: '12px 14px', flex: '1 1 140px', minWidth: 140
                }}>
                  <div style={{ fontSize: '0.7rem', color: SUBTEXT, marginBottom: 4, display: 'flex', alignItems: 'center' }}>Gulf-WTI Premium<InfoTip text={'Physical Gulf crude (Oman) vs US paper futures (WTI).\n\nThis spread is the "Hormuz premium" — what Asian buyers actually pay above the futures price when the strait is closed. Pre-war: ~$3. Current: record high.'} /></div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: gpColor }}>
                    +${gulfPremium.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: gpColor, fontWeight: 600, marginTop: 2 }}>
                    +{wti > 0 ? (gulfPremium / wti * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: SUBTEXT }}>
                    Hormuz closure risk premium
                  </div>
                </div>
              );
            })()}
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
