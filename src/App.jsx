import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

const UAE_GREEN = "#00732F";
const UAE_GOLD = "#CF9B1A";
const INTERCEPTED = "#00A86B";
const IMPACTED = "#C0392B";
const SEA = "#2980B9";
const BG = "#0A0F1E";
const CARD_BG = "#0F1829";
const BORDER = "#1A2840";
const TEXT = "#E8EDF5";
const SUBTEXT = "#8899BB";

// Live Intel map constants
const MAP_BG = "#060A14";
const MAP_LAND = "#0A1628";
const MAP_BORDER_COLOR = "#1A3050";
const MAP_GRID = "#0D2040";
const DRONE_HIT = "#C0392B";
const DEBRIS_HIT = "#E67E22";

const IMPACT_LOCATIONS = [
  { id: 1, name: "Palm Jumeirah / Fairmont Hotel", type: "drone_hit", date: "28 Feb", casualties: "4 injured", lat: 25.1425, lng: 55.1400, emirate: "Dubai" },
  { id: 2, name: "Dubai Intl Airport T3", type: "drone_hit", date: "28 Feb", casualties: "4 injured", lat: 25.2528, lng: 55.3644, emirate: "Dubai" },
  { id: 3, name: "US Consulate Dubai", type: "drone_hit", date: "~3 Mar", casualties: "None", lat: 25.2500, lng: 55.2900, emirate: "Dubai" },
  { id: 4, name: "Burj Al Arab", type: "debris", date: "28 Feb", casualties: "None", lat: 25.1413, lng: 55.1857, emirate: "Dubai" },
  { id: 5, name: "Jebel Ali Port", type: "debris", date: "28 Feb", casualties: "None", lat: 25.0050, lng: 55.0175, emirate: "Dubai" },
  { id: 6, name: "Zayed Intl Airport", type: "debris", date: "28 Feb", casualties: "1 killed, 7 injured", lat: 24.4267, lng: 54.6510, emirate: "Abu Dhabi" },
  { id: 7, name: "Camp de la Paix (French Naval Base)", type: "drone_hit", date: "1-2 Mar", casualties: "None", lat: 24.4475, lng: 54.3500, emirate: "Abu Dhabi" },
  { id: 8, name: "Etihad Towers", type: "debris", date: "28 Feb-3 Mar", casualties: "None", lat: 24.4397, lng: 54.3605, emirate: "Abu Dhabi" },
  { id: 9, name: "Sharjah (general area)", type: "drone_hit", date: "1 Mar", casualties: "None", lat: 25.3488, lng: 55.4121, emirate: "Sharjah" },
];

// Equirectangular projection: UAE bounds → SVG coords
const UAE_LAT_MIN = 22.5, UAE_LAT_MAX = 26.2, UAE_LNG_MIN = 51.5, UAE_LNG_MAX = 56.5;
const SVG_W = 800, SVG_H = 500;
function toSVG(lat, lng) {
  const x = ((lng - UAE_LNG_MIN) / (UAE_LNG_MAX - UAE_LNG_MIN)) * SVG_W;
  const y = ((UAE_LAT_MAX - lat) / (UAE_LAT_MAX - UAE_LAT_MIN)) * SVG_H;
  return { x, y };
}

