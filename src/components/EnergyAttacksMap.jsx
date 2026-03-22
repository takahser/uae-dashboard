import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import attacksRaw from '../data/energy-attacks.json';
import threatTargets from '../data/electrical-threats.json';

const GLASS_BORDER = 'rgba(255,255,255,0.11)';
const TEXT = '#E8EDF5';
const SUBTEXT = 'rgba(255,255,255,0.5)';
const ACCENT = '#F59E0B';
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const DAMAGE_COLORS = { severe: '#EF4444', moderate: '#F59E0B', minor: '#EAB308' };
const DAMAGE_RADII = { severe: 14, moderate: 10, minor: 7 };

const TYPE_LABELS = {
  oil_terminal: 'Oil Terminal',
  gas_field: 'Gas Field',
  gas_processing: 'Gas Processing',
  refinery: 'Refinery',
  lng: 'LNG',
  oil_field: 'Oil Field',
};

const attacks = [...attacksRaw].sort((a, b) => a.date.localeCompare(b.date));
const allDates = [...new Set(attacks.map(a => a.date))].sort();
const allCountries = [...new Set(attacks.map(a => a.country))].sort();

const PULSE_CSS = `
@keyframes attack-pulse-ring {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(3.5); opacity: 0; }
}
.attack-pulse-ring {
  position: absolute;
  top: 50%; left: 50%;
  width: 20px; height: 20px;
  margin-top: -10px; margin-left: -10px;
  border-radius: 50%;
  animation: attack-pulse-ring 1.2s ease-out forwards;
  pointer-events: none;
}
`;

function FlyToMarker({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 6), { duration: 0.8 });
    }
  }, [position, map]);
  return null;
}

