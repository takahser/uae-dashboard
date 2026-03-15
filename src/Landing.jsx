import { useState, useEffect } from 'react';

// Dark Glassmorphism design tokens (matching App.jsx)
const BG = '#050B1A';
const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BLUR = 'blur(40px)';
const GLASS_BORDER = '1px solid rgba(255,255,255,0.11)';
const GLASS_RADIUS = 16;
const ACCENT = '#F59E0B';
const ACCENT_DARK = '#D97706';
const SECONDARY = '#3B82F6';
const TEXT = '#E8E8ED';
const SUBTEXT = 'rgba(232,232,237,0.53)';
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const ICON_WRAP = {
  width: 56, height: 56, borderRadius: '50%',
  background: 'rgba(245,158,11,0.1)',
  border: '1px solid rgba(245,158,11,0.2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: 16,
};

const CardIcons = {
  threat: (
    <div style={ICON_WRAP}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#F59E0B" strokeWidth="1.5">
        <circle cx="24" cy="24" r="20"/>
        <circle cx="24" cy="24" r="12"/>
        <circle cx="24" cy="24" r="4" fill="#F59E0B" stroke="none"/>
        <line x1="24" y1="4" x2="24" y2="10"/>
        <line x1="24" y1="38" x2="24" y2="44"/>
        <line x1="4" y1="24" x2="10" y2="24"/>
        <line x1="38" y1="24" x2="44" y2="24"/>
        <line x1="24" y1="24" x2="38" y2="10" strokeOpacity="0.5"/>
      </svg>
    </div>
  ),
  flights: (
    <div style={ICON_WRAP}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Fuselage */}
        <path d="M24 6 C25.5 6 27 7.5 27 10 L27 27"/>
        <path d="M24 6 C22.5 6 21 7.5 21 10 L21 27"/>
        <path d="M21 27 L24 30 L27 27"/>
        {/* Main wings */}
        <path d="M21 20 L7 30 L9 32 L21 25"/>
        <path d="M27 20 L41 30 L39 32 L27 25"/>
        {/* Tail */}
        <path d="M21 34 L15 40 L17 41 L24 37 L31 41 L33 40 L27 34"/>
      </svg>
    </div>
  ),
  hormuz: (
    <div style={ICON_WRAP}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#F59E0B" strokeWidth="1.5">
        <path d="M6 30 Q12 26 18 30 Q24 34 30 30 Q36 26 42 30"/>
        <path d="M6 36 Q12 32 18 36 Q24 40 30 36 Q36 32 42 36"/>
        <rect x="12" y="16" width="24" height="12" rx="2"/>
        <rect x="18" y="10" width="8" height="6" rx="1"/>
        <line x1="24" y1="10" x2="24" y2="6"/>
      </svg>
    </div>
  ),
};

const cards = [
  {
    id: 'threat',
    title: 'Threat Tracker',
    desc: 'Missiles, drones, interceptions across UAE/GCC',
  },
  {
    id: 'flights',
    title: 'Flight Monitor',
    desc: 'All GCC airports \u2014 status, capacity, risk',
  },
  {
    id: 'hormuz',
    title: 'Hormuz Watch',
    desc: 'Strait of Hormuz shipping traffic & oil flow',
  },
];

const DEFAULT_STATS = [
  { label: 'threats detected', value: '1,816' },
  { label: 'intercepted', value: '94.2%' },
  { label: 'Hormuz', value: 'CLOSED' },
];

const keyframesStyle = `
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
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    fetch(base + 'data-uae.json').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      const c = d.cumulative || {};
      const det = (c.ballisticDetected || 0) + (c.cruiseDetected || 0) + (c.dronesDetected || 0);
      const int_ = (c.ballisticIntercepted || 0) + (c.cruiseIntercepted || 0) + (c.dronesIntercepted || 0);
      const rate = det > 0 ? ((int_ / det) * 100).toFixed(1) + '%' : '—';
      setStats([
        { label: 'threats detected', value: det.toLocaleString() },
        { label: 'intercepted', value: rate },
        { label: 'Hormuz', value: 'CLOSED' },
      ]);
    }).catch(() => {});
  }, []);

  return (
    <>
      <style>{keyframesStyle}</style>
      <div
        style={{
          minHeight: '100vh',
          background: BG,
          color: TEXT,
          fontFamily: DM_SANS,
          padding: '0 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background gradient orbs */}
        <div style={{ position: 'fixed', top: -200, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, #F59E0B11 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: -200, left: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #3B82F611 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

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
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 48,
              padding: '16px 0',
            }}
          >
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: BG,
              }}>W</div>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: TEXT }}>
                ww3live<span style={{ color: ACCENT }}>.xyz</span>
              </span>
            </div>

            {/* LIVE badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                background: 'rgba(255,50,50,0.08)',
                border: '1px solid rgba(255,50,50,0.2)',
                borderRadius: 20,
              }}
            >
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#ff3333',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  fontSize: '0.75rem', fontWeight: 700,
                  letterSpacing: '0.15em', color: '#ff4444',
                }}
              >
                LIVE
              </span>
            </div>
          </div>

          {/* Hero heading */}
          <h1
            style={{
              fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
              fontWeight: 800,
              fontFamily: DM_SANS,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
              color: TEXT,
            }}
          >
            Real-time conflict intelligence.
          </h1>

          {/* Tagline */}
          <p
            style={{
              color: SUBTEXT,
              fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
              margin: '0 0 40px',
              fontWeight: 400,
              letterSpacing: '0.02em',
            }}
          >
            Iran vs GCC. Missiles, drones, flights & the Strait of Hormuz — tracked live.
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
                  padding: '10px 20px',
                  background: CARD_BG,
                  backdropFilter: GLASS_BLUR,
                  border: GLASS_BORDER,
                  borderRadius: 24,
                }}
              >
                <span
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: ACCENT,
                  }}
                >
                  {s.value}
                </span>
                <span style={{ fontSize: '0.8rem', color: SUBTEXT }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Feature cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
              gap: 24,
              marginBottom: 48,
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
                    background: CARD_BG,
                    backdropFilter: GLASS_BLUR,
                    border: GLASS_BORDER,
                    borderRadius: GLASS_RADIUS,
                    padding: '36px 28px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: isHovered
                      ? '0 0 24px rgba(245,158,11,0.15)'
                      : '0 2px 12px rgba(0,0,0,0.3)',
                  }}
                  onClick={() => onSelect(c.id)}
                >
                  {CardIcons[c.id]}
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      margin: '0 0 8px',
                      letterSpacing: '0.01em',
                      color: TEXT,
                    }}
                  >
                    {c.title}
                  </h2>
                  <p
                    style={{
                      color: SUBTEXT,
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
                      color: isHovered ? ACCENT : SUBTEXT,
                      transition: 'color 0.3s ease',
                    }}
                  >
                    ENTER <span style={{ fontSize: '1.1rem' }}>→</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* CTA button */}
          <button
            onClick={() => onSelect('threat')}
            style={{
              padding: '14px 36px',
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
              color: BG,
              border: 'none',
              borderRadius: 999,
              fontSize: '1rem',
              fontWeight: 700,
              fontFamily: DM_SANS,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              marginBottom: 24,
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={e => { e.target.style.transform = 'scale(1.04)'; e.target.style.boxShadow = '0 0 32px rgba(245,158,11,0.3)'; }}
            onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.boxShadow = 'none'; }}
          >
            Enter Dashboard →
          </button>

          {/* Footer */}
          <p
            style={{
              color: SUBTEXT,
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
