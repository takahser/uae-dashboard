# Spec: Attack Alarm Frequency Charts

**Feature:** Visualize daily attack alarm frequency per country over time  
**Dashboard:** ww3live.xyz  
**Date:** 2026-04-02  
**Status:** Draft

---

## 1. Overview

Add a new chart section to the dashboard showing how frequently each country experienced attack alarms over the conflict timeline. Each day that has data shows the total number of projectiles engaged/intercepted, giving users a visual sense of attack intensity and frequency.

---

## 2. Chart Type

**Recommended: Stacked Bar Chart (primary) + optional Line overlay for total**

- **Stacked bars** per day: one color for ballistic, one for drones, one for cruise missiles
- Each bar = one day's attack event, stacked by weapon type
- This is better than a line chart because:
  - Many days have no entry (gaps are natural with bars; lines suggest continuity)
  - Bar height directly maps to "how many projectiles that day" — intuitive
  - Stacking shows weapon mix at a glance
- Use the same Recharts `<BarChart>` / `<Bar>` components already used in FlightChart.jsx

**Alternative view toggle:** Combined line chart (all countries on one chart) for cross-country comparison.

---

## 3. Data Model

### Source files
- `public/data-{country}.json` → `daily[]` array
- Countries to include: `uae`, `kuwait`, `qatar`, `saudi`, `bahrain`, `oman`
- Skip: `israel`, `iran` (0 structured daily entries)

### Fields to extract per daily entry

The data has two reporting eras:
1. **"intercepted" era** (pre-Mar 13): has `ballisticDetected`, `ballisticIntercepted`, `dronesDetected`, `dronesIntercepted`, `cruiseDetected`, `cruiseIntercepted`
2. **"engaged" era** (post-Mar 13): has `ballisticEngaged`, `dronesEngaged`, `cruiseEngaged`

**Normalization logic:**
```js
function normalizeEntry(entry) {
  return {
    date: entry.date,
    ballistic: entry.ballisticEngaged ?? entry.ballisticIntercepted ?? entry.ballisticDetected ?? 0,
    drones: entry.dronesEngaged ?? entry.dronesIntercepted ?? entry.dronesDetected ?? 0,
    cruise: entry.cruiseEngaged ?? entry.cruiseIntercepted ?? entry.cruiseDetected ?? 0,
    total: entry.total ?? (ballistic + drones + cruise),
    source: entry.source ?? null,
  };
}
```

### Days with no entry
- **Do NOT fill gaps with 0.** Missing days = no data was reported.
- Bar chart naturally handles this: no bar rendered for that date.
- X-axis should still show a continuous date scale so gaps are visually apparent.

### Country field availability

| Country | Entries | Has ballistic | Has drones | Has cruise | Has `total` |
|---------|---------|---------------|------------|------------|-------------|
| UAE     | 34      | ✅            | ✅         | ✅         | ✅          |
| Kuwait  | 28      | via engaged   | ✅         | via engaged| partial     |
| Qatar   | 23      | ✅            | ✅         | ✅         | ✅          |
| Saudi   | 14      | ✅            | ✅         | ❌         | via sum     |
| Bahrain | 13      | ✅            | ✅         | ❌         | ✅          |
| Oman    | 14      | ✅            | ✅         | ✅         | ✅          |

---

## 4. Per-Country vs Combined View

