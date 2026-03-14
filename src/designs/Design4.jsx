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

export default function Design4() {
  const [selected, setSelected] = useState("UAE");
  const maxTotal = Math.max(...DATA.daily.map(d => d.total));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        .d4-root * { box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; }
        .d4-root {
          background: #F8FAFC;
          color: #0F172A;
          min-height: 100vh;
        }
      `}</style>
      <div className="d4-root">
        {/* Top nav */}
        <div style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{
              fontSize: 18, fontWeight: 700, color: '#0F172A',
              letterSpacing: -0.5
            }}>ww3live<span style={{ color: '#2563EB' }}>.xyz</span></span>
            <div style={{
              display: 'flex', gap: 4, background: '#F1F5F9',
              borderRadius: 8, padding: 3
            }}>
              {COUNTRIES.map(c => (
                <button key={c} onClick={() => setSelected(c)} style={{
                  padding: '5px 12px', borderRadius: 6,
                  background: selected === c ? '#FFFFFF' : 'transparent',
                  boxShadow: selected === c ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  border: 'none', fontSize: 13, fontWeight: selected === c ? 600 : 400,
                  color: selected === c ? '#0F172A' : '#64748B',
                  cursor: 'pointer', fontFamily: 'Inter, sans-serif'
                }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 12, color: '#64748B'
            }}>Last updated: {DATA.lastUpdated}</span>
            <span style={{
              background: '#FEF2F2', color: '#DC2626',
              padding: '4px 10px', borderRadius: 100,
              fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', background: '#DC2626',
                display: 'inline-block'
              }} /> Live
            </span>
          </div>
        </div>

        <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
          {/* Status banners */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{
              flex: 1, padding: '12px 16px',
              background: '#FEF2F2', borderRadius: 10,
              border: '1px solid #FECACA',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: 13, color: '#991B1B', fontWeight: 500 }}>Strait of Hormuz</span>
              <span style={{
                background: '#DC2626', color: '#FFF', padding: '3px 10px',
                borderRadius: 100, fontSize: 12, fontWeight: 600
              }}>{DATA.straits}</span>
            </div>
            <div style={{
              flex: 1, padding: '12px 16px',
              background: '#FFF7ED', borderRadius: 10,
              border: '1px solid #FED7AA',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: 13, color: '#9A3412', fontWeight: 500 }}>Threat Level</span>
              <span style={{
                background: '#EA580C', color: '#FFF', padding: '3px 10px',
                borderRadius: 100, fontSize: 12, fontWeight: 600
              }}>{DATA.threatLevel}</span>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16, marginBottom: 24
          }}>
            {[
              { label: 'Total Detected', value: DATA.totalDetected.toLocaleString(), delta: '+36 today', deltaUp: true },
              { label: 'Intercepted', value: DATA.totalIntercepted.toLocaleString(), delta: '98.6% today', deltaUp: true },
              { label: 'Interception Rate', value: DATA.interceptionRate + '%', delta: '+0.3% vs avg', deltaUp: true },
              { label: 'Casualties', value: `${DATA.killed + DATA.injured}`, delta: `${DATA.killed} killed, ${DATA.injured} injured`, deltaUp: false },
            ].map((s, i) => (
              <div key={i} style={{
                background: '#FFFFFF', borderRadius: 12,
                border: '1px solid #E2E8F0',
                padding: '20px 20px 16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}>
                <div style={{
                  fontSize: 13, color: '#64748B', fontWeight: 500, marginBottom: 8
                }}>{s.label}</div>
                <div style={{
                  fontSize: 32, fontWeight: 700, color: '#0F172A',
                  letterSpacing: -1, lineHeight: 1
                }}>{s.value}</div>
                <div style={{
                  fontSize: 12, marginTop: 8,
                  color: i === 3 ? '#DC2626' : '#16A34A',
                  fontWeight: 500
                }}>
                  {i !== 3 && <span style={{ marginRight: 2 }}>{s.deltaUp ? '↑' : '↓'}</span>}
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{
            background: '#FFFFFF', borderRadius: 12,
            border: '1px solid #E2E8F0', padding: 24,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>Daily Attacks</div>
                <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Ballistic missiles and drone strikes</div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748B' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#2563EB', display: 'inline-block' }} /> Drones
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#7C3AED', display: 'inline-block' }} /> Ballistic
                </span>
              </div>
            </div>

            {/* Stacked bar chart */}
            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 12, height: 220,
              borderBottom: '1px solid #E2E8F0', paddingBottom: 8
            }}>
              {DATA.daily.map((d, i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', height: '100%', justifyContent: 'flex-end'
                }}>
                  <div style={{
                    fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 4
                  }}>{d.total}</div>
                  <div style={{
                    width: '70%', display: 'flex', flexDirection: 'column',
                    borderRadius: '6px 6px 0 0', overflow: 'hidden'
                  }}>
                    <div style={{
                      height: (d.drones / maxTotal) * 170,
                      background: 'linear-gradient(180deg, #3B82F6, #2563EB)',
                      borderRadius: '6px 6px 0 0'
                    }} />
                    <div style={{
                      height: (d.ballistic / maxTotal) * 170,
                      background: 'linear-gradient(180deg, #8B5CF6, #7C3AED)',
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              display: 'flex', gap: 12, marginTop: 8
            }}>
              {DATA.daily.map((d, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', fontSize: 12,
                  color: '#94A3B8'
                }}>{d.label}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
