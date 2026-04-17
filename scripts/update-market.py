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

YF_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def yf_fetch_price_data(ticker, period="1mo", interval="1h"):
    """Fetch price history from Yahoo Finance with query2 fallback."""
    params = {"range": period, "interval": interval}
    for base in ["https://query1.finance.yahoo.com/v8/finance/chart", "https://query2.finance.yahoo.com/v8/finance/chart"]:
        try:
            url = f"{base}/{ticker}"
            r = requests.get(url, headers=YF_HEADERS, params=params, timeout=15)
            r.raise_for_status()
            data = r.json()
            result = data["chart"]["result"][0]
            timestamps = result.get("timestamp", [])
            closes = result["indicators"]["quote"][0].get("close", [])
            prices = []
            for ts, close in zip(timestamps, closes):
                if close is not None:
                    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                    fmt = "%Y-%m-%dT%H:%M" if interval != "1d" else "%Y-%m-%d"
                    prices.append({"date": dt.strftime(fmt), "close": round(close, 2)})
            return prices
        except Exception:
            continue
    raise RuntimeError(f"Yahoo Finance fetch failed for {ticker}")


def yf_fetch_quote(ticker):
    """Fetch latest quote from Yahoo Finance with query2 fallback."""
    params = {"range": "1d", "interval": "1d"}
    for base in ["https://query1.finance.yahoo.com/v8/finance/chart", "https://query2.finance.yahoo.com/v8/finance/chart"]:
        try:
            url = f"{base}/{ticker}"
            r = requests.get(url, headers=YF_HEADERS, params=params, timeout=15)
            r.raise_for_status()
            chart = r.json()["chart"]["result"][0]
            meta = chart["meta"]
            price = meta.get("regularMarketPrice", 0)
            prev = meta.get("chartPreviousClose", meta.get("previousClose", 0))
            return price, prev
        except Exception:
            continue
    raise RuntimeError(f"Yahoo Finance quote failed for {ticker}")


# Load existing data to preserve history
market_path = "public/data-market.json"
existing_data = {}
if os.path.exists(market_path):
    try:
        with open(market_path) as f:
            existing_data = json.load(f)
    except Exception:
        pass

quotes = {}
history = {}

for sym in SYMBOLS:
    try:
        # Latest quote
        price, prev = yf_fetch_quote(sym)
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

        # History: 1h for WTI/Brent, 1d for everything else
        if sym in ("CL=F", "BZ=F"):
            hist = yf_fetch_price_data(sym, period="1mo", interval="1h")
        else:
            hist = yf_fetch_price_data(sym, period="30d", interval="1d")
        # Merge with existing history to preserve backfill
        existing_hist = existing_data.get("history", {}).get(sym, [])
        date_map = {e["date"]: e for e in existing_hist}
        for e in hist:
            date_map[e["date"]] = e
        history[sym] = sorted(date_map.values(), key=lambda x: x["date"])
        time.sleep(1)
    except Exception as e:
        print(f"Warning: failed to fetch {sym}: {e}")

# --- Dubai Crude: Yahoo Finance (DCB=F) ---
dubai_existing_quote = existing_data.get("quotes", {}).get("DUBAI", {})
dubai_history = existing_data.get("history", {}).get("DUBAI", [])
try:
    dubai_prices = yf_fetch_price_data("DCB=F", period="3mo", interval="1d")
    if dubai_prices:
        latest = dubai_prices[-1]
        dprice = latest["close"]
        prev_price = dubai_prices[-2]["close"] if len(dubai_prices) > 1 else dprice
        dchange = round(dprice - prev_price, 2)
        dchange_pct = round((dchange / prev_price) * 100, 2) if prev_price else 0
        quotes["DUBAI"] = {
            "symbol": "DUBAI",
            "name": "Dubai Crude",
            "price": dprice,
            "change": dchange,
            "changePercent": dchange_pct,
            "previousClose": round(prev_price, 2),
            "note": "Dubai crude — Yahoo Finance (DCB=F)",
            "source": "Yahoo Finance (DCB=F)",
        }
        # Merge histories, de-duplicate by date, sort
        date_map = {e["date"]: e for e in dubai_history}
        for e in dubai_prices:
            date_map[e["date"]] = e
        dubai_history = sorted(date_map.values(), key=lambda x: x["date"])
        history["DUBAI"] = dubai_history
        print(f"Dubai: ${dprice} (Yahoo Finance DCB=F, as of {latest['date']})")
    time.sleep(1)
except Exception as e:
    print(f"Dubai fetch failed ({e}), preserving last known price")
    if dubai_existing_quote:
        quotes["DUBAI"] = dubai_existing_quote
    if dubai_history:
        history["DUBAI"] = dubai_history

# --- Oman Crude: Yahoo Finance (OQD=F) primary, cbonds.com fallback ---
oman_existing_quote = existing_data.get("quotes", {}).get("OMAN", {})
oman_history = existing_data.get("history", {}).get("OMAN", [])
oman_fetched = False

# Try Yahoo Finance first
try:
    oman_prices = yf_fetch_price_data("OQD=F", period="3mo", interval="1d")
    if oman_prices:
        latest = oman_prices[-1]
        price = latest["close"]
        prev_price = oman_prices[-2]["close"] if len(oman_prices) > 1 else price
        change = round(price - prev_price, 2)
        change_pct = round((change / prev_price) * 100, 2) if prev_price else 0
        quotes["OMAN"] = {
            "symbol": "OMAN",
            "name": "Oman Crude",
            "price": price,
            "change": change,
            "changePercent": change_pct,
            "previousClose": round(prev_price, 2),
            "note": f"DME Oman — Yahoo Finance (OQD=F) ({latest['date']})",
            "source": "Yahoo Finance (OQD=F)",
        }
        date_map = {e["date"]: e for e in oman_history}
        for e in oman_prices:
            date_map[e["date"]] = e
        oman_history = sorted(date_map.values(), key=lambda x: x["date"])
        history["OMAN"] = oman_history
        print(f"Oman: ${price} on {latest['date']} (Yahoo Finance OQD=F)")
        oman_fetched = True
    time.sleep(1)
except Exception as e:
    print(f"Oman Yahoo Finance fetch failed ({e}), trying cbonds.com fallback")

# cbonds.com fallback
if not oman_fetched:
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
        date_map = {e["date"]: e for e in oman_history}
        if iso_date not in date_map:
            date_map[iso_date] = {"date": iso_date, "close": price}
        oman_history = sorted(date_map.values(), key=lambda x: x["date"])
        history["OMAN"] = oman_history
        print(f"Oman: ${price} on {iso_date} (cbonds.com fallback)")
    except Exception as e:
        print(f"Oman cbonds.com fallback failed ({e}), preserving last known price")
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
        _sp.run(["python3", "scripts/write-health.py", health_id], check=False)
if gulf_ships.get("ships") is not None:
    _sp.run(["python", "scripts/write-health.py", "gulf_ais"], check=False)
