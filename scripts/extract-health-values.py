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

def extract_ais():
    """Extract ship counts from /tmp/gulf-ships.json (written by count-gulf-ships.py)."""
    try:
        data = json.load(open("/tmp/gulf-ships.json"))
        ships = data.get("ships")
        tankers = data.get("tankers")
        if ships is not None:
            print(f'GULF_AIS_NEW="{ships}"')
        if tankers is not None:
            # Use tankers as old_value (secondary metric, useful context)
            print(f'GULF_AIS_OLD="{tankers}"')
    except Exception as e:
        print(f"# Error: {e}", file=sys.stderr)

def extract_hormuz():
    try:
        data = json.load(open("src/data/hormuz.json"))
        if data:
            latest = data[-1]  # last entry is newest
            ships = latest.get("ships")
            tankers = latest.get("tankers")
            if ships is not None:
                print(f'HORMUZ_CHART_NEW="{ships}"')
            if tankers is not None:
                print(f'HORMUZ_CHART_OLD="{tankers}"')
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
    elif mode == "ais":
        extract_ais()
        extract_hormuz()
    else:
        print("Usage: extract-health-values.py [market|bonds|ais]", file=sys.stderr)
        sys.exit(1)
