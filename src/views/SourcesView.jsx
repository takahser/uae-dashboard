import { useState, useEffect } from "react";

const BG = "#050B1A";
const TEXT = "#E8EDF5";
const SUBTEXT = "rgba(255,255,255,0.5)";
const AMBER = "#F59E0B";
const GLASS_BG = "rgba(255,255,255,0.03)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.07)";
const GLASS_BLUR = "blur(40px)";
const GLASS_RADIUS = 16;
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const TYPE_COLORS = {
  "Official Government": "#22C55E",
  "Conflict Monitor": "#3B82F6",
  "Verified News": "#F59E0B",
  "Official State Media": "#14B8A6",
  "Verified Journalist": "#F59E0B",
};

const COUNTRY_FLAGS = {
  uae: "\u{1F1E6}\u{1F1EA}",
  kuwait: "\u{1F1F0}\u{1F1FC}",
  qatar: "\u{1F1F6}\u{1F1E6}",
  bahrain: "\u{1F1E7}\u{1F1ED}",
  oman: "\u{1F1F4}\u{1F1F2}",
  saudi: "\u{1F1F8}\u{1F1E6}",
  israel: "\u{1F1EE}\u{1F1F1}",
  iran: "\u{1F1EE}\u{1F1F7}",
};

const COUNTRY_NAMES = {
  uae: "United Arab Emirates",
  kuwait: "Kuwait",
  qatar: "Qatar",
  bahrain: "Bahrain",
  oman: "Oman",
  saudi: "Saudi Arabia",
  israel: "Israel",
  iran: "Iran",
};

function Badge({ type }) {
  const color = TYPE_COLORS[type] || "#888";
  return (
    <span style={{
      display: "inline-block",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 9999,
      background: color + "22",
      color,
      border: `1px solid ${color}44`,
      whiteSpace: "nowrap",
    }}>
      {type}
    </span>
  );
}

function PolicyCard({ icon, title, text }) {
  return (
    <div style={{
      background: GLASS_BG,
      backdropFilter: GLASS_BLUR,
      border: GLASS_BORDER,
      borderRadius: GLASS_RADIUS,
      padding: 20,
      flex: "1 1 220px",
      minWidth: 220,
    }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: SUBTEXT, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function SourceCard({ code, data }) {
  const flag = COUNTRY_FLAGS[code] || "";
  const name = COUNTRY_NAMES[code] || code;
  return (
    <div style={{
      background: GLASS_BG,
      backdropFilter: GLASS_BLUR,
      border: GLASS_BORDER,
      borderRadius: GLASS_RADIUS,
      padding: 24,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{flag}</span>
        <span>{name}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.primarySources.map((src, i) => (
          <div key={i} style={{
            display: "flex", flexDirection: "column", gap: 4,
            padding: 12, borderRadius: 10,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{src.name}</span>
              {src.handle && <span style={{ fontSize: 11, color: AMBER }}>{src.handle}</span>}
              <Badge type={src.type} />
            </div>
            {src.coverage && (
              <div style={{ fontSize: 11, color: SUBTEXT, lineHeight: 1.4 }}>{src.coverage}</div>
            )}
            {src.url && (
              <a href={src.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: AMBER, opacity: 0.7, textDecoration: "none", wordBreak: "break-all" }}>
                {src.url.length > 80 ? src.url.slice(0, 80) + "..." : src.url}
              </a>
            )}
          </div>
        ))}
      </div>
      {data.note && (
        <div style={{
          marginTop: 14, padding: 12, borderRadius: 10,
          background: AMBER + "0A",
          border: `1px solid ${AMBER}22`,
          fontSize: 11, color: AMBER, lineHeight: 1.5,
        }}>
          <strong>Note:</strong> {data.note}
        </div>
      )}
    </div>
  );
}

export default function SourcesView({ onBack }) {
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/data-sources.json")
      .then(r => r.json())
      .then(d => { setSources(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: DM_SANS, padding: "0 16px 60px" }}>
      {/* Background orbs */}
      <div style={{ position: "fixed", top: -200, right: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #F59E0B11 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -200, left: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #3B82F611 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {/* Back button */}
        <button onClick={onBack} style={{
          background: "none", border: "none", color: SUBTEXT, fontFamily: DM_SANS,
          fontSize: 13, cursor: "pointer", padding: "24px 0 16px", display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 16 }}>&larr;</span> Back to Dashboard
        </button>

        {/* Header */}
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Data Sources & Methodology</h1>
        <p style={{ fontSize: 13, color: SUBTEXT, marginBottom: 32 }}>
          Full citation trail for every data point on ww3live.xyz
        </p>

        {loading && <div style={{ textAlign: "center", padding: 60, color: SUBTEXT }}>Loading sources...</div>}

        {sources && (
          <>
            {/* Methodology callout */}
            <div style={{
              background: AMBER + "0A",
              border: `1px solid ${AMBER}33`,
              borderRadius: GLASS_RADIUS,
              padding: 20,
              marginBottom: 28,
              fontSize: 13,
              color: AMBER,
              lineHeight: 1.6,
            }}>
              {sources.methodology}
            </div>

            {/* Data Policy cards */}
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: TEXT }}>Data Policy</h2>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 36 }}>
              <PolicyCard icon="⊘" title="No Estimates" text={sources.dataPolicy.noEstimates} />
              <PolicyCard icon="✓" title="Verification Threshold" text={sources.dataPolicy.verificationThreshold} />
              <PolicyCard icon="↻" title="Update Frequency" text={sources.dataPolicy.updateFrequency} />
              <PolicyCard icon="➡" title="Open Source" text={sources.dataPolicy.openSource} />
            </div>

            {/* Per-country sources */}
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: TEXT }}>Country Sources</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
              {Object.entries(sources.countries).map(([code, data]) => (
                <SourceCard key={code} code={code} data={data} />
              ))}
            </div>

            {/* Global sources */}
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, color: TEXT }}>Global Cross-Reference Sources</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
              {sources.globalSources.map((src, i) => (
                <div key={i} style={{
                  background: GLASS_BG,
                  backdropFilter: GLASS_BLUR,
                  border: GLASS_BORDER,
                  borderRadius: GLASS_RADIUS,
                  padding: 20,
                  display: "flex", flexDirection: "column", gap: 4,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{src.name}</div>
                  <div style={{ fontSize: 12, color: SUBTEXT, lineHeight: 1.5 }}>{src.description}</div>
                  {src.url && (
                    <a href={src.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, color: AMBER, opacity: 0.7, textDecoration: "none" }}>
                      {src.url}
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              textAlign: "center", fontSize: 11, color: SUBTEXT, paddingTop: 20,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              Last updated: {sources.lastUpdated}
              <br />
              <a href="https://github.com/takahser/uae-dashboard" target="_blank" rel="noopener noreferrer"
                style={{ color: AMBER, opacity: 0.5, textDecoration: "none", fontSize: 11 }}>
                github.com/takahser/uae-dashboard
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
