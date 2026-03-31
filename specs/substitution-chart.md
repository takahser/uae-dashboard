# Substitution Chart Spec

## What to build

Stacked bar chart showing oil flow through Yanbu + Fujairah bypass routes over time, with a reference line at pre-war Hormuz capacity to visualize the substitution gap.

- **X axis**: dates (from history entries, union of both routes)
- **Y axis**: mbpd (million barrels per day), domain `[0, 25]`
- **Stacked bars**: Yanbu (`#3B82F6` blue) + Fujairah (`#14B8A6` teal)
- **Reference line**: `hormuz.pre_war_mbpd` (21 mbpd), red dashed (`#EF4444`), labeled "Pre-War Hormuz (21 mb/d)"
- **Time range buttons**: `1W / 2W / 4W / ALL` — same pattern as Price History chart (HormuzView.jsx:490-498)

## Data source & preparation

Fetch `public/data-substitution.json` via `fetch(base + 'data-substitution.json')` on mount (same pattern as `bondsData` at HormuzView.jsx:355).

Build unified date array:
1. Collect all unique dates from `routes.yanbu.history[]` and `routes.fujairah.history[]`
2. Sort chronologically
3. For each date, look up mbpd/vessel_count from each route (may be `null` or absent)
4. Chart data shape: `{ date, yanbu_mbpd, fujairah_mbpd, yanbu_vessels, fujairah_vessels, yanbu_vessel_only, fujairah_vessel_only }`

A `*_vessel_only` flag is `true` when `mbpd === null && vessel_count !== null`. These entries render at the last-known mbpd value (or 0) with 0.5 opacity to indicate "vessel data only, no volume estimate".

**Current state**: Fujairah `history[]` is empty; Yanbu has ~18 entries (6 with mbpd, 12 vessel-only). Chart must handle one or both routes being empty gracefully.

## Component

**New file**: `src/components/SubstitutionChart.jsx`

**Integration**: Insert in `HormuzView.jsx` after the Bond chart section (~line 557) and before "Chokepoint Facts" (~line 559). Conditional render like bonds: `{subData && <SubstitutionChart data={subData} />}`.

Props: `{ data }` — the full parsed JSON object.

## Visual design

```
Container: bg CARD_BG, border 1px solid GLASS_BORDER, borderRadius GLASS_RADIUS, padding 20
Title:     "OIL FLOW SUBSTITUTION — YANBU + FUJAIRAH" (11px, weight 600, letterSpacing 0.1em, TEXT)
Subtitle:  "Current: {total} mb/d | Pre-war Hormuz: 21 mb/d | Gap: {gap} mb/d" (SUBTEXT, 0.8rem)
Chart:     Recharts <BarChart> inside <ResponsiveContainer width="100%" height={300}>
```

Use existing design tokens: `CARD_BG`, `GLASS_BORDER`, `GLASS_RADIUS`, `TEXT`, `SUBTEXT`, `DM_SANS`. Import or accept as props — prefer importing from a shared constants location or duplicating the 6 constants at top of file (they're simple literals).

Mobile: `ResponsiveContainer` handles width. Time range buttons wrap via `flexWrap: wrap`.

## Tooltip

Custom Recharts tooltip showing:
- **Date** (bold)
- Yanbu: `{mbpd} mb/d` or `n/a (${vessel_count} vessels tracked)`
- Fujairah: same format
- **Total**: `{yanbu + fujairah} mb/d`
- **Gap**: `{21 - total} mb/d below pre-war`

## Edge cases

| Case | Behavior |
|------|----------|
| `mbpd: null, vessel_count: N` | Bar at 0.5 opacity, tooltip shows "n/a (N vessels)" |
| Route has no history | That stack segment is simply absent (0) |
| Both routes missing for a date | Skip date from chart (shouldn't happen with union) |
| `vessel_count: 0` | Still vessel-only styling, tooltip: "n/a (0 vessels)" |
| Single data point | Render single bar, no range filter active |

## Not in scope

- Backend changes
- Data fetching/scraping logic
- Yanbu pipeline map visualization (already exists on HormuzMap)
