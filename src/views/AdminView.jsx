import React, { useState, useEffect, useCallback } from "react";

const PASS = "serayaMachtStatistik";
const REFRESH_INTERVAL = 60000;
const MOBILE_BREAKPOINT = 640;

const colors = {
  bg: "#0A1628",
  card: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.08)",
  text: "#E2E8F0",
  subtext: "#9CA3AF",
  accent: "#F59E0B",
  red: "#EF4444",
  orange: "#F59E0B",
  green: "#10B981",
  gray: "#6B7280",
};

const font = '"DM Sans", system-ui, sans-serif';

function relativeTime(ts) {
  if (!ts) return "never";
  const s = (Date.now() - Date.parse(ts)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + " days ago";
}

function getStatus(src) {
  const now = Date.now();

  if (src.type === "event") {
    return {
      status: "event",
      dot: colors.gray,
      icon: "\u2014",
      label: src.last_updated ? "last event: " + relativeTime(src.last_updated) : "never",
    };
  }

  if (src.override && src.override.until && Date.parse(src.override.until) > now) {
    return {
      status: "override",
      dot: colors.gray,
      icon: "\u26AB",
      label: src.override.note || "override active",
    };
  }

  if (src.last_updated === null || src.last_updated === undefined) {
    return { status: "never", dot: colors.red, icon: "\uD83D\uDD34", label: "never updated" };
  }

  if (src.market_hours_only === true && src.trading_days) {
    const dayUTC = new Date().getUTCDay();
    if (src.trading_days === "mon-fri" && (dayUTC === 0 || dayUTC === 6)) {
      return { status: "closed", dot: colors.green, icon: "\uD83D\uDFE2", label: "(market closed)" };
    }
    if (src.trading_days === "sun-thu" && (dayUTC === 5 || dayUTC === 6)) {
      return { status: "closed", dot: colors.green, icon: "\uD83D\uDFE2", label: "(market closed)" };
    }
  }

  const ageHours = (now - Date.parse(src.last_updated)) / 3600000;
  if (ageHours < src.stale_after_hours) {
    return { status: "ok", dot: colors.green, icon: "\uD83D\uDFE2", label: "ok" };
  }
  if (ageHours < 48) {
    return { status: "warning", dot: colors.orange, icon: "\uD83D\uDFE0", label: "warning" };
  }
  return { status: "critical", dot: colors.red, icon: "\uD83D\uDD34", label: "critical" };
}

const sortOrder = { critical: 0, never: 0, warning: 1, override: 2, event: 3, closed: 4, ok: 4 };

function HistorySlideOver({ source, history, loading, onClose }) {
  if (!source) return null;

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 400, maxWidth: "90vw",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
      zIndex: 1000, overflowY: "auto", padding: 20,
      boxShadow: "-4px 0 20px rgba(0,0,0,0.3)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{source} History</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", color: colors.text, cursor: "pointer", fontSize: 20 }}>&times;</button>
      </div>

      {loading ? <div>Loading...</div> : history.length === 0 ? <div style={{ color: colors.subtext }}>No history available</div> : (
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: colors.subtext, textAlign: "left" }}>
              <th style={{ padding: "8px 4px" }}>Time</th>
              <th style={{ padding: "8px 4px" }}>Old</th>
              <th style={{ padding: "8px 4px" }}>New</th>
              <th style={{ padding: "8px 4px" }}>Method</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${colors.border}` }}>
                <td style={{ padding: "8px 4px" }}>{relativeTime(h.timestamp)}</td>
                <td style={{ padding: "8px 4px" }}>{h.old_value || "-"}</td>
                <td style={{ padding: "8px 4px" }}>{h.new_value || "-"}</td>
                <td style={{ padding: "8px 4px" }}>
                  {h.source_url ? <a href={h.source_url} target="_blank" rel="noopener" style={{ color: colors.accent }}>{h.method}</a> : h.method || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminView({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [health, setHealth] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [selectedSource, setSelectedSource] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") === "1") setAuthed(true);
  }, []);

  const handleLogin = useCallback(() => {
    if (pw === PASS) {
      sessionStorage.setItem("admin_auth", "1");
      setAuthed(true);
      setPwError("");
    } else {
      setPwError("Incorrect password");
    }
  }, [pw]);

  const fetchHealth = useCallback(() => {
    fetch(`${import.meta.env.BASE_URL || '/'}health/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then((data) => {
        setHealth(data);
        setFetchError(false);
        setLastFetch(Date.now());
        setSecondsAgo(0);
      })
      .catch(() => setFetchError(true));
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchHealth();
    const iv = setInterval(fetchHealth, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [authed, fetchHealth]);

  useEffect(() => {
    if (!lastFetch) return;
    const iv = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastFetch) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [lastFetch]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleRowClick = async (sourceId) => {
    setSelectedSource(sourceId);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL || '/'}health/history/${sourceId}.json`);
      if (res.ok) setHistory(await res.json());
      else setHistory([]);
    } catch { setHistory([]); }
    setHistoryLoading(false);
  };

  if (!authed) {
    return (
      <div
        style={{
          background: colors.bg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Password"
            style={{
              padding: "10px 16px",
              fontSize: 16,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: colors.text,
              fontFamily: font,
              outline: "none",
              marginRight: 8,
            }}
          />
          <button
            onClick={handleLogin}
            style={{
              padding: "10px 20px",
              fontSize: 16,
              borderRadius: 6,
              border: "none",
              background: colors.accent,
              color: colors.bg,
              fontFamily: font,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Submit
          </button>
          {pwError && (
            <div style={{ color: colors.red, marginTop: 12, fontSize: 14 }}>{pwError}</div>
          )}
        </div>
      </div>
    );
  }

  const sourcesObj = health ? health.sources || {} : {};
  const sources = Object.values(sourcesObj);
  const enriched = sources.map((s) => ({ ...s, _st: getStatus(s) }));
  enriched.sort((a, b) => {
    const oa = sortOrder[a._st.status] ?? 5;
    const ob = sortOrder[b._st.status] ?? 5;
    if (oa !== ob) return oa - ob;
    return (a.label || "").localeCompare(b.label || "");
  });

  const counts = { critical: 0, warning: 0, ok: 0, override: 0, event: 0 };
  enriched.forEach((s) => {
    const st = s._st.status;
    if (st === "critical" || st === "never") counts.critical++;
    else if (st === "warning") counts.warning++;
    else if (st === "ok" || st === "closed") counts.ok++;
    else if (st === "override") counts.override++;
    else if (st === "event") counts.event++;
  });

  const pad = isMobile ? 16 : 24;

  return (
    <div
      style={{
        background: colors.bg,
        minHeight: "100vh",
        fontFamily: font,
        color: colors.text,
        padding: pad,
        position: "relative",
      }}
    >
      <button
        onClick={onBack}
        style={{
          position: "absolute",
          top: pad,
          left: pad,
          cursor: "pointer",
          border: "none",
          background: "transparent",
          color: colors.subtext,
          fontSize: 14,
          fontFamily: font,
        }}
      >
        &larr; Back
      </button>

      <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 8 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: colors.text }}>
            Data Health
          </h1>
          <div style={{ color: colors.subtext, fontSize: 13, marginTop: 4 }}>
            Refreshed {secondsAgo} seconds ago
          </div>
        </div>

        {fetchError && (
          <div
            style={{
              background: "rgba(245,158,11,0.12)",
              border: `1px solid ${colors.orange}`,
              borderRadius: 8,
              padding: "10px 16px",
              marginBottom: 20,
              fontSize: 14,
              color: colors.orange,
            }}
          >
            ⚠️ Health data unavailable — check workflow logs
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <span>🔴 {counts.critical} critical</span>
          <span>🟠 {counts.warning} warning</span>
          <span>🟢 {counts.ok} ok</span>
          <span>⚫ {counts.override} override</span>
          <span>— {counts.event} event</span>
        </div>

        <div
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {!isMobile && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 120px 1fr",
                padding: "10px 16px",
                fontSize: 12,
                color: colors.subtext,
                borderBottom: `1px solid ${colors.border}`,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <div></div>
              <div>Source</div>
              <div>Category</div>
              <div>Last Updated</div>
            </div>
          )}

          {enriched.map((s, i) => {
            const rel = relativeTime(s.last_updated);
            const abs = s.last_updated
              ? new Date(s.last_updated).toISOString().replace("T", " ").slice(0, 19) + " UTC"
              : "";

            if (isMobile) {
              return (
                <div
                  key={s.key || i}
                  onClick={() => handleRowClick(s.id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: s._st.dot,
                      display: "inline-block",
                      flexShrink: 0,
                      marginTop: 5,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>
                      {s._st.status === "event" || s._st.status === "override"
                        ? s._st.label
                        : s.last_updated
                        ? rel
                        : "never"}
                      {s._st.status === "closed" && " " + s._st.label}
                    </div>
                    {s.last_updated && s._st.status !== "event" && s._st.status !== "override" && (
                      <div style={{ fontSize: 11, color: colors.subtext, marginTop: 1 }}>{abs}</div>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={s.key || i}
                onClick={() => handleRowClick(s.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 120px 1fr",
                  padding: "12px 16px",
                  borderBottom: `1px solid ${colors.border}`,
                  alignItems: "center",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: s._st.dot,
                    display: "inline-block",
                  }}
                />
                <div style={{ fontWeight: 500 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: colors.subtext }}>{s.category || ""}</div>
                <div>
                  {s._st.status === "event" || s._st.status === "override" ? (
                    <span style={{ fontSize: 13, color: colors.subtext }}>{s._st.label}</span>
                  ) : (
                    <>
                      <div>
                        {s.last_updated ? rel : "never"}
                        {s._st.status === "closed" && (
                          <span style={{ color: colors.subtext, fontSize: 12, marginLeft: 6 }}>
                            {s._st.label}
                          </span>
                        )}
                      </div>
                      {s.last_updated && (
                        <div style={{ fontSize: 11, color: colors.subtext, marginTop: 1 }}>
                          {abs}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSource && <div onClick={() => setSelectedSource(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />}
      <HistorySlideOver source={selectedSource} history={history} loading={historyLoading} onClose={() => setSelectedSource(null)} />
    </div>
  );
}
