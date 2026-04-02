import { useState, useEffect } from 'react';
import FlightChart from '../components/FlightChart';

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
  { code: 'JED', name: 'King Abdulaziz International', country: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}', file: 'data-flights-jed.json' },
  { code: 'RUH', name: 'King Khalid International', country: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}', file: 'data-flights-ruh.json' },
  { code: 'IKA', name: 'Imam Khomeini International', country: 'Iran', flag: '\u{1F1EE}\u{1F1F7}', file: 'data-flights-ika.json' },
];

function getCapacity(data) {
  if (!data?.daily?.length || !data.preConflictAvg) return null;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = data.daily.filter(d => d.date < today).at(-1);
  if (!yesterday) return null;
  return { pct: Math.round((yesterday.total / data.preConflictAvg) * 100), yesterdayTotal: yesterday.total, baseline: data.preConflictAvg };
}

function getTrafficLight(cap) {
  if (!cap) return { color: '#6B7280', label: 'No data' };
  if (cap.pct >= 80) return { color: '#34D399', label: 'Operational' };
  if (cap.pct >= 20) return { color: '#F59E0B', label: 'Partial' };
  return { color: '#EF4444', label: 'Restricted' };
}

const COUNTRY_GROUPS = [
  { country: "UAE",          flag: "🇦🇪", codes: ["DXB","AUH","DWC"] },
  { country: "Saudi Arabia", flag: "🇸🇦", codes: ["JED","RUH"] },
  { country: "Qatar",        flag: "🇶🇦", codes: ["DOH"] },
  { country: "Oman",         flag: "🇴🇲", codes: ["MCT"] },
  { country: "Israel",       flag: "🇮🇱", codes: ["TLV"] },
  { country: "Iran",         flag: "🇮🇷", codes: ["IKA"] },
];

function AirportCard({ airport, data }) {
  const cap = getCapacity(data);
  const light = getTrafficLight(cap);

  return (
    <div style={{
      background: CARD_BG,
      backdropFilter: GLASS_BLUR,
      border: `1px solid ${GLASS_BORDER}`,
      borderLeft: `3px solid ${light.color}`,
      borderRadius: GLASS_RADIUS,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: TEXT }}>{airport.code}</span>
          {data?.airport && (
            <span style={{ fontSize: '0.7rem', color: SUBTEXT }}>({data.airport})</span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: SUBTEXT }}>{data?.airportName || airport.name}</div>
      </div>

      {/* Capacity */}
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: light.color, lineHeight: 1.1 }}>
          {cap ? `${cap.pct}%` : '—'}
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: light.color, marginTop: 2 }}>
          {light.label}
        </div>
        {cap && (
          <div style={{ fontSize: 11, color: SUBTEXT, marginTop: 6 }}>
            Yesterday: {cap.yesterdayTotal.toLocaleString()} flights · Baseline: {cap.baseline.toLocaleString()}/day
          </div>
        )}
      </div>

      {/* Today scheduled */}
      {data?.todayTotal != null && (
        <div style={{ fontSize: 11, color: SUBTEXT, marginTop: 'auto' }}>
          Today: {data.todayTotal.toLocaleString()} scheduled
        </div>
      )}
    </div>
  );
}

export default function FlightsView({ onBack }) {
  const [airportData, setAirportData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/';
    Promise.all(
      AIRPORTS.map(a =>
        fetch(`${base}${a.file}`)
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

        {/* Flight volume chart */}
        <div style={{ marginBottom: 24 }}>
          <FlightChart />
        </div>

        {/* Airport grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: SUBTEXT }}>Loading flight data...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {COUNTRY_GROUPS.map(group => {
              const groupAirports = AIRPORTS.filter(a => group.codes.includes(a.code));
              return (
                <div key={group.country} style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  padding: "16px 20px",
                  background: "rgba(255,255,255,0.02)",
                }}>
                  {/* Country header: flag emoji only, no text */}
                  <div style={{ fontSize: 22, marginBottom: 14 }}>{group.flag}</div>
                  {/* Airport cards in a responsive grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 14,
                  }}>
                    {groupAirports.map(airport => (
                      <AirportCard key={airport.code} airport={airport} data={airportData[airport.code]} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
