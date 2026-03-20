#!/usr/bin/env python3
"""Count AIS vessels in Persian Gulf + Yanbu port via aisstream.io WebSocket (60s window)."""
import asyncio, json, os, sys
from datetime import datetime, timezone

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "websockets"], check=True)
    import websockets

API_KEY = os.environ.get("AISSTREAM_API_KEY", "")

# Bounding boxes: Persian Gulf + Yanbu port (Red Sea)
GULF_BBOX  = [[22.0, 48.0], [30.5, 60.5]]   # Persian Gulf
YANBU_BBOX = [[23.5, 37.5], [24.5, 38.7]]   # Yanbu, Saudi Red Sea

SAMPLE_SECONDS = 60

def in_bbox(lat, lng, bbox):
    return bbox[0][0] <= lat <= bbox[1][0] and bbox[0][1] <= lng <= bbox[1][1]

async def count_vessels():
    url = "wss://stream.aisstream.io/v0/stream"

    gulf_ships   = set()
    gulf_tankers = set()
    yanbu_ships  = set()
    yanbu_tankers = set()

    subscribe = {
        "APIkey": API_KEY,
        "BoundingBoxes": [GULF_BBOX, YANBU_BBOX],
        "FilterMessageTypes": ["PositionReport"]
    }

    deadline = asyncio.get_event_loop().time() + SAMPLE_SECONDS
    try:
        async with websockets.connect(url, ping_interval=20) as ws:
            await ws.send(json.dumps(subscribe))
            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=5)
                    msg = json.loads(raw)
                    if "Message" not in msg or "PositionReport" not in msg["Message"]:
                        continue
                    meta = msg.get("MetaData", {})
                    mmsi = str(meta.get("MMSI", ""))
                    ship_type = meta.get("ShipType", 0)
                    lat = meta.get("latitude", meta.get("Latitude", 0))
                    lng = meta.get("longitude", meta.get("Longitude", 0))
                    is_tanker = isinstance(ship_type, int) and 80 <= ship_type <= 89

                    if not mmsi:
                        continue

                    if in_bbox(lat, lng, GULF_BBOX):
                        gulf_ships.add(mmsi)
                        if is_tanker:
                            gulf_tankers.add(mmsi)

                    if in_bbox(lat, lng, YANBU_BBOX):
                        yanbu_ships.add(mmsi)
                        if is_tanker:
                            yanbu_tankers.add(mmsi)

                except asyncio.TimeoutError:
                    continue
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

    return {
        "gulf":  {"ships": len(gulf_ships),  "tankers": len(gulf_tankers)},
        "yanbu": {"ships": len(yanbu_ships), "tankers": len(yanbu_tankers)},
    }

async def main():
    print(f"Sampling AIS {SAMPLE_SECONDS}s — Persian Gulf + Yanbu...", file=sys.stderr)
    counts = await count_vessels()
    if counts is None:
        print("FAILED", file=sys.stderr)
        sys.exit(1)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    result = {
        "ships":       counts["gulf"]["ships"],
        "tankers":     counts["gulf"]["tankers"],
        "yanbu_ships":   counts["yanbu"]["ships"],
        "yanbu_tankers": counts["yanbu"]["tankers"],
        "sampled_at":  now,
        "sample_seconds": SAMPLE_SECONDS
    }
    print(json.dumps(result))
    print(f"Gulf: {counts['gulf']['ships']} ships / {counts['gulf']['tankers']} tankers", file=sys.stderr)
    print(f"Yanbu: {counts['yanbu']['ships']} ships / {counts['yanbu']['tankers']} tankers", file=sys.stderr)

    # Update data-substitution.json with live Yanbu count
    sub_path = "public/data-substitution.json"
    try:
        sub = json.load(open(sub_path))
        sub["routes"]["yanbu"]["live_vessel_count"] = counts["yanbu"]["ships"]
        sub["routes"]["yanbu"]["live_tanker_count"] = counts["yanbu"]["tankers"]
        sub["routes"]["yanbu"]["sampled_at"] = now
        # Append to yanbu history (one entry per date)
        today = now[:10]
        hist = sub["routes"]["yanbu"]["history"]
        if not any(h["date"] == today for h in hist):
            hist.append({"date": today, "mbpd": None, "vessel_count": counts["yanbu"]["ships"], "source": "aisstream.io"})
        else:
            for h in hist:
                if h["date"] == today:
                    h["vessel_count"] = counts["yanbu"]["ships"]
        sub["updated"] = now
        json.dump(sub, open(sub_path, "w"), indent=2)
        print(f"Updated {sub_path}", file=sys.stderr)
    except Exception as e:
        print(f"Warning: could not update substitution data: {e}", file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
