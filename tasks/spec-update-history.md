# Update History Feature Spec

## Overview
Add clickable source rows in AdminView that open a slide-over panel showing update history with change details.

---

## 1. History File Format

**Path:** `public/health/history/{source_id}.json`

```json
[
  {
    "timestamp": "2026-03-30T08:41:50Z",
    "old_value": "82.45",
    "new_value": "82.67",
    "method": "yahoo-finance",
    "source_url": "https://finance.yahoo.com/quote/BZ=F"
  }
]
```

- Array, newest first, max 90 entries (trim oldest on append)
- Created on first write if missing
- `old_value`/`new_value`: stringified, source-specific (price, count, event ID)

---

## 2. write-health.py Changes

### New CLI args
```
--old-value   Previous value (optional, e.g. "82.45")
--new-value   Current value (optional, e.g. "82.67")
--method      Update method (optional, e.g. "yahoo-finance")
--source-url  Data source URL (optional)
```

### Logic additions
```python
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("source_ids", nargs="+")
parser.add_argument("--old-value")
parser.add_argument("--new-value")
parser.add_argument("--method")
parser.add_argument("--source-url")
args = parser.parse_args()

# After writing {source_id}.json, append to history:
HISTORY_DIR = "public/health/history"
os.makedirs(HISTORY_DIR, exist_ok=True)

if args.new_value:  # only log if there's actual data
    hist_path = os.path.join(HISTORY_DIR, f"{source_id}.json")
    history = []
    if os.path.exists(hist_path):
        with open(hist_path) as f:
            history = json.load(f)

    entry = {"timestamp": now}
    if args.old_value: entry["old_value"] = args.old_value
    if args.new_value: entry["new_value"] = args.new_value
    if args.method: entry["method"] = args.method
    if args.source_url: entry["source_url"] = args.source_url

    history.insert(0, entry)
    history = history[:90]  # keep newest 90

    with open(hist_path, "w") as f:
        json.dump(history, f, indent=2)
```

---

## 3. Workflow Updates

### update-market.yml (market sources)
```yaml
- name: Write health timestamps
  run: |
    # Scripts output: OLD_VAL|NEW_VAL (pipe-delimited) to stdout
    BRENT=$(python scripts/update-market.py --output-prices brent)
    python scripts/write-health.py brent \
      --old-value "${BRENT%|*}" \
      --new-value "${BRENT#*|}" \
      --method "yahoo-finance" \
      --source-url "https://finance.yahoo.com/quote/BZ=F"
    # ... repeat for wti, natgas, aramco, frontline, stng, rtx, lmt
```

| Source | method | source_url |
|--------|--------|------------|
| brent | `yahoo-finance` | `https://finance.yahoo.com/quote/BZ=F` |
| wti | `yahoo-finance` | `https://finance.yahoo.com/quote/CL=F` |
| dubai/oman | `oilprice-api` | `https://oilprice.com/` |
| natgas | `yahoo-finance` | `https://finance.yahoo.com/quote/NG=F` |
| aramco/frontline/stng/rtx/lmt | `yahoo-finance` | `https://finance.yahoo.com/quote/{TICKER}` |
| gulf_ais | `aisstream` | `wss://stream.aisstream.io/` |
| hormuz_chart | `aisstream` | `wss://stream.aisstream.io/` |

### update-bonds.yml
| Source | method | source_url |
|--------|--------|------------|
| bonds | `treasury-api` | `https://home.treasury.gov/` |

### update-data.yml (flights + attacks)
| Source | method | source_url |
|--------|--------|------------|
| flight_* | `flightradar24` | `https://www.flightradar24.com/` |
| *_attacks | `twitter-playwright` | `https://x.com/{account}` |
| iran_data | `twitter-playwright` | `https://x.com/{account}` |

Values for flights: arrival count. Values for attacks: event count or latest event ID.

---

## 4. AdminView.jsx Changes

### State additions
```jsx
const [selectedSource, setSelectedSource] = useState(null);
const [history, setHistory] = useState([]);
const [historyLoading, setHistoryLoading] = useState(false);
```

### Click handler
```jsx
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
```

Add `onClick={() => handleRowClick(s.id)}` and `cursor: "pointer"` to row divs.

### SlideOver component
```jsx
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
```

### Backdrop + render
```jsx
{selectedSource && <div onClick={() => setSelectedSource(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999 }} />}
<HistorySlideOver source={selectedSource} history={history} loading={historyLoading} onClose={() => setSelectedSource(null)} />
```

---

## 5. Files to Create/Modify

| File | Action |
|------|--------|
| `public/health/history/` | Create directory |
| `scripts/write-health.py` | Add args + history append |
| `scripts/update-market.py` | Output old/new prices |
| `.github/workflows/update-market.yml` | Pass history args |
| `.github/workflows/update-bonds.yml` | Pass history args |
| `.github/workflows/update-data.yml` | Pass history args |
| `src/views/AdminView.jsx` | Click handler + SlideOver |

---

## 6. Testing Checklist

- [ ] `write-health.py brent --new-value 82.67 --method yahoo-finance` creates history file
- [ ] History capped at 90 entries
- [ ] AdminView row click opens slide-over
- [ ] History table renders with relative times
- [ ] Source URLs open in new tab
- [ ] Empty history shows "No history available"
- [ ] ESC or backdrop click closes panel
