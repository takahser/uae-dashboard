# Spec: Wire --new-value for Market & Bonds History

**Status:** Draft  
**Date:** 2026-03-31

## Problem

`write-health.py` supports `--new-value` to build history, but market and bonds workflows don't pass it. History entries never accumulate for these sources.

## Data Structures

### Market (`public/data-market.json`)
```json
{
  "quotes": {
    "BZ=F": {"price": 107.47, ...},
    "CL=F": {"price": 103.05, ...},
    // Symbol → source_id mapping:
    // BZ=F → brent, CL=F → wti, NG=F → natgas, 2222.SR → aramco
    // FRO → frontline, STNG → stng, RTX → rtx, LMT → lmt
    // DUBAI → dubai, OMAN → oman
  }
}
```

### Bonds (`public/data-bonds.json`)
```json
{
  "series": [
    {"id": "DGS10", "data": [{"date": "...", "value": 4.57}, ...]}
  ]
}
```

The `bonds` health entry is singular. Use US 10Y (DGS10) latest value as the representative new_value.

## Solution: Helper Script

Create `scripts/extract-health-values.py` to avoid inline Python in YAML (which causes parse errors).

### Script: `scripts/extract-health-values.py`

```python
#!/usr/bin/env python3
"""
Extract current values from market/bonds JSON for health history.
Outputs shell variable assignments to stdout.

Usage: eval "$(python scripts/extract-health-values.py market)"
       eval "$(python scripts/extract-health-values.py bonds)"
"""
import json, sys

MARKET_SYMBOL_MAP = {
    "BZ=F": "brent",
    "CL=F": "wti", 
    "NG=F": "natgas",
    "2222.SR": "aramco",
    "FRO": "frontline",
    "STNG": "stng",
    "RTX": "rtx",
    "LMT": "lmt",
    "DUBAI": "dubai",
    "OMAN": "oman",
}

def extract_market():
    try:
        data = json.load(open("public/data-market.json"))
        quotes = data.get("quotes", {})
        for symbol, source_id in MARKET_SYMBOL_MAP.items():
            quote = quotes.get(symbol, {})
            price = quote.get("price")
            prev = quote.get("previousClose")
            if price is not None:
                var = source_id.upper()
                print(f'{var}_NEW="{price}"')
                if prev is not None:
                    print(f'{var}_OLD="{prev}"')
    except Exception as e:
        print(f"# Error: {e}", file=sys.stderr)

def extract_bonds():
    try:
        data = json.load(open("public/data-bonds.json"))
        # Use US 10Y as representative
        for s in data.get("series", []):
            if s.get("id") == "DGS10":
                arr = s.get("data", [])
                if len(arr) >= 1:
                    new_val = arr[-1].get("value")
                    print(f'BONDS_NEW="{new_val}"')
                if len(arr) >= 2:
                    old_val = arr[-2].get("value")
                    print(f'BONDS_OLD="{old_val}"')
                break
    except Exception as e:
        print(f"# Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "market":
        extract_market()
    elif mode == "bonds":
        extract_bonds()
    else:
        print("Usage: extract-health-values.py [market|bonds]", file=sys.stderr)
        sys.exit(1)
```

## Workflow Changes

### update-market.yml

Replace the "Write health timestamps" step:

