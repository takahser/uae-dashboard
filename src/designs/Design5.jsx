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

export default function Design5() {
  const [selected, setSelected] = useState("UAE");
  const maxTotal = Math.max(...DATA.daily.map(d => d.total));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .d5-root * { box-sizing: border-box; font-family: 'DM Sans', -apple-system, sans-serif; }
        .d5-root {
          background: #050B1A;
          color: #E8E8ED;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
        }
        @keyframes d5-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <div className="d5-root">
        {/* Background gradient orbs */}
        <div style={{
          position: 'absolute', top: -200, right: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, #F59E0B11 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: -200, left: -100,
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, #3B82F611 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Header */}
        <div style={{
          padding: '20px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #FFFFFF0A',
          backdropFilter: 'blur(20px)', position: 'relative', zIndex: 2
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#050B1A'
            }}>W</div>
            <span style={{
              fontSize: 20, fontWeight: 700, letterSpacing: -0.3
            }}>ww3live<span style={{ color: '#F59E0B' }}>.xyz</span></span>
          </div>

          {/* Country pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {COUNTRIES.map(c => (
              <button key={c} onClick={() => setSelected(c)} style={{
                padding: '6px 14px', borderRadius: 100,
                background: selected === c
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : '#FFFFFF0A',
                backdropFilter: selected !== c ? 'blur(10px)' : 'none',
                border: selected === c ? 'none' : '1px solid #FFFFFF11',
                color: selected === c ? '#050B1A' : '#E8E8ED88',
                fontSize: 12, fontWeight: selected === c ? 600 : 400,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
              }}>{c}</button>
            ))}
          </div>

          <div style={{
            fontSize: 12, color: '#E8E8ED44'
          }}>Updated {DATA.lastUpdated}</div>
        </div>

        {/* Main content */}
        <div style={{ padding: '24px 40px', position: 'relative', zIndex: 2 }}>
          {/* Status strip */}
          <div style={{
            display: 'flex', gap: 12, marginBottom: 24
          }}>
            <div style={{
              flex: 1, padding: '14px 20px',
              background: '#FFFFFF08',
              backdropFilter: 'blur(40px)',
              border: '1px solid #FFFFFF11',
              borderRadius: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#E8E8ED44', fontWeight: 500, letterSpacing: 1 }}>STRAIT OF HORMUZ</div>
                <div style={{ fontSize: 11, color: '#E8E8ED33', marginTop: 2 }}>Maritime passage status</div>
              </div>
              <div style={{
                background: '#DC262622', color: '#EF4444', padding: '4px 14px',
                borderRadius: 100, fontSize: 13, fontWeight: 600,
                border: '1px solid #DC262633'
              }}>{DATA.straits}</div>
            </div>
            <div style={{
              flex: 1, padding: '14px 20px',
              background: '#FFFFFF08',
              backdropFilter: 'blur(40px)',
              border: '1px solid #FFFFFF11',
              borderRadius: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#E8E8ED44', fontWeight: 500, letterSpacing: 1 }}>THREAT LEVEL</div>
                <div style={{ fontSize: 11, color: '#E8E8ED33', marginTop: 2 }}>Current assessment</div>
              </div>
              <div style={{
                background: '#F59E0B22', color: '#F59E0B', padding: '4px 14px',
                borderRadius: 100, fontSize: 13, fontWeight: 600,
                border: '1px solid #F59E0B33'
              }}>{DATA.threatLevel}</div>
            </div>
          </div>

          {/* Stat cards - glassmorphism */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16, marginBottom: 24
          }}>
            {[
              { label: 'Total Detected', value: DATA.totalDetected.toLocaleString(), accent: '#F59E0B' },
              { label: 'Intercepted', value: DATA.totalIntercepted.toLocaleString(), accent: '#22D3EE' },
              { label: 'Interception Rate', value: DATA.interceptionRate + '%', accent: '#34D399' },
              { label: 'Casualties', value: `${DATA.killed + DATA.injured}`, accent: '#F87171', sub: `${DATA.killed} killed · ${DATA.injured} injured` },
            ].map((s, i) => (
              <div key={i} style={{
                padding: 24,
                background: '#FFFFFF06',
                backdropFilter: 'blur(40px)',
                border: '1px solid #FFFFFF0D',
                borderRadius: 20,
                position: 'relative', overflow: 'hidden',
                animation: `d5-float 6s ease-in-out infinite ${i * 0.3}s`
              }}>
                {/* Top accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: 24, right: 24, height: 1,
                  background: `linear-gradient(90deg, transparent, ${s.accent}44, transparent)`
                }} />
                <div style={{
                  fontSize: 12, color: '#E8E8ED55', fontWeight: 500, marginBottom: 12
                }}>{s.label}</div>
                <div style={{
                  fontSize: 36, fontWeight: 700, color: '#FFFFFF',
                  letterSpacing: -1, lineHeight: 1
                }}>{s.value}</div>
                {s.sub && <div style={{
                  fontSize: 11, color: `${s.accent}AA`, marginTop: 8
                }}>{s.sub}</div>}
                {/* Subtle glow */}
                <div style={{
                  position: 'absolute', bottom: -20, right: -20,
                  width: 80, height: 80, borderRadius: '50%',
                  background: `radial-gradient(circle, ${s.accent}11, transparent)`,
                  pointerEvents: 'none'
                }} />
              </div>
            ))}
          </div>

          {/* Chart card */}
          <div style={{
            background: '#FFFFFF06',
            backdropFilter: 'blur(40px)',
            border: '1px solid #FFFFFF0D',
            borderRadius: 20, padding: 28,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 24
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Attack Timeline</div>
                <div style={{ fontSize: 12, color: '#E8E8ED44', marginTop: 2 }}>7-day rolling view</div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 16, height: 3, background: '#F59E0B', borderRadius: 2, display: 'inline-block' }} /> Ballistic
                </span>
                <span style={{ color: '#22D3EE', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 16, height: 3, background: '#22D3EE', borderRadius: 2, display: 'inline-block' }} /> Drones
                </span>
              </div>
            </div>

            {/* Chart area */}
            <svg width="100%" height="220" viewBox="0 0 700 220" preserveAspectRatio="none">
              <defs>
                <linearGradient id="d5-drone-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="d5-ball-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Horizontal grid */}
              {[0,1,2,3].map(i => (
                <line key={i} x1="0" y1={i*55+20} x2="700" y2={i*55+20}
                  stroke="#FFFFFF06" strokeWidth="1" />
              ))}

              {/* Drone area */}
              <path d={
                `M ${DATA.daily.map((d, i) => `${i * 100 + 50},${200 - (d.drones / maxTotal) * 170}`).join(' L ')} L 650,200 L 50,200 Z`
              } fill="url(#d5-drone-fill)" />
              <polyline
                points={DATA.daily.map((d, i) => `${i * 100 + 50},${200 - (d.drones / maxTotal) * 170}`).join(' ')}
                fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinejoin="round"
              />

              {/* Ballistic area */}
              <path d={
                `M ${DATA.daily.map((d, i) => `${i * 100 + 50},${200 - (d.ballistic / maxTotal) * 170}`).join(' L ')} L 650,200 L 50,200 Z`
              } fill="url(#d5-ball-fill)" />
              <polyline
                points={DATA.daily.map((d, i) => `${i * 100 + 50},${200 - (d.ballistic / maxTotal) * 170}`).join(' ')}
                fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinejoin="round"
              />

              {/* Data dots */}
              {DATA.daily.map((d, i) => (
                <g key={i}>
                  <circle cx={i * 100 + 50} cy={200 - (d.drones / maxTotal) * 170}
                    r="4" fill="#050B1A" stroke="#22D3EE" strokeWidth="2" />
                  <circle cx={i * 100 + 50} cy={200 - (d.ballistic / maxTotal) * 170}
                    r="3.5" fill="#050B1A" stroke="#F59E0B" strokeWidth="2" />
                  <text x={i * 100 + 50} y={215} fill="#FFFFFF33"
                    fontSize="10" textAnchor="middle" fontFamily="DM Sans">
                    {d.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 20, display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: '#E8E8ED22'
          }}>
            <span>Sources: MoD, OSINT</span>
            <span>ww3live.xyz</span>
          </div>
        </div>
      </div>
    </>
  );
}