// Renders pulse effects via imperative Leaflet markers
function PulseLayer({ pulseQueue }) {
  const map = useMap();
  const firedRef = useRef(new Set());
  useEffect(() => {
    pulseQueue.forEach(({ id, lat, lng, color }) => {
      if (firedRef.current.has(id)) return;
      firedRef.current.add(id);
      const icon = L.divIcon({
        className: '',
        html: `<div class="attack-pulse-ring" style="border: 2px solid ${color};"></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const marker = L.marker([lat, lng], { icon, interactive: false }).addTo(map);
      setTimeout(() => { try { map.removeLayer(marker); } catch {} }, 1400);
    });
  }, [pulseQueue, map]);
  return null;
}

// Strike count badges via imperative Leaflet markers
function StrikeBadges({ sites }) {
  const map = useMap();
  const markersRef = useRef([]);
  useEffect(() => {
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch {} });
    markersRef.current = [];
    sites.forEach(site => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#EF4444;color:#fff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;pointer-events:none;">${site.strikes}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, -4],
      });
      markersRef.current.push(L.marker([site.lat, site.lng], { icon, interactive: false }).addTo(map));
    });
    return () => {
      markersRef.current.forEach(m => { try { map.removeLayer(m); } catch {} });
    };
  }, [sites, map]);
  return null;
}

export default function EnergyAttacksMap() {
  const [timeIndex, setTimeIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [countryFilter, setCountryFilter] = useState(null);
  const [pulseQueue, setPulseQueue] = useState([]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [showThreats, setShowThreats] = useState(false);
  const timerRef = useRef(null);
  const shownIdsRef = useRef(new Set());

  const currentDate = showAll ? allDates[allDates.length - 1] : allDates[Math.min(timeIndex, allDates.length - 1)];

  const visibleAttacks = useMemo(() => {
    return attacks.filter(a => {
      if (!showAll && a.date > currentDate) return false;
      if (countryFilter && a.country !== countryFilter) return false;
      return true;
    });
  }, [currentDate, showAll, countryFilter]);

  const severeBadges = useMemo(() => {
    return visibleAttacks.filter(s => s.damage === 'severe' && s.strikes > 1);
  }, [visibleAttacks]);

  // Auto-play
  useEffect(() => {
    if (!playing || showAll) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeIndex(prev => {
        const next = prev + 1;
        if (next >= allDates.length) {
          setPlaying(false);
          return prev;
        }
        return next;
      });
    }, 600);
    return () => clearInterval(timerRef.current);
  }, [playing, showAll]);

  // Pulse + flyTo on new markers
  useEffect(() => {
    if (showAll) return;
    const newlyVisible = visibleAttacks.filter(a => !shownIdsRef.current.has(a.id));
    if (newlyVisible.length > 0) {
      const newPulses = newlyVisible.map(a => ({
        id: a.id, lat: a.lat, lng: a.lng, color: DAMAGE_COLORS[a.damage],
      }));
      newlyVisible.forEach(a => shownIdsRef.current.add(a.id));
      setPulseQueue(prev => [...prev, ...newPulses]);
      const target = newlyVisible[0];
      setFlyTarget([target.lat, target.lng]);
    }
  }, [visibleAttacks, showAll]);

  const handleShowAll = useCallback(() => {
    setShowAll(true);
    setPlaying(false);
    setTimeIndex(allDates.length - 1);
    attacks.forEach(a => shownIdsRef.current.add(a.id));
  }, []);

  const handleReset = useCallback(() => {
    setShowAll(false);
    setTimeIndex(0);
    setPlaying(true);
    shownIdsRef.current.clear();
    setPulseQueue([]);
    setFlyTarget(null);
  }, []);

  const handleScrub = useCallback((e) => {
    const val = parseInt(e.target.value, 10);
    setTimeIndex(val);
    setShowAll(false);
    setPlaying(false);
    const dateThreshold = allDates[val];
    const newShown = new Set();
    attacks.forEach(a => { if (a.date <= dateThreshold) newShown.add(a.id); });
    shownIdsRef.current = newShown;
  }, []);

  const formatDate = (d) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <style>{PULSE_CSS}</style>

      {/* Threat targets toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: '#FBBF24', fontWeight: 700, fontFamily: DM_SANS, letterSpacing: 0.5 }}>
          IRGC THREAT LIST — Unconfirmed targets. Not confirmed attacks.
        </span>
        <button
          onClick={() => setShowThreats(v => !v)}
          style={{
            background: showThreats ? '#FBBF24' : 'rgba(255,255,255,0.06)',
            color: showThreats ? '#000' : SUBTEXT,
            border: `1px solid ${showThreats ? '#FBBF24' : GLASS_BORDER}`,
            borderRadius: 6, padding: '4px 10px', fontSize: '0.72rem',
            fontWeight: 600, cursor: 'pointer', fontFamily: DM_SANS,
          }}
        >{showThreats ? '⚡ Threat Targets ON' : '⚡ Threat Targets'}</button>
      </div>

      {/* Country filter buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => setCountryFilter(null)}
          style={{
            background: !countryFilter ? ACCENT : 'rgba(255,255,255,0.06)',
            color: !countryFilter ? '#000' : SUBTEXT,
            border: `1px solid ${!countryFilter ? ACCENT : GLASS_BORDER}`,
            borderRadius: 6, padding: '4px 10px', fontSize: '0.72rem',
            fontWeight: 600, cursor: 'pointer', fontFamily: DM_SANS,
          }}
        >All Countries</button>
        {allCountries.map(c => (
          <button
            key={c}
            onClick={() => setCountryFilter(countryFilter === c ? null : c)}
            style={{
              background: countryFilter === c ? ACCENT : 'rgba(255,255,255,0.06)',
              color: countryFilter === c ? '#000' : SUBTEXT,
              border: `1px solid ${countryFilter === c ? ACCENT : GLASS_BORDER}`,
              borderRadius: 6, padding: '4px 10px', fontSize: '0.72rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: DM_SANS,
            }}
          >{c}</button>
        ))}
      </div>

      {/* Map */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${GLASS_BORDER}` }}>
        <MapContainer
          center={[27.5, 51]}
          zoom={5}
          style={{ height: 520, width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {flyTarget && playing && <FlyToMarker position={flyTarget} />}
          <PulseLayer pulseQueue={pulseQueue} />
          <StrikeBadges sites={severeBadges} />

          {visibleAttacks.map(site => {
            const color = DAMAGE_COLORS[site.damage];
            const radius = DAMAGE_RADII[site.damage];
            return (
              <CircleMarker
                key={site.id}
                center={[site.lat, site.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.75,
                  weight: site.damage === 'severe' ? 2.5 : 1.5,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: DM_SANS, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{site.name}</div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{site.country}</div>
                    <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        <tr><td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Type</td><td style={{ paddingBottom: 3 }}>{TYPE_LABELS[site.type] || site.type}</td></tr>
                        <tr><td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Date</td><td style={{ paddingBottom: 3 }}>{formatDate(site.date)}</td></tr>
                        <tr><td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Strikes</td><td style={{ paddingBottom: 3 }}>{site.strikes}</td></tr>
                        <tr>
                          <td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Damage</td>
                          <td style={{ paddingBottom: 3 }}>
                            <span style={{
                              color: '#fff', background: color,
                              borderRadius: 4, padding: '1px 6px',
                              fontSize: 11, fontWeight: 600,
                            }}>{site.damage}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {site.notes && (
                      <div style={{ fontSize: 11, color: '#555', marginTop: 6, lineHeight: 1.4, borderTop: '1px solid #eee', paddingTop: 6 }}>
                        {site.notes}
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {showThreats && threatTargets.map(t => (
            <CircleMarker
              key={`threat-${t.id}`}
              center={[t.lat, t.lng]}
              radius={10}
              pathOptions={{
                color: '#FBBF24',
                fillColor: '#FBBF24',
                fillOpacity: 0.25,
                weight: 2,
                dashArray: '6 4',
              }}
            >
              <Popup>
                <div style={{ fontFamily: DM_SANS, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: '#92400E' }}>⚡ THREAT TARGET</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{t.country}</div>
                  <table style={{ fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <tr><td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Capacity</td><td style={{ paddingBottom: 3 }}>{t.capacity_mw.toLocaleString()} MW</td></tr>
                      <tr><td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Notes</td><td style={{ paddingBottom: 3 }}>{t.notes}</td></tr>
                      <tr><td style={{ color: '#888', paddingRight: 8, paddingBottom: 3 }}>Source</td><td style={{ paddingBottom: 3 }}>{t.source}</td></tr>
                    </tbody>
                  </table>
                  <div style={{ fontSize: 10, color: '#B45309', marginTop: 6, borderTop: '1px solid #eee', paddingTop: 6, fontWeight: 600 }}>
                    UNCONFIRMED — IRGC threat, not a confirmed attack
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Timeline controls */}
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        background: 'rgba(5,11,26,0.75)', backdropFilter: 'blur(16px)',
        border: `1px solid ${GLASS_BORDER}`, borderRadius: 8,
        padding: '10px 16px',
      }}>
        <button
          onClick={() => { setPlaying(!playing); setShowAll(false); }}
          style={{
            background: playing ? '#EF4444' : ACCENT,
            color: playing ? '#fff' : '#000',
            border: 'none', borderRadius: 6, padding: '5px 14px',
            fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: DM_SANS,
          }}
        >{playing ? '⏸ Pause' : '▶ Play'}</button>
        <button
          onClick={handleShowAll}
          style={{
            background: showAll ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
            color: TEXT, border: `1px solid ${GLASS_BORDER}`,
            borderRadius: 6, padding: '5px 14px',
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: DM_SANS,
          }}
        >Show All</button>
        <button
          onClick={handleReset}
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: SUBTEXT, border: `1px solid ${GLASS_BORDER}`,
            borderRadius: 6, padding: '5px 10px',
            fontSize: '0.72rem', cursor: 'pointer', fontFamily: DM_SANS,
          }}
        >↺ Reset</button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <span style={{ fontSize: '0.72rem', color: SUBTEXT, whiteSpace: 'nowrap' }}>
            {formatDate(allDates[0])}
          </span>
          <input
            type="range"
            min={0}
            max={allDates.length - 1}
            value={showAll ? allDates.length - 1 : timeIndex}
            onChange={handleScrub}
            style={{ flex: 1, accentColor: ACCENT }}
          />
          <span style={{ fontSize: '0.72rem', color: SUBTEXT, whiteSpace: 'nowrap' }}>
            {formatDate(allDates[allDates.length - 1])}
          </span>
        </div>

        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: ACCENT }}>
          {formatDate(currentDate)}
        </span>
        <span style={{ fontSize: '0.72rem', color: SUBTEXT }}>
          {visibleAttacks.length} / {attacks.length} sites
        </span>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
        background: 'rgba(5,11,26,0.75)', backdropFilter: 'blur(16px)',
        border: `1px solid ${GLASS_BORDER}`, borderRadius: 8,
        padding: '10px 16px', fontSize: '0.75rem', color: SUBTEXT,
      }}>
        <span style={{ fontWeight: 700, color: TEXT, marginRight: 4 }}>Damage:</span>
        {Object.entries(DAMAGE_COLORS).map(([level, color]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: DAMAGE_RADII[level], height: DAMAGE_RADII[level], borderRadius: '50%', background: color, border: `1px solid ${color}` }} />
            <span style={{ textTransform: 'capitalize' }}>{level}</span>
          </div>
        ))}
        <span style={{ borderLeft: `1px solid ${GLASS_BORDER}`, height: 16, margin: '0 4px' }} />
        <span style={{ fontWeight: 700, color: TEXT, marginRight: 4 }}>Types:</span>
        {Object.values(TYPE_LABELS).map(label => (
          <span key={label} style={{ fontSize: '0.7rem' }}>{label}</span>
        ))}
      </div>
    </div>
  );
}
