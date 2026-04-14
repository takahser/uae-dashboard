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


class YahooFinanceFetcher:
    BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
    FALLBACK_URL = "https://query2.finance.yahoo.com/v8/finance/chart"
    HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    def fetch_price_data(self, ticker, period="1mo", interval="1h"):
        url = f"{self.BASE_URL}/{ticker}"
        params = {"range": period, "interval": interval}
        try:
            response = requests.get(url, headers=self.HEADERS, params=params, timeout=15)
            response.raise_for_status()
        except Exception:
            url = f"{self.FALLBACK_URL}/{ticker}"
            response = requests.get(url, headers=self.HEADERS, params=params, timeout=15)
            response.raise_for_status()
        data = response.json()
        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        closes = result["indicators"]["quote"][0]["close"]
        prices = []
        for ts, close in zip(timestamps, closes):
            if close is not None:
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                fmt = "%Y-%m-%dT%H:%M" if interval != "1d" else "%Y-%m-%d"
                prices.append({"date": dt.strftime(fmt), "close": round(close, 2)})
        return prices

    def fetch_quote(self, ticker):
        url = f"{self.BASE_URL}/{ticker}"
        params = {"range": "1d", "interval": "1d"}
        try:
            response = requests.get(url, headers=self.HEADERS, params=params, timeout=15)
            response.raise_for_status()
        except Exception:
            url = f"{self.FALLBACK_URL}/{ticker}"
            response = requests.get(url, headers=self.HEADERS, params=params, timeout=15)
            response.raise_for_status()
        data = response.json()
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("chartPreviousClose", meta.get("previousClose", 0))
        # Fallback: use last close if regularMarketPrice is missing
        if not price:
            timestamps = result.get("timestamp", [])
            closes = result["indicators"]["quote"][0].get("close", [])
            for c in reversed(closes):
                if c is not None:
                    price = c
                    break
        return price, prev


# Load existing data to preserve history
existing_data = {}
market_path = "public/data-market.json"
if os.path.exists(market_path):
    try:
        with open(market_path) as f:
            existing_data = json.load(f)
    except Exception:
        pass


def merge_history(new_hist, old_hist):
    """Merge new history into old, deduplicate by date, sort, and return."""
    merged = {entry["date"]: entry for entry in (old_hist or [])}
    for entry in new_hist:
        merged[entry["date"]] = entry
    return sorted(merged.values(), key=lambda x: x["date"])


yahoo = YahooFinanceFetcher()
quotes = {}
history = {}

# --- Main SYMBOLS loop ---
for sym in SYMBOLS:
    try:
        # Quote (always 1d)
        price, prev = yahoo.fetch_quote(sym)
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
        # History: hourly for WTI/Brent, daily for others
        interval = "1h" if sym in ("CL=F", "BZ=F") else "1d"
        period = "30d" if sym in ("CL=F", "BZ=F") else "30d"
        hist = yahoo.fetch_price_data(sym, period=period, interval=interval)
        old_hist = existing_data.get("history", {}).get(sym, [])
        history[sym] = merge_history(hist, old_hist)
        time.sleep(1)
    except Exception as e:
        print(f"Warning: failed to fetch {sym}: {e}")


# --- Dubai Crude: Yahoo Finance DCB=F ---
dubai_existing_quote = existing_data.get("quotes", {}).get("DUBAI", {})
dubai_history = existing_data.get("history", {}).get("DUBAI", [])
try:
    dubai_prices = yahoo.fetch_price_data("DCB=F", period="90d", interval="1d")
    time.sleep(1)
    if dubai_prices:
        latest = dubai_prices[-1]
        prev_close = dubai_prices[-2]["close"] if len(dubai_prices) > 1 else latest["close"]
        dchange = round(latest["close"] - prev_close, 2)
        dchange_pct = round((dchange / prev_close) * 100, 2) if prev_close else 0
        quotes["DUBAI"] = {
            "symbol": "DUBAI",
            "name": "Dubai Crude",
            "price": latest["close"],
            "change": dchange,
            "changePercent": dchange_pct,
            "previousClose": round(prev_close, 2),
            "note": f"Dubai crude — Yahoo Finance ({latest['date']})",
            "source": "Yahoo Finance (DCB=F)",
        }
        dubai_history = merge_history(dubai_prices, dubai_history)
        history["DUBAI"] = dubai_history
        print(f"Dubai: ${latest['close']} (Yahoo Finance, as of {latest['date']})")
    else:
        raise ValueError("No Dubai price data returned")
except Exception as e:
    print(f"Dubai fetch failed ({e}), preserving last known price")
    if dubai_existing_quote:
        quotes["DUBAI"] = dubai_existing_quote
    if dubai_history:
        history["DUBAI"] = dubai_history

# --- Oman Crude: Yahoo Finance OQD=F primary, cbonds.com fallback ---
oman_existing_quote = existing_data.get("quotes", {}).get("OMAN", {})
oman_history = existing_data.get("history", {}).get("OMAN", [])
oman_fetched = False

# Try Yahoo Finance first
try:
    oman_prices = yahoo.fetch_price_data("OQD=F", period="90d", interval="1d")
    time.sleep(1)
    if oman_prices:
        latest = oman_prices[-1]
        prev_close = oman_prices[-2]["close"] if len(oman_prices) > 1 else latest["close"]
        change = round(latest["close"] - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2) if prev_close else 0
        quotes["OMAN"] = {
            "symbol": "OMAN",
            "name": "Oman Crude",
            "price": latest["close"],
            "change": change,
            "changePercent": change_pct,
            "previousClose": round(prev_close, 2),
            "note": f"DME Oman — Yahoo Finance ({latest['date']})",
            "source": "Yahoo Finance (OQD=F)",
        }
        oman_history = merge_history(oman_prices, oman_history)
        history["OMAN"] = oman_history
        print(f"Oman: ${latest['close']} on {latest['date']} (Yahoo Finance)")
        oman_fetched = True
except Exception as e:
    print(f"Oman Yahoo Finance fetch failed ({e}), trying cbonds.com fallback...")

# Fallback to cbonds.com
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
        _sp.run(["python3", "scripts/write-health.py", health_id], check=False)
if gulf_ships.get("ships") is not None:
    _sp.run(["python3", "scripts/write-health.py", "gulf_ais"], check=False)
