#!/usr/bin/env python3
"""One-time backfill for WTI, Brent, and Dubai crude historical data."""
import requests, json, time, os
from datetime import datetime, timezone

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
FALLBACK_URL = "https://query2.finance.yahoo.com/v8/finance/chart"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

BACKFILL_START = "2026-02-01"


def fetch_price_data(ticker, period="3mo", interval="1h"):
    url = f"{BASE_URL}/{ticker}"
    params = {"range": period, "interval": interval}
    try:
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"Primary failed for {ticker}: {e}, trying fallback...")
        url = f"{FALLBACK_URL}/{ticker}"
        response = requests.get(url, headers=HEADERS, params=params, timeout=15)
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


def main():
    market_path = "public/data-market.json"
    if not os.path.exists(market_path):
        print(f"Error: {market_path} not found")
        return

    with open(market_path) as f:
        data = json.load(f)

    # Fetch WTI 1h
    print("Fetching WTI (CL=F) 1h...")
    wti_data = fetch_price_data("CL=F", period="3mo", interval="1h")
    time.sleep(1)

    # Fetch Brent 1h
    print("Fetching Brent (BZ=F) 1h...")
    brent_data = fetch_price_data("BZ=F", period="3mo", interval="1h")
    time.sleep(1)

    # Fetch Dubai 1d
    print("Fetching Dubai (DCB=F) 1d...")
    dubai_data = fetch_price_data("DCB=F", period="3mo", interval="1d")
    time.sleep(1)

    # Filter to backfill start
    wti_data = [p for p in wti_data if p["date"] >= BACKFILL_START]
    brent_data = [p for p in brent_data if p["date"] >= BACKFILL_START]
    dubai_data = [p for p in dubai_data if p["date"] >= BACKFILL_START]

    # Remove duplicates (keep last occurrence)
    def dedup(prices):
        seen = {}
        for p in prices:
            seen[p["date"]] = p
        return list(seen.values())

    wti_data = dedup(wti_data)
    brent_data = dedup(brent_data)
    dubai_data = dedup(dubai_data)

    # Sort
    wti_data.sort(key=lambda x: x["date"])
    brent_data.sort(key=lambda x: x["date"])
    dubai_data.sort(key=lambda x: x["date"])

    print(f"WTI: {len(wti_data)} points")
    print(f"Brent: {len(brent_data)} points")
    print(f"Dubai: {len(dubai_data)} points")

    # Update data-market.json
    data["history"]["CL=F"] = wti_data
    data["history"]["BZ=F"] = brent_data
    data["history"]["DUBAI"] = dubai_data

    # Update Dubai quote from latest backfilled daily close
    if dubai_data:
        latest = dubai_data[-1]
        prev = dubai_data[-2]["close"] if len(dubai_data) > 1 else latest["close"]
        change = round(latest["close"] - prev, 2)
        change_pct = round((change / prev) * 100, 2) if prev else 0
        data["quotes"]["DUBAI"] = {
            "symbol": "DUBAI",
            "name": "Dubai Crude",
            "price": latest["close"],
            "change": change,
            "changePercent": change_pct,
            "previousClose": round(prev, 2),
            "note": f"Dubai crude — Yahoo Finance ({latest['date']})",
            "source": "Yahoo Finance (DCB=F)",
        }

    with open(market_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Backfill complete. Updated {market_path}")


if __name__ == "__main__":
    main()