**Both.** Use a toggle (like FlightChart's `viewMode`):

### View A: Per-country stacked bars (default)
- One chart per country with data
- Stacked bars: ballistic (red/orange), drones (blue), cruise (purple)
- Country name + flag as chart header
- Sorted by entry count descending (UAE first, Bahrain last)

### View B: Combined line chart
- All 6 countries as separate colored lines on one chart
- Y-axis = total projectiles that day
- Each country = one line, colored per country color scheme
- Good for comparing attack intensity across countries

Toggle button: `Per Country` | `Combined` (same pattern as FlightChart)

---

## 5. Placement in UI

**New section below the existing flight chart section, above the map.**

- Section title: "⚠️ Attack Alarm Frequency" (or "Daily Attack Events")
- Same glassmorphism card style (`GLASS_BG`, `GLASS_BORDER`, `GLASS_BLUR`, `GLASS_RADIUS`)
- Collapsible section (consistent with other panels)
- Anchor: `#attacks` for direct linking

---

## 6. Country Color Scheme

Reuse `COUNTRY_CONFIG` colors from App.jsx:

| Country | Primary Color | Hex       |
|---------|--------------|-----------|
| UAE     | Green        | `#00732F` |
| Qatar   | Maroon       | `#8A1538` |
| Kuwait  | Green        | `#007A3D` |
| Bahrain | Red          | `#CE1126` |
| Oman    | Red          | `#DB161B` |
| Saudi   | Green        | `#006C35` |

For stacked bar weapon types (per-country view):
| Weapon    | Color     | Hex       |
|-----------|-----------|-----------|
| Ballistic | Red       | `#EF4444` |
| Drones    | Blue      | `#3B82F6` |
| Cruise    | Purple    | `#8B5CF6` |

---

## 7. Tooltip

On hover, show a glassmorphism tooltip (reuse `CustomTooltip` pattern from FlightChart):

```
📅 1 Apr 2026
━━━━━━━━━━━━━━━━
🚀 Ballistic: 5
🛩️ Drones: 35
🎯 Total: 40
━━━━━━━━━━━━━━━━
Source: @modgovae ↗
```

- Date formatted as `D MMM YYYY`
- Ballistic, drones, cruise counts (omit cruise if 0)
- Total
- Source link (if `source` URL exists) — clickable, opens in new tab

---

## 8. No-Data Handling

- Countries with 0 daily entries (`israel`, `iran`): **skip entirely**. No chart, no placeholder, no "no data available" message.
- Filter at load time: `COUNTRY_CONFIG.filter(c => dailyData[c.code]?.length > 0)`
- If a country later gets data, it automatically appears.

---

## 9. Component Structure

### New file: `src/components/AttackChart.jsx`

```
AttackChart.jsx
├── Exports: default function AttackChart()
├── Fetches: data-{country}.json for each country in COUNTRY_CONFIG
├── State: viewMode ('per-country' | 'combined'), timeframe ('1W' | '2W' | '1M' | 'ALL')
├── Renders:
│   ├── Section header with toggle buttons
│   ├── Timeframe selector (reuse TIMEFRAMES pattern)
│   ├── Per-country view: map over countries → BarChart per country
│   └── Combined view: single LineChart with all countries
└── Styling: inline styles matching existing glassmorphism tokens
```

### Integration in App.jsx
```jsx
import AttackChart from './components/AttackChart';

// In render, after FlightChart section:
<AttackChart />
```

### Props: None (self-contained, fetches own data)

---

## 10. Timeframe Filter

Same pattern as FlightChart:
- `1W` / `2W` / `1M` / `ALL`
- Default: `ALL` (show full timeline)
- Filter `daily[]` entries by date range

---

## 11. Responsive Design

- Charts: `<ResponsiveContainer width="100%" height={200}>` per country (per-country view)
- Combined view: `height={300}`
- On mobile (< 768px): stack vertically, reduce chart height to 150px
- Bar width auto-adjusts based on data density

---

## 12. Implementation Checklist

- [ ] Create `src/components/AttackChart.jsx`
- [ ] Add normalization util for intercepted → engaged field mapping
- [ ] Implement per-country stacked bar view
- [ ] Implement combined line view with toggle
- [ ] Add timeframe filter (1W / 2W / 1M / ALL)
- [ ] Glassmorphism tooltip with source link
- [ ] Skip countries with 0 entries
- [ ] Import and render in App.jsx below FlightChart
- [ ] Test with all 6 country data files
- [ ] Verify no data is fabricated — gaps remain gaps
- [ ] Deploy to ww3live.xyz

---

## ⚠️ Critical: UAE Reporting Type Change (Mar 13 2026)

UAE switched from **"intercepted"** (pre-Mar 13) to **"engaged"** (post-Mar 13) terminology.
- Pre-Mar 13: `ballisticIntercepted`, `dronesIntercepted` — tracks confirmed kills
- Post-Mar 13: `ballisticEngaged`, `dronesEngaged` — tracks engagement attempts (interception rate no longer trackable)

**UI requirement**: The attack alarm chart MUST display a vertical reference line at `2026-03-13` with a tooltip/label explaining this change. Example label: "Reporting changed: intercepted → engaged (interception rate no longer tracked)".

This annotation must NOT be removed in any future refactor — it is important context for users interpreting the data.

**Implementation**: Use a `ReferenceLine` component (recharts) with `x="2026-03-13"`, colored amber/yellow, with a label.
