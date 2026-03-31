# Hormuz Chart Event Labels — Technical Spec

## What to build

Replace the hardcoded `ReferenceLine` at line 421 of `HormuzView.jsx` with dynamically computed event overlays on the ships-over-time `LineChart`. Each event renders as a vertical dashed `ReferenceLine` with a positioned label badge above the chart area.

Events to detect:
- **Status transitions**: first entry where `status` differs from the previous entry (e.g. normal→disrupted, disrupted→critical)
- **Toll transition**: first entry where `tollPassage === true` and the previous entry's `tollPassage` is falsy

## Data contract

Pure function at top of file:

```js
function getStatusEvents(data) {
  const events = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].status !== data[i - 1].status) {
      events.push({ date: data[i].date, type: 'status', value: data[i].status });
    }
    if (data[i].tollPassage && !data[i - 1].tollPassage) {
      events.push({ date: data[i].date, type: 'toll', value: 'toll' });
    }
  }
  // Merge same-day events into one entry
  const merged = Object.values(
    Object.groupBy(events, e => e.date)
  ).map(group => ({ date: group[0].date, events: group }));
  return merged;
}
```

Returns array of `{ date, events[] }`. Each event has `type` ("status" | "toll") and `value`.

## Visual design

| Event value | Colour | Label text |
|---|---|---|
| `disrupted` | `#F59E0B` (amber) | "Disrupted" |
| `critical` | `#EF4444` (red) | "Critical" |
| `normal` | `#27AE60` (green) | "Normal" |
| `toll` | `#8B5CF6` (purple) | "Toll imposed" |

Each `ReferenceLine`:
- `stroke={colour}`, `strokeDasharray="4 4"`
- `x` value = `date.slice(5)` (matches existing `label` field in `chartData`)

Label badge (via Recharts `label` prop with custom content renderer):
- Text in matching colour, fontSize 10, fontWeight 600
- Background: colour at 20% opacity (`${colour}33`), borderRadius 4, padding `2px 6px`
- Positioned above chart (`position="top"`, `offset={12}`)
- Merged events: join labels with " · " (e.g. "Critical · Toll imposed")

## Component breakdown

All changes in `HormuzView.jsx` only:
1. Add `getStatusEvents()` as a pure function near top of file (after imports)
2. Compute `const statusEvents = getStatusEvents(data)` once (module-level, alongside `today`/`closureDays`)
3. Inside `<LineChart>`, replace the single hardcoded `<ReferenceLine>` with `statusEvents.map(...)` rendering one `<ReferenceLine>` per event group
4. Custom label renderer: small inline function or component returning `<g>` with `<rect>` + `<text>`

No new files. No new dependencies.

## Edge cases

- **Same-day overlap** (status change + toll start): merged into single `ReferenceLine` with combined label text
- **Mobile truncation**: use short labels below 640px viewport width — "Disr." / "Crit." / "Toll" — detect via `window.innerWidth` in the label renderer (or a `useMediaQuery`-style check already in scope)
- **Future data**: if status reverts (e.g. critical→disrupted→normal), each transition gets its own line — no hardcoding of direction
- **Empty data**: `getStatusEvents([])` returns `[]` — no lines rendered
