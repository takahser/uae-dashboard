#!/usr/bin/env python3
"""Count AIS vessels in Persian Gulf via aisstream.io WebSocket (60s window)."""
import asyncio, json, os, sys
from datetime import datetime, timezone

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "websockets"], check=True)
    import websockets

API_KEY = os.environ.get("AISSTREAM_API_KEY", "")

# Persian Gulf bounding box: [SW_lat, SW_lng], [NE_lat, NE_lng]
GULF_BBOX = [[[22.0, 48.0], [30.5, 60.5]]]
SAMPLE_SECONDS = 60

async def count_vessels():
    url = "wss://stream.aisstream.io/v0/stream"
    mmsi_seen = set()
    tanker_mmsi = set()

    subscribe = {
        "APIkey": API_KEY,
        "BoundingBoxes": GULF_BBOX,
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
                    if "Message" in msg and "PositionReport" in msg["Message"]:
                        mmsi = msg.get("MetaData", {}).get("MMSI", "")
                        ship_type = msg.get("MetaData", {}).get("ShipType", 0)
                        if mmsi:
                            mmsi_seen.add(str(mmsi))
                            # Tankers: ship type 80-89
                            if isinstance(ship_type, int) and 80 <= ship_type <= 89:
                                tanker_mmsi.add(str(mmsi))
                except asyncio.TimeoutError:
                    continue
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None, None

    return len(mmsi_seen), len(tanker_mmsi)

async def main():
    print(f"Sampling AIS for {SAMPLE_SECONDS}s over Persian Gulf...", file=sys.stderr)
    ships, tankers = await count_vessels()
    if ships is None:
        print("FAILED", file=sys.stderr)
        sys.exit(1)

    result = {
        "ships": ships,
        "tankers": tankers,
        "sampled_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sample_seconds": SAMPLE_SECONDS
    }
    print(json.dumps(result))
    print(f"Ships: {ships}, Tankers: {tankers}", file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