```yaml
- name: Write health timestamps
  run: |
    eval "$(python scripts/extract-health-values.py market)"
    python scripts/write-health.py brent --method yahoo-finance --source-url "https://finance.yahoo.com/quote/BZ=F" ${BRENT_OLD:+--old-value "$BRENT_OLD"} ${BRENT_NEW:+--new-value "$BRENT_NEW"} || true
    python scripts/write-health.py wti --method yahoo-finance --source-url "https://finance.yahoo.com/quote/CL=F" ${WTI_OLD:+--old-value "$WTI_OLD"} ${WTI_NEW:+--new-value "$WTI_NEW"} || true
    python scripts/write-health.py natgas --method yahoo-finance --source-url "https://finance.yahoo.com/quote/NG=F" ${NATGAS_OLD:+--old-value "$NATGAS_OLD"} ${NATGAS_NEW:+--new-value "$NATGAS_NEW"} || true
    python scripts/write-health.py aramco --method yahoo-finance --source-url "https://finance.yahoo.com/quote/2222.SR" ${ARAMCO_OLD:+--old-value "$ARAMCO_OLD"} ${ARAMCO_NEW:+--new-value "$ARAMCO_NEW"} || true
    python scripts/write-health.py frontline --method yahoo-finance --source-url "https://finance.yahoo.com/quote/FRO" ${FRONTLINE_OLD:+--old-value "$FRONTLINE_OLD"} ${FRONTLINE_NEW:+--new-value "$FRONTLINE_NEW"} || true
    python scripts/write-health.py stng --method yahoo-finance --source-url "https://finance.yahoo.com/quote/STNG" ${STNG_OLD:+--old-value "$STNG_OLD"} ${STNG_NEW:+--new-value "$STNG_NEW"} || true
    python scripts/write-health.py rtx --method yahoo-finance --source-url "https://finance.yahoo.com/quote/RTX" ${RTX_OLD:+--old-value "$RTX_OLD"} ${RTX_NEW:+--new-value "$RTX_NEW"} || true
    python scripts/write-health.py lmt --method yahoo-finance --source-url "https://finance.yahoo.com/quote/LMT" ${LMT_OLD:+--old-value "$LMT_OLD"} ${LMT_NEW:+--new-value "$LMT_NEW"} || true
    python scripts/write-health.py dubai --method oilprice-scrape --source-url "https://oilprice.com/" ${DUBAI_OLD:+--old-value "$DUBAI_OLD"} ${DUBAI_NEW:+--new-value "$DUBAI_NEW"} || true
    python scripts/write-health.py oman --method cbonds-scrape --source-url "https://cbonds.com/indexes/189217/" ${OMAN_OLD:+--old-value "$OMAN_OLD"} ${OMAN_NEW:+--new-value "$OMAN_NEW"} || true
    python scripts/write-health.py gulf_ais --method aisstream --source-url "wss://stream.aisstream.io/v0/stream" || true
    python scripts/write-health.py hormuz_chart --method aisstream --source-url "wss://stream.aisstream.io/v0/stream" || true
```

### update-bonds.yml

Replace the "Write health timestamp" step:

```yaml
- name: Write health timestamp
  run: |
    eval "$(python scripts/extract-health-values.py bonds)"
    python scripts/write-health.py bonds --method treasury-boe-mof --source-url "https://home.treasury.gov/" ${BONDS_OLD:+--old-value "$BONDS_OLD"} ${BONDS_NEW:+--new-value "$BONDS_NEW"}
```

## Edge Cases

| Case | Handling |
|------|----------|
| Source not in JSON | Variable unset → `${VAR:+...}` expands to nothing → no `--new-value` passed → no history entry |
| Price is `null` | Same as above — script skips printing the variable |
| First run (no history file) | `write-health.py` already handles this — creates fresh array |
| `previousClose` missing | `--old-value` omitted; history still logs `new_value` |
| JSON parse error | Script prints error to stderr, no vars set, health still updates timestamp |

## Old vs New Value Semantics

- **old_value**: `previousClose` from Yahoo Finance (or last-known value for scraped sources)
- **new_value**: Current `price` from the JSON

This matches what `write-health.py` stores: each history entry captures the value at that point in time.

## Testing

1. Run `python scripts/extract-health-values.py market` — should output var assignments
2. Run workflow manually via `workflow_dispatch`
3. Check `public/health/history/brent.json` exists with entries

## Files to Create/Modify

| File | Action |
|------|--------|
| `scripts/extract-health-values.py` | **Create** |
| `.github/workflows/update-market.yml` | Modify "Write health timestamps" step |
| `.github/workflows/update-bonds.yml` | Modify "Write health timestamp" step |
