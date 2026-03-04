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
  const [activeTab, setActiveTab] = useState("overview");
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
        {activeTab === "arsenal" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

            {/* ATTACK SYSTEMS */}
            <h3 style={{ margin: 0, fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Iranian Attack Systems</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {/* Ballistic Missiles */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderTop: "3px solid #4DA6FF" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#4DA6FF", fontFamily: "Georgia, serif", marginBottom: 4 }}>Ballistic Missiles</div>
                <div style={{ fontSize: 10, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Medium-Range Ballistic Missiles (MRBM)</div>
                <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6 }}>
                  <p style={{ margin: "0 0 8px" }}>High-speed projectiles that follow an arcing trajectory through the upper atmosphere. Iran's most destructive but expensive weapon class.</p>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Key Types</div>
                    <div>
                      <span style={{ color: "#4DA6FF" }}>Kheibar Shekan</span> — Solid-fuel, &lt;20m accuracy, Mach 8–10<br/>
                      <span style={{ color: "#4DA6FF" }}>Emad</span> — Maneuverable re-entry vehicle, 1,700km range<br/>
                      <span style={{ color: "#4DA6FF" }}>Fattah-1/2</span> — Claimed hypersonic (Mach 13+), glide vehicle<br/>
                      <span style={{ color: "#4DA6FF" }}>Ghadr</span> — Shahab-3 derivative, 1,950km range<br/>
                      <span style={{ color: "#4DA6FF" }}>Sejjil</span> — Two-stage solid-fuel, 2,500km range
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Specifications</div>
                    <div>Speed: Mach 7–13+ • Range: 1,300–2,500km</div>
                    <div>Warhead: 550–1,500kg • Prep: 15min (solid) to hours (liquid)</div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Cost per Unit</div>
                    <div style={{ color: "#4DA6FF", fontWeight: 700, fontSize: 13 }}>$500K – $5M</div>
                  </div>
                </div>
              </div>

              {/* Cruise Missiles */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderTop: "3px solid #E74C3C" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#E74C3C", fontFamily: "Georgia, serif", marginBottom: 4 }}>Cruise Missiles</div>
                <div style={{ fontSize: 10, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Subsonic Low-Altitude Strike</div>
                <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6 }}>
                  <p style={{ margin: "0 0 8px" }}>Jet-powered missiles that fly at low altitude to evade radar detection. Slower than ballistic missiles but harder to detect due to terrain-hugging flight profiles.</p>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Key Types</div>
                    <div>
                      <span style={{ color: "#E74C3C" }}>Paveh</span> — Longest-range (1,650km), Soumar family<br/>
                      <span style={{ color: "#E74C3C" }}>Hoveyzeh</span> — All-weather, low-altitude evasion, 1,350km<br/>
                      <span style={{ color: "#E74C3C" }}>Soumar</span> — Derived from Russian Kh-55, 2,000km+ range
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Specifications</div>
                    <div>Speed: ~900 km/h (subsonic) • Range: 1,350–2,500km</div>
                    <div>Warhead: 350–400kg • Flight: Low-altitude terrain following</div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Cost per Unit</div>
                    <div style={{ color: "#E74C3C", fontWeight: 700, fontSize: 13 }}>$500K – $1M</div>
                  </div>
                </div>
              </div>

              {/* Drones */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderTop: `3px solid ${UAE_GOLD}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: UAE_GOLD, fontFamily: "Georgia, serif", marginBottom: 4 }}>Suicide Drones</div>
                <div style={{ fontSize: 10, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>One-Way Attack / Loitering Munitions</div>
                <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.6 }}>
                  <p style={{ margin: "0 0 8px" }}>Cheap, GPS-guided kamikaze drones launched in massive swarms to overwhelm air defences. Iran's primary attritional weapon — designed to exhaust expensive interceptor stocks.</p>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Key Types</div>
                    <div>
                      <span style={{ color: UAE_GOLD }}>Shahed-136</span> — Primary weapon, 2,000km range, delta-wing<br/>
                      <span style={{ color: UAE_GOLD }}>Shahed-131</span> — Smaller variant, 900km range, 15kg warhead<br/>
                      <span style={{ color: UAE_GOLD }}>Mohajer-6</span> — Recoverable UCAV, 12hr endurance, ISR+strike
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Specifications</div>
                    <div>Speed: ~185 km/h • Range: 900–2,000km</div>
                    <div>Warhead: 15–50kg • Tactic: Mass swarm saturation</div>
                  </div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <div style={{ color: SUBTEXT, marginBottom: 4, fontWeight: 600 }}>Cost per Unit</div>
                    <div style={{ color: UAE_GOLD, fontWeight: 700, fontSize: 13 }}>$20K – $50K</div>
                  </div>
                </div>
              </div>
            </div>

            {/* DEFENCE SYSTEMS */}
            <h3 style={{ margin: "16px 0 0", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>UAE / Allied Defence Systems</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                {
                  name: "THAAD", maker: "Lockheed Martin (US)", color: "#4DA6FF",
                  target: "Ballistic missiles (high-altitude, exo-atmospheric)",
                  desc: "Terminal High Altitude Area Defense. Hit-to-kill kinetic interceptor that destroys ballistic missiles during their terminal descent phase at 40–150km altitude. Supersonic booms heard up to 100km away during intercepts.",
                  specs: "Altitude: 40–150km • Range: 200km",
                  cost: "$12M per interceptor",
                },
                {
                  name: "Patriot PAC-3 MSE", maker: "Raytheon / Lockheed Martin (US)", color: INTERCEPTED,
                  target: "Ballistic missiles, cruise missiles (lower tier)",
                  desc: "Workhorse of Gulf air defence. Hit-to-kill terminal phase interceptor for lower-altitude ballistic missiles and cruise missiles. Enhanced version (MSE) has expanded engagement envelope.",
                  specs: "Altitude: 15–40km • Range: 35km",
                  cost: "$4M per interceptor (US) / ~$12M (export)",
                },
                {
                  name: "Cheongung-II (M-SAM)", maker: "LIG Nex1 (South Korea)", color: "#9B59B6",
                  target: "Medium-range threats, short-range ballistic missiles",
                  desc: "First-ever combat deployment in UAE. Hit-to-kill medium-range air defence system. UAE purchased in a $3.5B deal — proved its capability in this conflict.",
                  specs: "Altitude: 15–20km • Range: 40km",
                  cost: "$2–3M per interceptor (est.)",
                },
                {
                  name: "Barak MX", maker: "IAI (Israel)", color: "#E67E22",
                  target: "Cruise missiles, drones, aircraft, short-range ballistic",
                  desc: "Multi-layer modular defence system deployed to UAE post-Abraham Accords. Can engage threats from drones to short-range ballistic missiles depending on interceptor variant selected.",
                  specs: "Altitude: Various • Range: 5–150km (modular)",
                  cost: "~$1M per interceptor (est.)",
                },
              ].map((sys, i) => (
                <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderLeft: `3px solid ${sys.color}` }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: sys.color, fontFamily: "Georgia, serif" }}>{sys.name}</div>
                  <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 8 }}>{sys.maker}</div>
                  <div style={{ fontSize: 10, color: UAE_GOLD, fontWeight: 600, marginBottom: 8 }}>Target: {sys.target}</div>
                  <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 8 }}>{sys.desc}</div>
                  <div style={{ fontSize: 10, color: SUBTEXT }}>{sys.specs}</div>
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: SUBTEXT }}>Interceptor cost: </span>
                    <span style={{ fontSize: 12, color: IMPACTED, fontWeight: 700 }}>{sys.cost}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* COST ASYMMETRY */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, borderTop: `3px solid ${IMPACTED}` }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cost Asymmetry</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>The economic disparity between attack and defence — Iran's attritional strategy</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div style={{ textAlign: "center", padding: 16, background: "#0A0F1E", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Drones</div>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>Attack: <span style={{ color: UAE_GOLD, fontWeight: 700 }}>$20K–$50K</span></div>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 8 }}>Defence: <span style={{ color: IMPACTED, fontWeight: 700 }}>$1M–$4M</span></div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: IMPACTED, fontFamily: "Georgia, serif" }}>20:1 — 200:1</div>
                  <div style={{ fontSize: 10, color: SUBTEXT }}>cost disadvantage for defenders</div>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "#0A0F1E", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Ballistic Missiles</div>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>Attack: <span style={{ color: "#4DA6FF", fontWeight: 700 }}>$0.5M–$5M</span></div>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 8 }}>Defence: <span style={{ color: IMPACTED, fontWeight: 700 }}>$4M–$12M</span></div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: IMPACTED, fontFamily: "Georgia, serif" }}>4:1 — 12:1</div>
                  <div style={{ fontSize: 10, color: SUBTEXT }}>cost disadvantage for defenders</div>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "#0A0F1E", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Total Estimated</div>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>Iran spent: <span style={{ color: UAE_GOLD, fontWeight: 700 }}>$220M–$800M</span></div>
                  <div style={{ fontSize: 11, color: TEXT, marginBottom: 8 }}>UAE defence: <span style={{ color: IMPACTED, fontWeight: 700 }}>$1.5B–$5B</span></div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: IMPACTED, fontFamily: "Georgia, serif" }}>~$1B/day</div>
                  <div style={{ fontSize: 10, color: SUBTEXT }}>estimated UAE daily defence cost</div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32, fontSize: 10, color: "#3A4A60" }}>
        Data sourced exclusively from official UAE Ministry of Defence statements (@modgovae) • Feb 28 – Mar 4, 2026
      </div>
    </div>
  );
}
