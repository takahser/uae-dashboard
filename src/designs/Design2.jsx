import React, { useState } from 'react';

const DATA = {
  country: "UAE",
  lastUpdated: "Mar 14, 2026",
  totalDetected: 1816,
  totalIntercepted: 1710,
  interceptionRate: 94.2,
  killed: 6,
  injured: 121,
  daily: [
    { label: "Mar 6", ballistic: 4, drones: 28, total: 32 },
    { label: "Mar 7", ballistic: 7, drones: 31, total: 38 },
    { label: "Mar 8", ballistic: 5, drones: 22, total: 27 },
    { label: "Mar 9", ballistic: 9, drones: 41, total: 50 },
    { label: "Mar 10", ballistic: 6, drones: 35, total: 41 },
    { label: "Mar 11", ballistic: 6, drones: 39, total: 52 },
    { label: "Mar 12", ballistic: 10, drones: 26, total: 36 },
  ],
  straits: "CLOSED",
  threatLevel: "CRITICAL"
};

const COUNTRIES = ["UAE", "Israel", "Saudi", "Kuwait", "Qatar", "Bahrain"];

export default function Design2() {
  const [selected, setSelected] = useState("UAE");
  const maxTotal = Math.max(...DATA.daily.map(d => d.total));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Source+Serif+4:wght@300;400;600&display=swap');
        .d2-root * { box-sizing: border-box; }
        .d2-root {
          background: #F5F0E8;
          color: #0D1B2A;
          min-height: 100vh;
          font-family: 'Source Serif 4', Georgia, serif;
        }
      `}</style>
      <div className="d2-root">
        {/* Top red bar */}
        <div style={{ background: '#8B0000', height: 4 }} />

        {/* Header */}
        <div style={{
          padding: '28px 48px 20px',
          borderBottom: '2px solid #0D1B2A',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'
        }}>
          <div>
            <div style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 42, fontWeight: 900, letterSpacing: -1,
              lineHeight: 1, color: '#0D1B2A'
            }}>ww3live.xyz</div>
            <div style={{
              fontSize: 13, color: '#5C6370', marginTop: 6,
              fontStyle: 'italic', letterSpacing: 0.5
            }}>Conflict Intelligence Briefing</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#8B0000', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              SITUATION REPORT
            </div>
            <div style={{ fontSize: 14, color: '#5C6370', marginTop: 2 }}>{DATA.lastUpdated}</div>
          </div>
        </div>

        {/* Secondary nav line */}
        <div style={{
          borderBottom: '1px solid #0D1B2A33',
          display: 'flex', padding: '0 48px'
        }}>
          {COUNTRIES.map(c => (
            <button key={c} onClick={() => setSelected(c)} style={{
              padding: '10px 20px', background: 'transparent',
              border: 'none', borderBottom: selected === c ? '3px solid #8B0000' : '3px solid transparent',
              fontFamily: 'Source Serif 4, Georgia, serif',
              fontSize: 14, color: selected === c ? '#8B0000' : '#0D1B2A88',
              fontWeight: selected === c ? 600 : 400, cursor: 'pointer',
              marginBottom: -1
            }}>{c}</button>
          ))}
        </div>

        {/* Status banner */}
        <div style={{
          margin: '24px 48px 0', display: 'flex', gap: 16
        }}>
          <div style={{
            flex: 1, background: '#0D1B2A', color: '#F5F0E8',
            padding: '12px 20px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, letterSpacing: 2, fontWeight: 300 }}>STRAIT OF HORMUZ</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#FF4444', letterSpacing: 3 }}>{DATA.straits}</span>
          </div>
          <div style={{
            flex: 1, background: '#8B0000', color: '#F5F0E8',
            padding: '12px 20px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: 12, letterSpacing: 2, fontWeight: 300 }}>THREAT ASSESSMENT</span>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3 }}>{DATA.threatLevel}</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ padding: '32px 48px' }}>
          {/* Section heading */}
          <div style={{
            fontFamily: 'Playfair Display, serif',
            fontSize: 24, fontWeight: 700, marginBottom: 4
          }}>Key Figures</div>
          <div style={{
            width: 40, height: 3, background: '#8B0000', marginBottom: 24
          }} />

          {/* Stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0, borderTop: '2px solid #0D1B2A', borderBottom: '1px solid #0D1B2A33'
          }}>
            {[
              { label: 'Threats Detected', value: DATA.totalDetected.toLocaleString(), sub: 'missiles & drones' },
              { label: 'Successfully Intercepted', value: DATA.totalIntercepted.toLocaleString(), sub: 'confirmed neutralised' },
              { label: 'Interception Rate', value: DATA.interceptionRate + '%', sub: 'defence effectiveness' },
              { label: 'Casualties', value: `${DATA.killed} killed, ${DATA.injured} injured`, sub: 'confirmed figures' },
            ].map((s, i) => (
              <div key={i} style={{
                padding: '24px 20px',
                borderRight: i < 3 ? '1px solid #0D1B2A22' : 'none',
              }}>
                <div style={{
                  fontSize: 11, color: '#8B0000', textTransform: 'uppercase',
                  letterSpacing: 2, fontWeight: 600, marginBottom: 8
                }}>{s.label}</div>
                <div style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: i === 3 ? 22 : 40, fontWeight: 900, lineHeight: 1.1,
                  color: '#0D1B2A'
                }}>{s.value}</div>
                <div style={{
                  fontSize: 12, color: '#5C6370', fontStyle: 'italic', marginTop: 6
                }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Chart section */}
          <div style={{ marginTop: 40 }}>
            <div style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: 24, fontWeight: 700, marginBottom: 4
            }}>Daily Attack Volume</div>
            <div style={{
              width: 40, height: 3, background: '#8B0000', marginBottom: 24
            }} />

            {/* Horizontal bar chart - editorial style */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DATA.daily.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 56, fontSize: 13, color: '#5C6370', textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums'
                  }}>{d.label}</div>
                  <div style={{ flex: 1, display: 'flex', height: 28, gap: 1 }}>
                    <div style={{
                      width: `${(d.ballistic / maxTotal) * 100}%`,
                      background: '#8B0000', transition: 'width 0.5s'
                    }} />
                    <div style={{
                      width: `${(d.drones / maxTotal) * 100}%`,
                      background: '#0D1B2A', transition: 'width 0.5s'
                    }} />
                  </div>
                  <div style={{
                    width: 36, fontSize: 14, fontWeight: 700, textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums'
                  }}>{d.total}</div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{
              display: 'flex', gap: 24, marginTop: 16, fontSize: 12, color: '#5C6370'
            }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#8B0000', marginRight: 6, verticalAlign: -1 }} />Ballistic missiles</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#0D1B2A', marginRight: 6, verticalAlign: -1 }} />Drones/UAVs</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 40, paddingTop: 16,
            borderTop: '2px solid #0D1B2A',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: '#5C6370', fontStyle: 'italic'
          }}>
            <span>Sources: Ministry of Defence, OSINT aggregation</span>
            <span>© 2026 ww3live.xyz — All rights reserved</span>
          </div>
        </div>
      </div>
    </>
  );
}