// Simplified UAE emirate boundary paths (equirectangular projected)
const UAE_EMIRATES = [
  { name: "ABU DHABI", labelLat: 23.6, labelLng: 54.0, path: (() => {
    const pts = [[24.26,51.58],[24.01,51.59],[23.66,51.52],[23.10,52.00],[22.63,52.58],[22.63,53.98],[22.72,54.75],[23.56,55.16],[24.16,55.60],[24.27,55.76],[24.43,55.84],[24.59,55.46],[24.47,54.70],[24.42,54.36],[24.45,54.25],[24.50,54.38],[24.49,54.50],[24.51,54.71],[24.56,54.71],[24.52,54.42],[24.46,54.28],[24.48,54.22],[24.86,54.82],[24.87,55.08],[24.64,55.25],[24.47,55.37],[24.27,55.62],[24.21,55.75],[24.26,55.80],[24.12,55.87],[23.97,55.75],[24.01,55.53],[24.09,55.37],[24.16,55.23],[24.35,55.06],[24.61,54.93],[24.88,54.72],[25.00,54.06],[25.21,53.28],[25.38,52.56],[25.32,52.13],[25.00,51.87],[24.48,51.60],[24.26,51.58]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "DUBAI", labelLat: 25.15, labelLng: 55.22, path: (() => {
    const pts = [[25.33,55.15],[25.07,55.13],[24.88,55.14],[24.64,55.25],[24.87,55.08],[24.86,54.82],[24.48,54.22],[24.52,54.42],[24.56,54.71],[24.51,54.71],[24.49,54.50],[24.50,54.38],[24.45,54.25],[24.42,54.36],[24.47,54.70],[24.59,55.46],[24.43,55.84],[24.47,55.37],[24.64,55.25],[24.88,55.14],[25.07,55.13],[25.07,55.30],[25.18,55.29],[25.27,55.38],[25.33,55.35],[25.33,55.15]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "SHARJAH", labelLat: 25.35, labelLng: 55.50, path: (() => {
    const pts = [[25.35,55.35],[25.27,55.38],[25.18,55.29],[25.07,55.30],[25.07,55.50],[25.15,55.55],[25.30,55.55],[25.40,55.50],[25.40,55.45],[25.35,55.35]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "AJMAN", labelLat: 25.42, labelLng: 55.48, path: (() => {
    const pts = [[25.42,55.43],[25.40,55.45],[25.40,55.50],[25.44,55.52],[25.45,55.47],[25.42,55.43]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "UMM AL QUWAIN", labelLat: 25.52, labelLng: 55.60, path: (() => {
    const pts = [[25.50,55.50],[25.45,55.52],[25.44,55.60],[25.50,55.68],[25.57,55.65],[25.57,55.55],[25.50,55.50]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "RAS AL KHAIMAH", labelLat: 25.75, labelLng: 55.97, path: (() => {
    const pts = [[25.62,55.65],[25.57,55.65],[25.57,55.80],[25.68,55.95],[25.80,56.00],[25.95,56.05],[26.05,56.08],[26.08,56.02],[25.90,55.85],[25.75,55.75],[25.62,55.65]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "FUJAIRAH", labelLat: 25.40, labelLng: 56.20, path: (() => {
    const pts = [[25.13,56.18],[25.10,56.28],[25.20,56.35],[25.35,56.36],[25.50,56.32],[25.60,56.25],[25.68,56.10],[25.68,55.95],[25.57,55.80],[25.50,55.68],[25.44,55.60],[25.40,55.50],[25.30,55.55],[25.15,55.55],[25.07,55.50],[25.07,55.60],[25.05,55.85],[25.02,56.00],[25.05,56.10],[25.13,56.18]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
];

function buildDerivedData(raw) {
  const { cumulative, daily } = raw;

  const dailyData = daily.map((d, i) => ({
    day: d.label, label: `Day ${i + 1}`,
    ballistic: d.ballisticDetected, drones: d.dronesDetected, cruise: d.cruiseDetected,
    ballisticIntercepted: d.ballisticIntercepted, droneIntercepted: d.dronesIntercepted,
    droneImpact: d.dronesImpacted, ballisticSea: d.ballisticSea,
  }));

  let runDetected = 0, runIntercepted = 0, runImpacted = 0;
  const cumulativeData = daily.map((d) => {
    runDetected    += d.ballisticDetected + d.cruiseDetected + d.dronesDetected;
    runIntercepted += d.ballisticIntercepted + d.cruiseIntercepted + d.dronesIntercepted;
    runImpacted    += (d.ballisticImpacted || 0) + d.dronesImpacted;
    return { day: d.label, totalDetected: runDetected, totalIntercepted: runIntercepted, impacted: runImpacted };
  });

  const totalIntercepted = cumulative.ballisticIntercepted + cumulative.cruiseIntercepted + cumulative.dronesIntercepted;
  const totalDetected    = cumulative.ballisticDetected + cumulative.cruiseDetected + cumulative.dronesDetected;
  const totalImpacted    = (cumulative.ballisticImpacted || 0) + cumulative.dronesImpacted;

  const finalTotals = [
    { name: "Ballistic\nMissiles", detected: cumulative.ballisticDetected, intercepted: cumulative.ballisticIntercepted, sea: cumulative.ballisticSea, impacted: cumulative.ballisticImpacted },
    { name: "Cruise\nMissiles",    detected: cumulative.cruiseDetected,    intercepted: cumulative.cruiseIntercepted,    sea: 0, impacted: cumulative.cruiseImpacted },
    { name: "Drones\n(UAVs)",      detected: cumulative.dronesDetected,    intercepted: cumulative.dronesIntercepted,    sea: 0, impacted: cumulative.dronesImpacted },
  ];

  const pieData = [
    { name: "Intercepted",        value: totalIntercepted,         color: INTERCEPTED },
    { name: "Fell in Sea",        value: cumulative.ballisticSea,  color: SEA },
    { name: "Impacted Territory", value: totalImpacted,            color: IMPACTED },
  ];

  const ballisticRate = +((cumulative.ballisticIntercepted / cumulative.ballisticDetected) * 100).toFixed(1);
  const cruiseRate    = cumulative.cruiseDetected > 0 ? +((cumulative.cruiseIntercepted / cumulative.cruiseDetected) * 100).toFixed(1) : 100;
  const droneRate     = +((cumulative.dronesIntercepted / cumulative.dronesDetected) * 100).toFixed(1);
  const overallRate   = +((totalIntercepted / totalDetected) * 100).toFixed(1);

  const rateData = [
    { category: "Ballistic\nMissiles", rate: ballisticRate },
    { category: "Cruise\nMissiles",    rate: cruiseRate },
    { category: "Drones",              rate: droneRate },
    { category: "Overall",             rate: overallRate },
  ];

  const trendData = daily.map((d) => ({
    day: d.label, ballistic: d.ballisticDetected, cruise: d.cruiseDetected,
    drones: d.dronesDetected, total: d.total,
  }));

  return { dailyData, cumulativeData, finalTotals, pieData, rateData, trendData,
           cumulative, totalDetected, totalIntercepted, totalImpacted, overallRate };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#0D1525", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ color: UAE_GOLD, fontWeight: 700, marginBottom: 6, fontFamily: "Georgia, serif" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ label, value, sub, color = UAE_GOLD }) => (
  <div style={{
    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
    padding: "16px 20px", flex: 1, minWidth: 130,
    borderTop: `3px solid ${color}`
  }}>
    <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "Georgia, serif", letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 11, color: TEXT, fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: SUBTEXT, marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("intel");
  const [hoveredImpact, setHoveredImpact] = useState(null);
  const [selectedImpact, setSelectedImpact] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + "data.json")
      .then((r) => r.json())
      .then(setRawData)
      .catch(() => setError("Failed to load data.json"));
  }, []);

  if (error) return <div style={{ background: BG, color: IMPACTED, padding: 40, fontFamily: "monospace" }}>{error}</div>;
  if (!rawData) return <div style={{ background: BG, color: SUBTEXT, padding: 40, fontFamily: "monospace", minHeight: "100vh" }}>Loading...</div>;

  const { dailyData, cumulativeData, finalTotals, pieData, rateData, trendData,
          cumulative, totalDetected, totalIntercepted, totalImpacted, overallRate } = buildDerivedData(rawData);

  const lastUpdated = new Date(rawData.lastUpdated).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai"
  });
  const dayCount = rawData.daily.length;

  const tabs = [
    { id: "intel",       label: "Live Intel" },
    { id: "overview",    label: "Overview" },
    { id: "trends",      label: "Trend Lines" },
    { id: "daily",       label: "Daily Attacks" },
    { id: "cumulative",  label: "Cumulative" },
    { id: "rates",       label: "Interception Rates" },
    { id: "arsenal",     label: "Arsenal & Defence" },
  ];

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'Trebuchet MS', sans-serif", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #060C1A 0%, #0C1830 50%, #060C1A 100%)`,
        borderBottom: `1px solid ${BORDER}`, padding: "24px 28px 20px",
        position: "relative", overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, #1A2840 39px, #1A2840 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #1A2840 39px, #1A2840 40px)",
          opacity: 0.15
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div style={{
              background: UAE_GREEN, borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, color: "white", flexShrink: 0
            }}>🇦🇪</div>
            <div>
              <div style={{ fontSize: 11, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 3, fontWeight: 600 }}>UAE Ministry of Defence</div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, fontFamily: "Georgia, serif", letterSpacing: -0.5 }}>
                Iranian Attack Dashboard
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 11, color: SUBTEXT }}>
            <span>📅 28 Feb 2026 — Day {dayCount}</span>
            <span>📡 Source: @modgovae official statements</span>
            <span style={{ color: UAE_GOLD }}>⚡ Updated: {lastUpdated} GST</span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, padding: "20px 28px", flexWrap: "wrap" }}>
        <StatCard label="Total Detected" value={totalDetected.toLocaleString()} sub="Missiles + drones" color={UAE_GOLD} />
        <StatCard label="Intercepted" value={totalIntercepted.toLocaleString()} sub={`${overallRate}% success rate`} color={INTERCEPTED} />
        <StatCard label="Impacted Territory" value={totalImpacted.toLocaleString()} sub="Drones + missiles landed" color={IMPACTED} />
        <StatCard label="Fell in Sea" value={cumulative.ballisticSea.toLocaleString()} sub="Ballistic missiles only" color={SEA} />
        <StatCard label="Killed" value={cumulative.killed} sub="Pakistani, Nepali, Bangladeshi" color="#E74C3C" />
        <StatCard label="Injured" value={cumulative.injured} sub="16+ nationalities" color="#E67E22" />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 28px 20px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab === t.id ? UAE_GOLD : "transparent",
            color: activeTab === t.id ? "#000" : SUBTEXT,
            border: `1px solid ${activeTab === t.id ? UAE_GOLD : BORDER}`,
            borderRadius: 6, padding: "7px 16px", cursor: "pointer",
            fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
            transition: "all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "0 28px" }}>

        {/* LIVE INTEL TAB */}
        {activeTab === "intel" && (
          <div>
            <div style={{ position: "relative", background: MAP_BG, border: `1px solid ${MAP_BORDER_COLOR}`, borderRadius: 12, overflow: "hidden" }}>
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                <defs>
                  {/* Grid pattern */}
                  <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={MAP_GRID} strokeWidth="0.5" opacity="0.4" />
                  </pattern>
                  {/* Scan lines */}
                  <pattern id="scanLines" width="4" height="4" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="4" y2="0" stroke="#0A3060" strokeWidth="0.5" opacity="0.15" />
                  </pattern>
                  {/* Glow filters */}
                  <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor={DRONE_HIT} floodOpacity="0.6" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor={DEBRIS_HIT} floodOpacity="0.6" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <style>{`
                    @keyframes pulse {
                      0% { r: 5; opacity: 0.8; }
                      100% { r: 18; opacity: 0; }
                    }
                    @keyframes pulseFast {
                      0% { r: 5; opacity: 0.9; }
                      100% { r: 24; opacity: 0; }
                    }
                    .pulse-ring { animation: pulse 2s ease-out infinite; }
                    .pulse-ring-fast { animation: pulseFast 1.4s ease-out infinite; }
                  `}</style>
                </defs>

                {/* Background + grid + scanlines */}
                <rect width={SVG_W} height={SVG_H} fill={MAP_BG} />
                <rect width={SVG_W} height={SVG_H} fill="url(#mapGrid)" />
                <rect width={SVG_W} height={SVG_H} fill="url(#scanLines)" />

                {/* Emirate polygons */}
                {UAE_EMIRATES.map(e => (
                  <path key={e.name} d={e.path} fill={MAP_LAND} stroke={MAP_BORDER_COLOR} strokeWidth="1.2" opacity="0.9" />
                ))}

                {/* Emirate labels */}
                {UAE_EMIRATES.map(e => {
                  const { x, y } = toSVG(e.labelLat, e.labelLng);
                  return <text key={`lbl-${e.name}`} x={x} y={y} fill="#2A4A70" fontSize="7" fontFamily="monospace" textAnchor="middle" fontWeight="600" letterSpacing="1.5">{e.name}</text>;
                })}

                {/* Coordinate ticks - longitude */}
                {[52, 53, 54, 55, 56].map(lng => {
                  const { x } = toSVG(UAE_LAT_MIN, lng);
                  return <g key={`lng-${lng}`}>
                    <line x1={x} y1={SVG_H - 12} x2={x} y2={SVG_H} stroke="#1A3050" strokeWidth="0.5" />
                    <text x={x} y={SVG_H - 3} fill="#1A3050" fontSize="6" fontFamily="monospace" textAnchor="middle">{lng}°E</text>
                  </g>;
                })}
                {/* Coordinate ticks - latitude */}
                {[23, 24, 25, 26].map(lat => {
                  const { y } = toSVG(lat, UAE_LNG_MIN);
                  return <g key={`lat-${lat}`}>
                    <line x1={0} y1={y} x2={12} y2={y} stroke="#1A3050" strokeWidth="0.5" />
                    <text x={14} y={y + 2} fill="#1A3050" fontSize="6" fontFamily="monospace">{lat}°N</text>
                  </g>;
                })}

                {/* Impact markers */}
                {IMPACT_LOCATIONS.map(loc => {
                  const { x, y } = toSVG(loc.lat, loc.lng);
                  const color = loc.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT;
                  const hasCasualties = loc.casualties !== "None";
                  const filterId = loc.type === "drone_hit" ? "glowRed" : "glowOrange";
                  return (
                    <g key={loc.id}
                      onMouseEnter={() => setHoveredImpact(loc)}
                      onMouseLeave={() => setHoveredImpact(null)}
                      onClick={() => setSelectedImpact(selectedImpact?.id === loc.id ? null : loc)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Pulse ring */}
                      <circle cx={x} cy={y} fill="none" stroke={color} strokeWidth="1.5"
                        className={hasCasualties ? "pulse-ring-fast" : "pulse-ring"} />
                      {/* Marker dot */}
                      <circle cx={x} cy={y} r="4" fill={color} filter={`url(#${filterId})`} />
                      <circle cx={x} cy={y} r="1.5" fill="#fff" opacity="0.8" />
                    </g>
                  );
                })}

                {/* Map title overlay */}
                <text x="16" y="22" fill={UAE_GOLD} fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="2">LIVE INTEL — UAE IMPACT MAP</text>
                <text x="16" y="34" fill="#2A5A80" fontSize="7" fontFamily="monospace">CONFIRMED STRIKE LOCATIONS • FEB 28 – MAR 4, 2026</text>

                {/* Legend */}
                <g transform={`translate(${SVG_W - 170}, 16)`}>
                  <rect x="-8" y="-8" width="165" height="50" rx="4" fill="#060A14" fillOpacity="0.85" stroke={MAP_BORDER_COLOR} strokeWidth="0.5" />
                  <circle cx="6" cy="6" r="4" fill={DRONE_HIT} />
                  <text x="16" y="9" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Direct drone/missile hit</text>
                  <circle cx="6" cy="22" r="4" fill={DEBRIS_HIT} />
                  <text x="16" y="25" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Debris / shrapnel</text>
                  <circle cx="6" cy="38" r="3" fill="none" stroke={DRONE_HIT} strokeWidth="1" className="pulse-ring-fast" />
                  <circle cx="6" cy="38" r="2" fill={DRONE_HIT} />
                  <text x="16" y="41" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Casualties reported</text>
                </g>
              </svg>

              {/* Hover tooltip */}
              {hoveredImpact && (() => {
                const { x, y } = toSVG(hoveredImpact.lat, hoveredImpact.lng);
                const pctX = (x / SVG_W) * 100;
                const pctY = (y / SVG_H) * 100;
                const color = hoveredImpact.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT;
                return (
                  <div style={{
                    position: "absolute", left: `${pctX}%`, top: `${pctY}%`,
                    transform: `translate(${pctX > 70 ? "-110%" : "10%"}, -50%)`,
                    background: "#0B1420", border: `1px solid ${color}`, borderRadius: 6,
                    padding: "10px 14px", pointerEvents: "none", zIndex: 10,
                    minWidth: 180, boxShadow: `0 0 20px ${color}33`
                  }}>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                      {hoveredImpact.name}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#8899BB", lineHeight: 1.6 }}>
                      <div>TYPE: {hoveredImpact.type === "drone_hit" ? "DIRECT HIT" : "DEBRIS/SHRAPNEL"}</div>
                      <div>DATE: {hoveredImpact.date.toUpperCase()}</div>
                      <div>EMIRATE: {hoveredImpact.emirate.toUpperCase()}</div>
                      <div style={{ color: hoveredImpact.casualties !== "None" ? "#E74C3C" : "#556677" }}>
                        CASUALTIES: {hoveredImpact.casualties.toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Selected impact detail panel */}
            {selectedImpact && (
              <div style={{
                marginTop: 12, background: "#0B1420", border: `1px solid ${selectedImpact.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT}`,
                borderRadius: 8, padding: "14px 20px", fontFamily: "monospace"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: UAE_GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>INTEL BRIEFING — IMPACT SITE #{selectedImpact.id}</span>
                  <button onClick={() => setSelectedImpact(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: SUBTEXT, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>CLOSE</button>
                </div>
                <div style={{ fontSize: 13, color: "#33CC77", fontWeight: 700, marginBottom: 6 }}>{selectedImpact.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, fontSize: 9, color: "#8899BB" }}>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>WEAPON</div><div style={{ color: TEXT }}>{selectedImpact.type === "drone_hit" ? "Shahed drone / missile" : "Shrapnel / debris"}</div></div>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>DATE</div><div style={{ color: TEXT }}>{selectedImpact.date}</div></div>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>EMIRATE</div><div style={{ color: TEXT }}>{selectedImpact.emirate}</div></div>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>CASUALTIES</div><div style={{ color: selectedImpact.casualties !== "None" ? "#E74C3C" : TEXT }}>{selectedImpact.casualties}</div></div>
                </div>
                <div style={{ fontSize: 9, color: "#556677", marginTop: 8 }}>
                  COORDS: {selectedImpact.lat.toFixed(4)}°N, {selectedImpact.lng.toFixed(4)}°E
                </div>
              </div>
            )}

            {/* Info strip */}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <StatCard label="Impact Sites" value="9" sub="Confirmed locations" color={DRONE_HIT} />
              <StatCard label="Emirates Hit" value="3 / 7" sub="Dubai, Abu Dhabi, Sharjah" color={DEBRIS_HIT} />
              <StatCard label="Direct Hits" value="5" sub="Drone / missile strikes" color={DRONE_HIT} />
              <StatCard label="Debris Impacts" value="4" sub="Shrapnel / interception debris" color={DEBRIS_HIT} />
              <StatCard label="KIA" value="1" sub="Zayed Intl Airport" color="#E74C3C" />
              <StatCard label="WIA" value="15" sub="Across 3 sites" color="#E67E22" />
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Pie chart */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>All Projectiles — Final Outcome</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                    dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    labelLine={{ stroke: SUBTEXT, strokeWidth: 1 }} fontSize={11} fill={TEXT}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown bar */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Totals by Category</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={finalTotals} layout="vertical" barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                  <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="detected" name="Detected" fill="#1A3A5C" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="intercepted" name="Intercepted" fill={INTERCEPTED} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="impacted" name="Impacted Territory" fill={IMPACTED} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Interception rates */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Interception Rate by Category (%)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rateData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis domain={[88, 100]} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, "Rate"]} />
                  <Bar dataKey="rate" name="Interception Rate" radius={[4, 4, 0, 0]}>
                    {rateData.map((entry, i) => (
                      <Cell key={i} fill={entry.rate === 100 ? UAE_GOLD : INTERCEPTED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TRENDS TAB */}
        {activeTab === "trends" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Incoming by Category + Total</h3>
              <p style={{ margin: "0 0 24px", fontSize: 11, color: SUBTEXT }}>Projectiles detected per day — all categories tracked individually alongside total</p>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    {["total","ballistic","drones","cruise"].map((k, i) => (
                      <filter key={k} id={`glow-${k}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />

                  {/* Total — thick white, prominent */}
                  <Line
                    type="monotone" dataKey="total" name="Total (All)"
                    stroke="#FFFFFF" strokeWidth={3} strokeDasharray="6 3"
                    dot={{ fill: "#FFFFFF", r: 6, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 8, fill: "#FFFFFF" }}
                  />
                  {/* Drones */}
                  <Line
                    type="monotone" dataKey="drones" name="Drones (UAVs)"
                    stroke={UAE_GOLD} strokeWidth={2}
                    dot={{ fill: UAE_GOLD, r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Ballistic */}
                  <Line
                    type="monotone" dataKey="ballistic" name="Ballistic Missiles"
                    stroke="#4DA6FF" strokeWidth={2}
                    dot={{ fill: "#4DA6FF", r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Cruise */}
                  <Line
                    type="monotone" dataKey="cruise" name="Cruise Missiles"
                    stroke="#E74C3C" strokeWidth={2}
                    dot={{ fill: "#E74C3C", r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Annotation cards below */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {trendData.map((d, i) => (
                <div key={i} style={{
                  background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                  padding: "14px 16px",
                  borderTop: `3px solid ${i === 0 ? IMPACTED : i === 4 ? INTERCEPTED : BORDER}`
                }}>
                  <div style={{ fontSize: 11, color: UAE_GOLD, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{d.day}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, fontFamily: "Georgia, serif" }}>{d.total}</div>
                  <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 8 }}>total incoming</div>
                  <div style={{ fontSize: 10, color: "#4DA6FF" }}>🚀 {d.ballistic} ballistic</div>
                  <div style={{ fontSize: 10, color: UAE_GOLD }}>🚁 {d.drones} drones</div>
                  {d.cruise > 0 && <div style={{ fontSize: 10, color: "#E74C3C" }}>✈️ {d.cruise} cruise</div>}
                  {i === 0 && <div style={{ fontSize: 9, color: IMPACTED, marginTop: 6, fontWeight: 600 }}>⚠️ Peak day</div>}
                  {i === 4 && <div style={{ fontSize: 9, color: INTERCEPTED, marginTop: 6, fontWeight: 600 }}>↓ Lowest total</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAILY TAB */}
        {activeTab === "daily" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Ballistic Missiles</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Detected per day — attack intensity declining</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ballisticIntercepted" name="Intercepted" fill={INTERCEPTED} radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="ballisticSea" name="Fell in Sea" fill={SEA} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Drones (UAVs)</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Intercepted vs impacted territory</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="droneIntercepted" name="Intercepted" fill={INTERCEPTED} radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="droneImpact" name="Impacted Territory" fill={IMPACTED} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Total Daily Incoming (All Categories)</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Ballistic missiles + drones + cruise missiles per day</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorBallistic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2980B9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2980B9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDrones" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={UAE_GOLD} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={UAE_GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="ballistic" name="Ballistic Missiles" stroke="#2980B9" fill="url(#colorBallistic)" strokeWidth={2} />
                  <Area type="monotone" dataKey="drones" name="Drones" stroke={UAE_GOLD} fill="url(#colorDrones)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CUMULATIVE TAB */}
        {activeTab === "cumulative" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Running Total — Detected vs Intercepted</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Gap between lines = projectiles that reached/hit territory or sea</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="gradDetected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2980B9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2980B9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradIntercepted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={INTERCEPTED} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={INTERCEPTED} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="totalDetected" name="Total Detected" stroke="#2980B9" fill="url(#gradDetected)" strokeWidth={2} dot={{ fill: "#2980B9", r: 4 }} />
                  <Area type="monotone" dataKey="totalIntercepted" name="Total Intercepted" stroke={INTERCEPTED} fill="url(#gradIntercepted)" strokeWidth={2} dot={{ fill: INTERCEPTED, r: 4 }} />
                  <Area type="monotone" dataKey="impacted" name="Impacted Territory" stroke={IMPACTED} fill="none" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: IMPACTED, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Cumulative Impacted Territory</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Projectiles that penetrated UAE airspace and landed</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cumulativeData} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="impacted" name="Cumulative Impacted" radius={[4, 4, 0, 0]}>
                    {cumulativeData.map((_, i) => (
                      <Cell key={i} fill={`rgba(192, 57, 43, ${0.4 + i * 0.13})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* RATES TAB */}
        {activeTab === "rates" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              { label: "Ballistic Missiles", intercepted: 175, total: 189, rate: 92.6, color: "#2980B9" },
              { label: "Cruise Missiles", intercepted: 8, total: 8, rate: 100, color: UAE_GOLD },
              { label: "Drones (UAVs)", intercepted: 876, total: 941, rate: 93.1, color: INTERCEPTED },
              { label: "Overall", intercepted: 1059, total: 1138, rate: 93.1, color: "#9B59B6" },
            ].map((item, i) => (
              <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: item.color, fontFamily: "Georgia, serif", lineHeight: 1 }}>{item.rate}%</div>
                <div style={{ fontSize: 11, color: SUBTEXT, marginTop: 6 }}>interception rate</div>
                <div style={{ marginTop: 16, background: "#0A0F1E", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.rate}%`, background: item.color, borderRadius: 6, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: SUBTEXT }}>
                  <span>✅ {item.intercepted.toLocaleString()} intercepted</span>
                  <span>📡 {item.total.toLocaleString()} detected</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ARSENAL & DEFENCE TAB */}
        {activeTab === "arsenal" && (() => {
          const attackSystems = [
            {
              name: "Ballistic Missiles", sub: "MRBM", color: "#4DA6FF",
              img: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Kheibar_Shekan_%281%29.jpg",
              desc: "High-speed projectiles arcing through the upper atmosphere. Iran's most destructive but costly weapon.",
              types: "Kheibar Shekan, Emad, Fattah-1/2, Ghadr, Sejjil",
              speed: 8500, range: 2500, warhead: 1500, cost: 2750, altitude: 150,
              costLabel: "$500K–$5M", speedLabel: "Mach 7–13+", rangeLabel: "1,300–2,500km", altLabel: "150–1,000km",
            },
            {
              name: "Cruise Missiles", sub: "Subsonic Strike", color: "#E74C3C",
              img: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Hoveyzeh_cruise_missile.jpg",
              desc: "Jet-powered, low-altitude terrain-huggers that evade radar. Slower but stealthier.",
              types: "Paveh, Hoveyzeh, Soumar",
              speed: 900, range: 2000, warhead: 400, cost: 750, altitude: 0.05,
              costLabel: "$500K–$1M", speedLabel: "~900 km/h", rangeLabel: "1,350–2,500km", altLabel: "~50m",
            },
            {
              name: "Suicide Drones", sub: "Loitering Munitions", color: UAE_GOLD,
              img: "https://upload.wikimedia.org/wikipedia/commons/e/ef/2023_IRGC_Aerospace_Force_achievements_Exhibition_in_Kermanshah_%28018%29.jpg",
              desc: "Cheap GPS-guided kamikaze drones in massive swarms. Designed to exhaust expensive interceptor stocks.",
              types: "Shahed-136, Shahed-131, Mohajer-6",
              speed: 185, range: 2000, warhead: 50, cost: 35, altitude: 4,
              costLabel: "$20K–$50K", speedLabel: "~185 km/h", rangeLabel: "900–2,000km", altLabel: "1–4km",
            },
          ];
          const defenceSystems = [
            {
              name: "THAAD", maker: "Lockheed Martin (US)", color: "#4DA6FF",
              img: "https://upload.wikimedia.org/wikipedia/commons/4/45/The_first_of_two_Terminal_High_Altitude_Area_Defense_%28THAAD%29_interceptors_is_launched_during_a_successful_intercept_test_-_US_Army.jpg",
              target: "Ballistic missiles", altitude: 150, range: 200, cost: 12,
              costLabel: "$12M", desc: "Exo-atmospheric hit-to-kill. Sonic booms heard 100km away.",
            },
            {
              name: "Patriot PAC-3", maker: "Raytheon (US)", color: INTERCEPTED,
              img: "https://upload.wikimedia.org/wikipedia/commons/f/f8/Patriot_missile_launch_b.jpg",
              target: "Ballistic + cruise", altitude: 40, range: 35, cost: 4,
              costLabel: "$4–12M", desc: "Gulf workhorse. Lower-tier terminal phase interceptor.",
            },
            {
              name: "Cheongung-II", maker: "LIG Nex1 (South Korea)", color: "#9B59B6",
              img: "https://upload.wikimedia.org/wikipedia/commons/d/d1/M-SAM_Block-2_battery.jpg",
              target: "Medium-range threats", altitude: 20, range: 40, cost: 2.5,
              costLabel: "$2–3M", desc: "First-ever combat use. $3.5B UAE deal — proved itself here.",
            },
            {
              name: "Barak MX", maker: "IAI (Israel)", color: "#E67E22",
              img: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Salon_du_Bourget_20090619_077.jpg",
              target: "Multi-layer", altitude: 30, range: 150, cost: 1,
              costLabel: "~$1M", desc: "Modular system via Abraham Accords. Drones to ballistic.",
            },
          ];
          const comparisonData = [
            { metric: "Speed", ballistic: 100, cruise: 10.6, drone: 2.2 },
            { metric: "Range", ballistic: 100, cruise: 80, drone: 80 },
            { metric: "Altitude", ballistic: 100, cruise: 0.005, drone: 0.4 },
            { metric: "Warhead", ballistic: 100, cruise: 26.7, drone: 3.3 },
            { metric: "Cost", ballistic: 100, cruise: 27.3, drone: 1.3 },
          ];
          const defenceCompData = defenceSystems.map(s => ({
            name: s.name, altitude: s.altitude, range: s.range, cost: s.cost,
          }));
          return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

            {/* ATTACK SYSTEMS — image cards */}
            <h3 style={{ margin: 0, fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Iranian Attack Systems</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {attackSystems.map((w, i) => (
                <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", borderTop: `3px solid ${w.color}` }}>
                  <div style={{ height: 160, overflow: "hidden", position: "relative" }}>
                    <img src={w.img} alt={w.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 16px 12px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: w.color, fontFamily: "Georgia, serif" }}>{w.name}</div>
                      <div style={{ fontSize: 9, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 1 }}>{w.sub}</div>
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px 16px" }}>
                    <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 10 }}>{w.desc}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 10 }}>Types: {w.types}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, textAlign: "center" }}>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.speedLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>SPEED</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.altLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>FLIGHT ALTITUDE</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.rangeLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>RANGE</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.costLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>COST/UNIT</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ATTACK COMPARISON CHART */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Attack Systems — Comparison</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Relative capability across speed, range, warhead, and cost (normalised to highest)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v.toFixed(1)}%`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ballistic" name="Ballistic" fill="#4DA6FF" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cruise" name="Cruise" fill="#E74C3C" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="drone" name="Drone" fill={UAE_GOLD} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* DEFENCE SYSTEMS — image cards */}
            <h3 style={{ margin: "8px 0 0", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>UAE / Allied Defence Systems</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
              {defenceSystems.map((s, i) => (
                <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", borderTop: `3px solid ${s.color}` }}>
                  <div style={{ height: 120, overflow: "hidden", position: "relative" }}>
                    <img src={s.img} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.65)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 12px 8px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: "Georgia, serif" }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: SUBTEXT }}>{s.maker}</div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px 14px" }}>
                    <div style={{ fontSize: 10, color: UAE_GOLD, fontWeight: 600, marginBottom: 6 }}>{s.target}</div>
                    <div style={{ fontSize: 10, color: TEXT, lineHeight: 1.4, marginBottom: 8 }}>{s.desc}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, textAlign: "center" }}>
                      <div style={{ background: "#0A0F1E", borderRadius: 5, padding: "6px 4px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.altitude}km</div>
                        <div style={{ fontSize: 7, color: SUBTEXT }}>ALTITUDE</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 5, padding: "6px 4px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: IMPACTED }}>{s.costLabel}</div>
                        <div style={{ fontSize: 7, color: SUBTEXT }}>PER SHOT</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DEFENCE COMPARISON CHARTS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>Intercept Altitude (km)</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Maximum engagement altitude per system</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={defenceCompData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}km`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}km`, "Altitude"]} />
                    <Bar dataKey="altitude" name="Max Altitude" radius={[0, 4, 4, 0]}>
                      {defenceCompData.map((_, j) => <Cell key={j} fill={defenceSystems[j].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Interceptor Cost ($M)</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Cost per single interceptor missile</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={defenceCompData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, "Cost"]} />
                    <Bar dataKey="cost" name="Interceptor Cost" radius={[0, 4, 4, 0]}>
                      {defenceCompData.map((_, j) => <Cell key={j} fill={IMPACTED} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* COST ASYMMETRY */}
            {(() => {
              const AVG_BALLISTIC_COST = 2.75;
              const AVG_CRUISE_COST = 0.75;
              const AVG_DRONE_COST = 0.035;
              const AVG_BALLISTIC_INTERCEPT = 8;
              const AVG_CRUISE_INTERCEPT = 2.5;
              const AVG_DRONE_INTERCEPT = 2.5;
              const daily = rawData.daily;
              let cumAtk = 0, cumDef = 0;
              const costTimeline = daily.map(d => {
                const atkDay = d.ballisticDetected * AVG_BALLISTIC_COST + d.cruiseDetected * AVG_CRUISE_COST + d.dronesDetected * AVG_DRONE_COST;
                const defDay = d.ballisticIntercepted * AVG_BALLISTIC_INTERCEPT + d.cruiseIntercepted * AVG_CRUISE_INTERCEPT + d.dronesIntercepted * AVG_DRONE_INTERCEPT;
                cumAtk += atkDay;
                cumDef += defDay;
                return { day: d.label, atkDay: Math.round(atkDay), defDay: Math.round(defDay), cumAtk: Math.round(cumAtk), cumDef: Math.round(cumDef) };
              });
              const perUnitData = [
                { name: "Ballistic\nMissile", attack: AVG_BALLISTIC_COST, defence: AVG_BALLISTIC_INTERCEPT },
                { name: "Cruise\nMissile", attack: AVG_CRUISE_COST, defence: AVG_CRUISE_INTERCEPT },
                { name: "Drone", attack: AVG_DRONE_COST, defence: AVG_DRONE_INTERCEPT },
              ];
              return (
              <>
              <h3 style={{ margin: "8px 0 0", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cost Asymmetry</h3>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { label: "Drones", atk: "$20K–$50K", atkC: UAE_GOLD, def: "$1M–$4M", ratio: "20:1 — 200:1" },
                  { label: "Ballistic", atk: "$0.5M–$5M", atkC: "#4DA6FF", def: "$4M–$12M", ratio: "4:1 — 12:1" },
                  { label: "Total (5 days)", atk: `~$${costTimeline[costTimeline.length-1]?.cumAtk}M`, atkC: UAE_GOLD, def: `~$${(costTimeline[costTimeline.length-1]?.cumDef/1000).toFixed(1)}B`, ratio: "~$1B/day" },
                ].map((c, i) => (
                  <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, textAlign: "center", padding: 16 }}>
                    <div style={{ fontSize: 10, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>Attack: <span style={{ color: c.atkC, fontWeight: 700 }}>{c.atk}</span></div>
                    <div style={{ fontSize: 11, color: TEXT, marginBottom: 8 }}>Defence: <span style={{ color: IMPACTED, fontWeight: 700 }}>{c.def}</span></div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: IMPACTED, fontFamily: "Georgia, serif" }}>{c.ratio}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT }}>{i < 2 ? "cost disadvantage for defenders" : "estimated UAE daily defence cost"}</div>
                  </div>
                ))}
              </div>

              {/* Per-unit cost comparison */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cost per Unit: Attack vs Defence ($M)</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Average cost to launch one projectile vs cost to intercept it</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={perUnitData} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                    <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="attack" name="Iran (Attack)" fill={UAE_GOLD} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="defence" name="UAE (Defence)" fill={IMPACTED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Daily cost comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Daily Cost: Attack vs Defence ($M)</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Estimated spend per day by each side</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={costTimeline} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                      <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="atkDay" name="Iran (Attack)" fill={UAE_GOLD} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="defDay" name="UAE (Defence)" fill={IMPACTED} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cumulative Cost Over Time ($M)</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Running total — the widening gap between attack and defence spending</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={costTimeline}>
                      <defs>
                        <linearGradient id="gradAtk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={UAE_GOLD} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={UAE_GOLD} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradDef" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={IMPACTED} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={IMPACTED} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}B` : `$${v}M`} />
                      <Tooltip content={<CustomTooltip />} formatter={(v) => [v >= 1000 ? `$${(v/1000).toFixed(2)}B` : `$${v}M`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="cumAtk" name="Iran (Cumulative)" stroke={UAE_GOLD} fill="url(#gradAtk)" strokeWidth={2} dot={{ fill: UAE_GOLD, r: 4 }} />
                      <Area type="monotone" dataKey="cumDef" name="UAE (Cumulative)" stroke={IMPACTED} fill="url(#gradDef)" strokeWidth={2} dot={{ fill: IMPACTED, r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              </>
              );
            })()}

          </div>
          );
        })()}
      </div>

      <div style={{ textAlign: "center", marginTop: 32, fontSize: 10, color: "#3A4A60" }}>
        Data sourced exclusively from official UAE Ministry of Defence statements (@modgovae) • Feb 28 – Mar 4, 2026
      </div>
    </div>
  );
}
