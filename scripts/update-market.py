#!/usr/bin/env python3
"""Fetch market data, Dubai/Oman crude prices, and persist to public/data-market.json."""
import requests, json, time, os, re, urllib.request
from datetime import datetime, timezone, timedelta

SYMBOLS = ["BZ=F", "CL=F", "NG=F", "2222.SR", "FRO", "STNG", "RTX", "LMT"]
NAMES = {
    "BZ=F": "Brent Crude (EU)",
    "CL=F": "WTI Crude (US)",
    "NG=F": "Natural Gas",
    "2222.SR": "Saudi Aramco",
    "FRO": "Frontline",
    "STNG": "Scorpio Tankers",
    "RTX": "RTX Corp",
    "LMT": "Lockheed Martin",
}

quotes = {}
history = {}

for sym in SYMBOLS:
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=1d&interval=1d"
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        r.raise_for_status()
        chart = r.json()["chart"]["result"][0]
        meta = chart["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("chartPreviousClose", meta.get("previousClose", 0))
        change = round(price - prev, 2)
        change_pct = round((change / prev) * 100, 2) if prev else 0
        quotes[sym] = {
            "symbol": sym,
            "name": NAMES.get(sym, sym),
            "price": round(price, 2),
            "change": change,
            "changePercent": change_pct,
            "previousClose": round(prev, 2),
        }
        # 30-day history
        hurl = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=30d&interval=1d"
        hr = requests.get(hurl, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        hr.raise_for_status()
        hchart = hr.json()["chart"]["result"][0]
        timestamps = hchart.get("timestamp", [])
        closes = hchart["indicators"]["quote"][0].get("close", [])
        hist = []
        for ts, c in zip(timestamps, closes):
            if c is not None:
                dt = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
                hist.append({"date": dt, "close": round(c, 2)})
        history[sym] = hist
        time.sleep(0.5)
    except Exception as e:
        print(f"Warning: failed to fetch {sym}: {e}")

# Load existing data to preserve history
existing_data = {}
market_path = "public/data-market.json"
if os.path.exists(market_path):
    try:
        with open(market_path) as f:
            existing_data = json.load(f)
    except Exception:
        pass

# --- Dubai Crude: oilprice.com (1-day delay) ---
dubai_existing_quote = existing_data.get("quotes", {}).get("DUBAI", {})
dubai_history = existing_data.get("history", {}).get("DUBAI", [])
try:
    req2 = urllib.request.Request(
        "https://oilprice.com/oil-price-charts/",
        headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
                 "Referer": "https://oilprice.com/"}
    )
    with urllib.request.urlopen(req2, timeout=15) as r2:
        html2 = r2.read().decode("utf-8", errors="ignore")
    dubai_idx = html2.find("data-name='Dubai'")
    if dubai_idx < 0:
        raise ValueError("Dubai not found in oilprice.com page")
    dsnippet = html2[dubai_idx:dubai_idx+600]
    dprices = re.findall(r"data-price='([^']+)'", dsnippet)
    if not dprices:
        raise ValueError("No Dubai price found")
    dprice = round(float(dprices[0]), 2)
    dprev = dubai_existing_quote.get("price", dprice)
    dchange = round(dprice - dprev, 2)
    dchange_pct = round((dchange / dprev) * 100, 2) if dprev else 0
    quotes["DUBAI"] = {
        "symbol": "DUBAI",
        "name": "Dubai Crude",
        "price": dprice,
        "change": dchange,
        "changePercent": dchange_pct,
        "previousClose": round(dprev, 2),
        "note": "Dubai crude — oilprice.com (1-day delay)",
        "source": "oilprice.com",
    }
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    dubai_dates = {e["date"] for e in dubai_history}
    if yesterday not in dubai_dates:
        dubai_history.append({"date": yesterday, "close": dprice})
        dubai_history.sort(key=lambda x: x["date"])
    history["DUBAI"] = dubai_history
    print(f"Dubai: ${dprice} (oilprice.com, as of {yesterday})")
except Exception as e:
    print(f"Dubai scrape failed ({e}), preserving last known price")
    if dubai_existing_quote:
        quotes["DUBAI"] = dubai_existing_quote
    if dubai_history:
        history["DUBAI"] = dubai_history

# --- Oman Crude: cbonds.com (today's price, no delay) ---
oman_existing_quote = existing_data.get("quotes", {}).get("OMAN", {})
oman_history = existing_data.get("history", {}).get("OMAN", [])
try:
    req = urllib.request.Request(
        "https://cbonds.com/indexes/189217/",
        headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"}
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        html = r.read().decode("utf-8", errors="ignore")
    actual = re.search(r'"actual_value"\s*:\s*"([\d.]+)"', html)
    actual_date = re.search(r'"actual_date"\s*:\s*"([\d\\/]+)"', html)
    if not actual:
        raise ValueError("actual_value not found in cbonds page")
    price = round(float(actual.group(1)), 2)
    raw_date = actual_date.group(1).replace("\\", "") if actual_date else None
    if raw_date:
        dp = raw_date.split("/")
        iso_date = f"{dp[2]}-{dp[1]}-{dp[0]}" if len(dp) == 3 else datetime.now(timezone.utc).strftime("%Y-%m-%d")
    else:
        iso_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    prev = oman_existing_quote.get("price", price)
    change = round(price - prev, 2)
    change_pct = round((change / prev) * 100, 2) if prev else 0
    quotes["OMAN"] = {
        "symbol": "OMAN",
        "name": "Oman Crude",
        "price": price,
        "change": change,
        "changePercent": change_pct,
        "previousClose": round(prev, 2),
        "note": f"DME Oman — cbonds.com ({iso_date})",
        "source": "cbonds.com/indexes/189217",
    }
    oman_dates = {e["date"] for e in oman_history}
    if iso_date not in oman_dates:
        oman_history.append({"date": iso_date, "close": price})
        oman_history.sort(key=lambda x: x["date"])
    history["OMAN"] = oman_history
    print(f"Oman: ${price} on {iso_date} (cbonds.com)")
except Exception as e:
    print(f"Oman scrape failed ({e}), preserving last known price")
    if oman_existing_quote:
        quotes["OMAN"] = oman_existing_quote
    if oman_history:
        history["OMAN"] = oman_history

# --- Gulf AIS ships ---
gulf_ships = {"ships": None, "tankers": None}
try:
    with open("/tmp/gulf-ships.json") as f:
        gulf_ships = json.load(f)
except Exception:
    pass

output = {
    "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "quotes": quotes,
    "history": history,
    "gulf": {
        "ships": gulf_ships.get("ships"),
        "tankers": gulf_ships.get("tankers"),
        "sampled_at": gulf_ships.get("sampled_at"),
    },
}

with open(market_path, "w") as f:
    json.dump(output, f, indent=2)

print(f"Updated {len(quotes)} quotes, {len(history)} histories")

import subprocess as _sp

HEALTH_MAP = {
    "BZ=F": "brent", "CL=F": "wti", "NG=F": "natgas", "2222.SR": "aramco",
    "FRO": "frontline", "STNG": "stng", "RTX": "rtx", "LMT": "lmt",
    "DUBAI": "dubai", "OMAN": "oman"
}
for sym, health_id in HEALTH_MAP.items():
    if sym in quotes:
        _sp.run(["python", "scripts/write-health.py", health_id], check=False)
if gulf_ships.get("ships") is not None:
    _sp.run(["python", "scripts/write-health.py", "gulf_ais"], check=False)
