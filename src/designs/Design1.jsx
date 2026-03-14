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

export default function Design1() {
  const [selected, setSelected] = useState("UAE");
  const maxTotal = Math.max(...DATA.daily.map(d => d.total));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
        .d1-root * { box-sizing: border-box; font-family: 'JetBrains Mono', monospace; }
        .d1-root { background: #000; color: #00FF41; min-height: 100vh; padding: 0; }
        @keyframes d1-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes d1-scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
      <div className="d1-root" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Scanline effect */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'rgba(0,255,65,0.1)', animation: 'd1-scanline 8s linear infinite',
          pointerEvents: 'none', zIndex: 1
        }} />

        {/* Header */}
        <div style={{
          borderBottom: '1px solid #00FF41',
          padding: '16px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontSize: 28, fontWeight: 700, letterSpacing: 4,
              textShadow: '0 0 10px #00FF41, 0 0 20px #00FF41'
            }}>WW3LIVE.XYZ</span>
            <span style={{
              fontSize: 10, color: '#000', background: '#FF0000',
              padding: '2px 8px', fontWeight: 700,
              animation: 'd1-blink 1s infinite'
            }}>● LIVE</span>
          </div>
          <div style={{ fontSize: 12, color: '#FFB000' }}>
            SYS.TIME {DATA.lastUpdated} // CLASSIFICATION: UNCLASSIFIED
          </div>
        </div>

        {/* Country selector */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid #00FF41',
        }}>
          {COUNTRIES.map(c => (
            <button key={c} onClick={() => setSelected(c)} style={{
              flex: 1, padding: '10px 0', background: selected === c ? '#00FF41' : 'transparent',
              color: selected === c ? '#000' : '#00FF41',
              border: 'none', borderRight: '1px solid #003B00',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 13,
              fontWeight: selected === c ? 700 : 400, cursor: 'pointer',
              letterSpacing: 2
            }}>{c}</button>
          ))}
        </div>

        {/* Status banner */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #00FF41'
        }}>
          <div style={{
            flex: 1, padding: '8px 32px', borderRight: '1px solid #00FF41',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{ fontSize: 11, color: '#FFB000' }}>HORMUZ STRAIT:</span>
            <span style={{
              fontSize: 14, fontWeight: 700, color: '#FF0000',
              textShadow: '0 0 8px #FF0000', letterSpacing: 3
            }}>{DATA.straits}</span>
          </div>
          <div style={{
            flex: 1, padding: '8px 32px',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{ fontSize: 11, color: '#FFB000' }}>THREAT LEVEL:</span>
            <span style={{
              fontSize: 14, fontWeight: 700, color: '#FF0000',
              textShadow: '0 0 8px #FF0000', letterSpacing: 3,
              animation: 'd1-blink 2s infinite'
            }}>{DATA.threatLevel}</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ padding: '24px 32px' }}>
          {/* Stat cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16, marginBottom: 32
          }}>
            {[
              { label: 'TOTAL DETECTED', value: DATA.totalDetected, color: '#00FF41' },
              { label: 'INTERCEPTED', value: DATA.totalIntercepted, color: '#00FF41' },
              { label: 'INTERCEPT RATE', value: DATA.interceptionRate + '%', color: '#FFB000' },
              { label: 'CASUALTIES (KIA/WIA)', value: `${DATA.killed} / ${DATA.injured}`, color: '#FF0000' },
            ].map((s, i) => (
              <div key={i} style={{
                border: `1px solid ${s.color}33`,
                padding: '20px 16px',
                background: `${s.color}08`,
                position: 'relative'
              }}>
                {/* Corner brackets */}
                <div style={{ position:'absolute',top:0,left:0,width:8,height:8,borderTop:`2px solid ${s.color}`,borderLeft:`2px solid ${s.color}` }} />
                <div style={{ position:'absolute',top:0,right:0,width:8,height:8,borderTop:`2px solid ${s.color}`,borderRight:`2px solid ${s.color}` }} />
                <div style={{ position:'absolute',bottom:0,left:0,width:8,height:8,borderBottom:`2px solid ${s.color}`,borderLeft:`2px solid ${s.color}` }} />
                <div style={{ position:'absolute',bottom:0,right:0,width:8,height:8,borderBottom:`2px solid ${s.color}`,borderRight:`2px solid ${s.color}` }} />

                <div style={{ fontSize: 10, color: '#FFB000', marginBottom: 8, letterSpacing: 2 }}>
                  {s.label}
                </div>
                <div style={{
                  fontSize: 36, fontWeight: 700, color: s.color,
                  textShadow: `0 0 20px ${s.color}`,
                  letterSpacing: 2
                }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Chart section */}
          <div style={{
            border: '1px solid #00FF4133',
            padding: 24,
            background: '#00FF4105'
          }}>
            <div style={{
              fontSize: 11, color: '#FFB000', letterSpacing: 2, marginBottom: 20
            }}>
              DAILY ATTACK VOLUME // {DATA.daily[0].label} - {DATA.daily[DATA.daily.length-1].label}
            </div>

            {/* Bar chart */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
              {DATA.daily.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{
                    fontSize: 11, color: '#00FF41', marginBottom: 4, fontWeight: 700
                  }}>{d.total}</div>
                  {/* Ballistic segment */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{
                      height: (d.drones / maxTotal) * 160,
                      background: 'linear-gradient(180deg, #00FF41 0%, #003B00 100%)',
                      boxShadow: '0 0 10px #00FF4144',
                      borderTop: '1px solid #00FF41'
                    }} />
                    <div style={{
                      height: (d.ballistic / maxTotal) * 160,
                      background: 'linear-gradient(180deg, #FFB000 0%, #3B2800 100%)',
                      boxShadow: '0 0 10px #FFB00044'
                    }} />
                  </div>
                  <div style={{
                    fontSize: 9, color: '#00FF4188', marginTop: 8, letterSpacing: 1
                  }}>{d.label.replace('Mar ', 'M')}</div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 10 }}>
              <span><span style={{ color: '#00FF41' }}>■</span> DRONES</span>
              <span><span style={{ color: '#FFB000' }}>■</span> BALLISTIC</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 24, fontSize: 9, color: '#00FF4144',
            display: 'flex', justifyContent: 'space-between',
            borderTop: '1px solid #00FF4111', paddingTop: 12
          }}>
            <span>SRC: MOD/OSINT // REFRESH: 60s</span>
            <span>ww3live.xyz // SITUATION AWARENESS TERMINAL v2.1</span>
          </div>
        </div>
      </div>
    </>
  );
}
