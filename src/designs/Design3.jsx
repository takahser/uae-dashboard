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

export default function Design3() {
  const [selected, setSelected] = useState("UAE");
  const maxTotal = Math.max(...DATA.daily.map(d => d.total));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Exo+2:wght@300;400;600;700&display=swap');
        .d3-root * { box-sizing: border-box; }
        .d3-root {
          background: #0D0221;
          color: #E0E0FF;
          min-height: 100vh;
          font-family: 'Exo 2', sans-serif;
        }
        @keyframes d3-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes d3-glow {
          0%, 100% { box-shadow: 0 0 5px #00FFFF44, inset 0 0 5px #00FFFF11; }
          50% { box-shadow: 0 0 20px #00FFFF66, inset 0 0 10px #00FFFF22; }
        }
        @keyframes d3-neonFlicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { text-shadow: 0 0 7px #FF007F, 0 0 20px #FF007F, 0 0 40px #FF007F; }
          20%, 24%, 55% { text-shadow: none; }
        }
        @keyframes d3-slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div className="d3-root">
        {/* Grid background */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none'
        }} />

        {/* Header */}
        <div style={{
          padding: '20px 32px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #FF007F44',
          background: 'linear-gradient(180deg, #1A0533 0%, transparent 100%)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 30, fontWeight: 900,
              background: 'linear-gradient(90deg, #00FFFF, #FF007F)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              letterSpacing: 3
            }}>WW3LIVE</span>
            <span style={{
              fontFamily: 'Orbitron', fontSize: 12, color: '#00FFFF',
              border: '1px solid #00FFFF44', padding: '3px 10px',
              letterSpacing: 4
            }}>.XYZ</span>
          </div>
          <div style={{
            fontFamily: 'Orbitron', fontSize: 10, color: '#FF007F',
            letterSpacing: 3, animation: 'd3-pulse 2s infinite'
          }}>LIVE FEED // {DATA.lastUpdated}</div>
        </div>

        {/* Country selector */}
        <div style={{
          display: 'flex', gap: 8, padding: '16px 32px',
          borderBottom: '1px solid #00FFFF22'
        }}>
          {COUNTRIES.map(c => (
            <button key={c} onClick={() => setSelected(c)} style={{
              padding: '8px 16px',
              background: selected === c
                ? 'linear-gradient(135deg, #FF007F, #00FFFF)'
                : 'transparent',
              border: selected === c ? 'none' : '1px solid #00FFFF44',
              color: selected === c ? '#0D0221' : '#00FFFF',
              fontFamily: 'Orbitron, sans-serif', fontSize: 11,
              fontWeight: selected === c ? 700 : 400,
              cursor: 'pointer', letterSpacing: 2,
              clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)'
            }}>{c}</button>
          ))}
        </div>

        {/* Status banner */}
        <div style={{
          display: 'flex', gap: 12, padding: '12px 32px'
        }}>
          <div style={{
            flex: 1, padding: '10px 20px',
            background: 'linear-gradient(135deg, #FF007F22 0%, transparent 100%)',
            border: '1px solid #FF007F44',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#FF007F88', letterSpacing: 2 }}>HORMUZ</span>
            <span style={{
              fontFamily: 'Orbitron', fontSize: 16, fontWeight: 700,
              color: '#FF007F', animation: 'd3-neonFlicker 3s infinite', letterSpacing: 3
            }}>{DATA.straits}</span>
          </div>
          <div style={{
            flex: 1, padding: '10px 20px',
            background: 'linear-gradient(135deg, #00FFFF11 0%, transparent 100%)',
            border: '1px solid #00FFFF44',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: 10, color: '#00FFFF88', letterSpacing: 2 }}>THREAT</span>
            <span style={{
              fontFamily: 'Orbitron', fontSize: 16, fontWeight: 700,
              color: '#00FFFF', textShadow: '0 0 10px #00FFFF, 0 0 20px #00FFFF44',
              letterSpacing: 3
            }}>{DATA.threatLevel}</span>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12, padding: '8px 32px 24px'
        }}>
          {[
            { label: 'DETECTED', value: DATA.totalDetected, color: '#00FFFF', icon: '◆' },
            { label: 'INTERCEPTED', value: DATA.totalIntercepted, color: '#00FF88', icon: '◇' },
            { label: 'RATE', value: DATA.interceptionRate + '%', color: '#FFD700', icon: '◈' },
            { label: 'KIA / WIA', value: `${DATA.killed} / ${DATA.injured}`, color: '#FF007F', icon: '◉' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: 20,
              background: `linear-gradient(135deg, ${s.color}11 0%, #0D022100 60%)`,
              border: `1px solid ${s.color}33`,
              animation: `d3-glow 3s infinite ${i * 0.5}s`,
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Decorative corner */}
              <div style={{
                position: 'absolute', top: -1, right: -1,
                width: 20, height: 20,
                borderTop: `2px solid ${s.color}`,
                borderRight: `2px solid ${s.color}`
              }} />
              <div style={{
                fontSize: 10, color: `${s.color}88`, letterSpacing: 3,
                fontFamily: 'Orbitron', marginBottom: 8
              }}>{s.icon} {s.label}</div>
              <div style={{
                fontFamily: 'Orbitron', fontSize: 34, fontWeight: 900,
                color: s.color,
                textShadow: `0 0 30px ${s.color}66`
              }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{
          margin: '0 32px 32px',
          padding: 24,
          border: '1px solid #00FFFF22',
          background: 'linear-gradient(180deg, #1A053311 0%, transparent 100%)'
        }}>
          <div style={{
            fontFamily: 'Orbitron', fontSize: 11, color: '#FF007F',
            letterSpacing: 3, marginBottom: 20
          }}>ATTACK TIMELINE</div>

          <svg width="100%" height="200" viewBox="0 0 700 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="d3-grad-drone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FFFF" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00FFFF" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="d3-grad-ballistic" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF007F" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#FF007F" stopOpacity="0.1" />
              </linearGradient>
              <filter id="d3-glow-filter">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* Grid lines */}
            {[0,1,2,3,4].map(i => (
              <line key={i} x1="0" y1={i*45+10} x2="700" y2={i*45+10}
                stroke="#00FFFF11" strokeWidth="1" />
            ))}

            {/* Area chart for drones */}
            <path d={
              `M ${DATA.daily.map((d, i) => {
                const x = i * 100 + 50;
                const y = 190 - (d.drones / maxTotal) * 170;
                return `${x},${y}`;
              }).join(' L ')} L ${DATA.daily.length * 100 - 50},190 L 50,190 Z`
            } fill="url(#d3-grad-drone)" filter="url(#d3-glow-filter)" />

            {/* Line for drones */}
            <polyline
              points={DATA.daily.map((d, i) => `${i * 100 + 50},${190 - (d.drones / maxTotal) * 170}`).join(' ')}
              fill="none" stroke="#00FFFF" strokeWidth="2" filter="url(#d3-glow-filter)"
            />

            {/* Area for ballistic */}
            <path d={
              `M ${DATA.daily.map((d, i) => {
                const x = i * 100 + 50;
                const y = 190 - (d.ballistic / maxTotal) * 170;
                return `${x},${y}`;
              }).join(' L ')} L ${DATA.daily.length * 100 - 50},190 L 50,190 Z`
            } fill="url(#d3-grad-ballistic)" opacity="0.5" />

            {/* Data points */}
            {DATA.daily.map((d, i) => (
              <g key={i}>
                <circle cx={i * 100 + 50} cy={190 - (d.drones / maxTotal) * 170}
                  r="4" fill="#00FFFF" filter="url(#d3-glow-filter)" />
                <circle cx={i * 100 + 50} cy={190 - (d.ballistic / maxTotal) * 170}
                  r="3" fill="#FF007F" filter="url(#d3-glow-filter)" />
                <text x={i * 100 + 50} y={205} fill="#E0E0FF44"
                  fontSize="9" textAnchor="middle" fontFamily="Orbitron">
                  {d.label.replace('Mar ', '')}
                </text>
              </g>
            ))}
          </svg>

          <div style={{
            display: 'flex', gap: 24, marginTop: 8, fontSize: 10,
            fontFamily: 'Orbitron'
          }}>
            <span style={{ color: '#00FFFF' }}>● DRONES</span>
            <span style={{ color: '#FF007F' }}>● BALLISTIC</span>
          </div>
        </div>
      </div>
    </>
  );
}
