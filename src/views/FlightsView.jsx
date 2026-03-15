import { useState, useEffect } from 'react';

const BG = '#050B1A';
const CARD_BG = 'rgba(255,255,255,0.08)';
const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const GLASS_BLUR = 'blur(40px)';
const GLASS_RADIUS = 16;
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const ACCENT = '#F59E0B';
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const AIRPORTS = [
  { code: 'DXB', name: 'Dubai International', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', file: 'data-flights-dxb.json' },
  { code: 'AUH', name: 'Abu Dhabi International (Zayed)', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', file: 'data-flights-auh.json' },
  { code: 'DWC', name: 'Al Maktoum (Dubai World Central)', country: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', file: 'data-flights-dwc.json' },
  { code: 'MCT', name: 'Muscat International', country: 'Oman', flag: '\u{1F1F4}\u{1F1F2}', file: 'data-flights-mct.json' },
  { code: 'DOH', name: 'Hamad International', country: 'Qatar', flag: '\u{1F1F6}\u{1F1E6}', file: 'data-flights-doh.json' },
  { code: 'TLV', name: 'Ben Gurion', country: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', file: 'data-flights-tlv.json' },
];

const STATUS_STYLES = {
  open:       { label: 'OPEN',       color: '#34D399', bg: 'rgba(52,211,153,0.15)' },
  restricted: { label: 'RESTRICTED', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  closed:     { label: 'CLOSED',     color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

function AirportCard({ airport, data }) {
  const status = STATUS_STYLES[data?.status] || STATUS_STYLES.closed;

  return (
    <div style={{
      background: CARD_BG,
      backdropFilter: GLASS_BLUR,
      border: `1px solid ${GLASS_BORDER}`,
      borderRadius: GLASS_RADIUS,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 20 }}>{airport.flag}</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: TEXT }}>{airport.code}</span>
          {data?.airport && (
            <span style={{ fontSize: '0.7rem', color: SUBTEXT }}>({data.airport})</span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: SUBTEXT }}>{data?.airportName || airport.name}</div>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: status.bg, borderRadius: 8, padding: '6px 12px', alignSelf: 'flex-start',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: status.color, letterSpacing: 0.5 }}>{status.label}</span>
      </div>

      {/* Status note */}
      {data?.statusNote && (
        <div style={{ fontSize: '0.8rem', color: TEXT, lineHeight: 1.5 }}>
          {data.statusNote}
        </div>
      )}

      {/* Source + last verified */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data?.source && (
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>
            Source: {data.source}
          </div>
        )}
        {data?.lastVerified && (
          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
            Last verified: {data.lastVerified}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FlightsView({ onBack }) {
  const [airportData, setAirportData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      AIRPORTS.map(a =>
        fetch(`/${a.file}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      const map = {};
      AIRPORTS.forEach((a, i) => { map[a.code] = results[i]; });
      setAirportData(map);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: DM_SANS, padding: '40px 20px', position: 'relative', overflowX: 'hidden' }}>
      {/* Background gradient orbs */}
      <div style={{ position: 'fixed', top: -200, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, #F59E0B11 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -200, left: -100, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, #3B82F611 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 24, fontFamily: DM_SANS }}
        >
          ← Back to Dashboard
        </button>

        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
          GCC AIRPORT FLIGHT TRACKER
        </h1>
        <p style={{ fontSize: '0.85rem', color: SUBTEXT, marginBottom: 32 }}>
          Verified airport status across conflict-zone airports
        </p>

        {/* Airport grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: SUBTEXT }}>Loading flight data...</div>
        ) : (
          <div className="flights-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            <style>{`
              @media (max-width: 900px) {
                .flights-grid { grid-template-columns: repeat(2, 1fr) !important; }
              }
              @media (max-width: 600px) {
                .flights-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
            {AIRPORTS.map(a => (
              <AirportCard key={a.code} airport={a} data={airportData[a.code]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
