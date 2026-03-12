import { useState } from 'react';

const cards = [
  {
    id: 'threat',
    icon: '🚀',
    title: 'Threat Tracker',
    desc: 'Missiles, drones, interceptions across UAE/GCC',
    glow: 'rgba(255, 50, 50, 0.4)',
    border: 'rgba(255, 50, 50, 0.25)',
    hoverBorder: 'rgba(255, 50, 50, 0.6)',
  },
  {
    id: 'flights',
    icon: '✈️',
    title: 'Flight Monitor',
    desc: 'Airport status, regional air travel risk',
    glow: 'rgba(60, 130, 255, 0.4)',
    border: 'rgba(60, 130, 255, 0.25)',
    hoverBorder: 'rgba(60, 130, 255, 0.6)',
  },
  {
    id: 'hormuz',
    icon: '🛢️',
    title: 'Hormuz Watch',
    desc: 'Strait of Hormuz shipping traffic & oil flow',
    glow: 'rgba(220, 170, 40, 0.4)',
    border: 'rgba(220, 170, 40, 0.25)',
    hoverBorder: 'rgba(220, 170, 40, 0.6)',
  },
];

const stats = [
  { label: 'threats detected', value: '1,780', color: '#ff4444' },
  { label: 'intercepted', value: '94.2%', color: '#44ff88' },
  { label: 'Hormuz', value: 'CLOSED', color: '#ffaa22' },
];

const keyframesStyle = `
@keyframes bgShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 4px 2px rgba(255,50,50,0.6); }
  50%      { opacity: 0.4; box-shadow: 0 0 8px 4px rgba(255,50,50,0.2); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

export default function Landing({ onSelect }) {
  const [hovered, setHovered] = useState(null);

  return (
    <>
      <style>{keyframesStyle}</style>
      <div
        style={{
          minHeight: '100vh',
          background: 'radial-gradient(ellipse at 50% 0%, #1a1020 0%, #0a0a0f 50%, #050508 100%)',
          backgroundSize: '200% 200%',
          animation: 'bgShift 20s ease infinite',
          color: '#E8E8E8',
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle radial glow */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120vw',
            height: '60vh',
            background: 'radial-gradient(ellipse, rgba(180,60,60,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            maxWidth: 960,
            width: '100%',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
            animation: 'fadeInUp 0.8s ease-out',
          }}
        >
          {/* Live indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 32,
              padding: '6px 16px',
              background: 'rgba(255,50,50,0.08)',
              border: '1px solid rgba(255,50,50,0.2)',
              borderRadius: 20,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ff3333',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: '#ff4444',
                fontFamily: 'monospace',
              }}
            >
              LIVE
            </span>
          </div>

          {/* Hero heading */}
          <h1
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
              fontWeight: 800,
              fontFamily: "'Courier New', Courier, monospace",
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
              background: 'linear-gradient(135deg, #ffffff 0%, #999999 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ww3live.xyz
          </h1>

          {/* Tagline */}
          <p
            style={{
              color: '#666',
              fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
              margin: '0 0 36px',
              fontWeight: 400,
              letterSpacing: '0.02em',
            }}
          >
            Real-time conflict intelligence.
          </p>

          {/* Stat pills */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 64,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${s.color}33`,
                  borderRadius: 24,
                  boxShadow: `0 0 12px ${s.color}15`,
                }}
              >
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: s.color,
                    fontFamily: 'monospace',
                  }}
                >
                  {s.value}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
              gap: 24,
              marginBottom: 64,
            }}
          >
            {cards.map((c) => {
              const isHovered = hovered === c.id;
              return (
                <div
                  key={c.id}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: isHovered
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isHovered ? c.hoverBorder : c.border}`,
                    borderRadius: 16,
                    padding: '36px 28px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: isHovered
                      ? `0 8px 32px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
                      : '0 2px 12px rgba(0,0,0,0.3)',
                  }}
                  onClick={() => onSelect(c.id)}
                >
                  <div style={{ fontSize: '2.4rem', marginBottom: 16 }}>{c.icon}</div>
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      marginBottom: 8,
                      margin: '0 0 8px',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {c.title}
                  </h2>
                  <p
                    style={{
                      color: '#777',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      margin: '0 0 24px',
                    }}
                  >
                    {c.desc}
                  </p>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      color: isHovered ? '#fff' : '#888',
                      transition: 'color 0.3s ease',
                      fontFamily: 'monospace',
                    }}
                  >
                    ENTER <span style={{ fontSize: '1.1rem' }}>→</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <p
            style={{
              color: '#444',
              fontSize: '0.75rem',
              letterSpacing: '0.03em',
              paddingBottom: 40,
            }}
          >
            Data sourced from official MoD statements, IDF, and OSINT. Updated daily.
          </p>
        </div>
      </div>
    </>
  );
}
