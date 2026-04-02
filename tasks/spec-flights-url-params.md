# Spec: Flight Chart URL Params + Attack Tracker Deep Links

## 1. URL Parameter Design

**Param**: `airports` (query string on hash route)  
**Format**: Comma-separated IATA codes, case-insensitive  
**Route**: `/#/flights?airports=DXB,AUH,DWC`

### Behavior
- Present: Show only listed airports as `visible: true`, all others `false`
- Absent: Default behavior (show `FULL_DATA_AIRPORTS`: DXB, AUH, DWC, MCT, DOH)
- Empty (`?airports=`): Treat as absent, use defaults
- Invalid codes: Silently ignore unknown codes
- All invalid: Fall back to defaults

### Examples
```
/#/flights?airports=DXB,AUH,DWC     → UAE airports only
/#/flights?airports=MCT             → Oman only
/#/flights?airports=JED,RUH         → Saudi only
/#/flights?airports=IKA             → Iran only
/#/flights?airports=TLV             → Israel only
/#/flights?airports=DOH             → Qatar only
/#/flights?airports=INVALID,DXB     → DXB only (INVALID ignored)
/#/flights                          → defaults (full-data airports)
```

---

## 2. FlightChart Changes

**File**: `src/components/FlightChart.jsx`

### Parse URL on mount
Add to component before `visible` state initialization:

```js
function parseAirportsParam() {
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const airportsParam = params.get('airports');
  if (!airportsParam?.trim()) return null;
  const requested = airportsParam.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
  const validCodes = new Set(AIRPORTS.map(a => a.key));
  const filtered = requested.filter(code => validCodes.has(code));
  return filtered.length > 0 ? new Set(filtered) : null;
}
```

### Modify `visible` state init
Replace current init:
```js
const [visible, setVisible] = useState(() => {
  const fromUrl = parseAirportsParam();
  if (fromUrl) {
    return Object.fromEntries(AIRPORTS.map(a => [a.key, fromUrl.has(a.key)]));
  }
  return Object.fromEntries(AIRPORTS.map(a => [a.key, FULL_DATA_AIRPORTS.has(a.key)]));
});
```

### No URL sync on toggle
User toggling visibility does NOT update URL (one-way read on mount only).

---

## 3. Attack Tracker Changes

**File**: `src/components/EnergyAttacksMap.jsx`

### Add flights links per country
Below the country filter buttons (line ~236), add a row of flight deep-link buttons for countries that have airport data:

```jsx
{/* Flights deep links */}
<div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
  {COUNTRY_FLIGHTS.map(cf => (
    <a
      key={cf.country}
      href={`#/flights?airports=${cf.airports.join(',')}`}
      style={{
        background: 'rgba(255,255,255,0.06)',
        color: SUBTEXT,
        border: `1px solid ${GLASS_BORDER}`,
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: '0.72rem',
        fontWeight: 600,
        textDecoration: 'none',
        fontFamily: DM_SANS,
      }}
    >
      {cf.flag} {cf.label} Flights
    </a>
  ))}
</div>
```

### Button styling
Match existing country filter buttons (`background: rgba(255,255,255,0.06)`, same border/radius/padding/font).

---

## 4. Country-to-Airport Mapping

Define at top of `EnergyAttacksMap.jsx`:

```js
const COUNTRY_FLIGHTS = [
  { country: 'UAE', flag: '🇦🇪', label: 'UAE', airports: ['DXB', 'AUH', 'DWC'] },
  { country: 'Oman', flag: '🇴🇲', label: 'Oman', airports: ['MCT'] },
  { country: 'Qatar', flag: '🇶🇦', label: 'Qatar', airports: ['DOH'] },
  { country: 'Saudi Arabia', flag: '🇸🇦', label: 'Saudi', airports: ['JED', 'RUH'] },
  { country: 'Iran', flag: '🇮🇷', label: 'Iran', airports: ['IKA'] },
  { country: 'Israel', flag: '🇮🇱', label: 'Israel', airports: ['TLV'] },
];
```

### Note on TLV
TLV has limited data (often 1 data point). The link will work, but FlightChart already shows "(Limited data)" badge and dims airports with insufficient data. No special handling needed.

---

## 5. Edge Cases

| Case | Behavior |
|------|----------|
| Unknown airport code | Silently ignored |
| All codes invalid | Use defaults |
| Mixed valid/invalid | Show valid only |
| Empty string | Use defaults |
| Duplicate codes | Dedupe (Set handles it) |
| Case mismatch (`dxb` vs `DXB`) | Normalize to uppercase |
| Airport with no data loaded yet | Toggle visible but line won't render until data loads |
| Airport with limited data (TLV) | Visible in toggles but shows "(Limited data)" |

---

## 6. Files to Modify

1. **`src/components/FlightChart.jsx`**
   - Add `parseAirportsParam()` helper
   - Update `visible` state initialization

2. **`src/components/EnergyAttacksMap.jsx`**
   - Add `COUNTRY_FLIGHTS` constant
   - Add flights deep-link buttons row below country filters

---

## 7. Testing Checklist

- [ ] `/#/flights` shows defaults (DXB, AUH, DWC, MCT, DOH)
- [ ] `/#/flights?airports=DXB` shows only DXB
- [ ] `/#/flights?airports=JED,RUH,IKA` shows Saudi + Iran
- [ ] `/#/flights?airports=BOGUS` falls back to defaults
- [ ] `/#/flights?airports=dxb` works (case insensitive)
- [ ] User can still toggle airports after URL-based init
- [ ] Attack tracker shows 6 country flight buttons
- [ ] Each button navigates to correct filtered view
- [ ] TLV link works (shows limited data warning)
