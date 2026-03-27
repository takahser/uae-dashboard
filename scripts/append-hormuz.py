#!/usr/bin/env python3
"""Append today's AIS vessel count to src/data/hormuz.json."""
import json, sys
from datetime import datetime, timezone

gulf_file = "/tmp/gulf-ships.json"
hormuz_file = "src/data/hormuz.json"

try:
    with open(gulf_file) as f:
        gulf = json.load(f)
    ships = gulf.get("ships")
    tankers = gulf.get("tankers", 0)
    if ships is None:
        print("No AIS data — skipping hormuz.json update")
        sys.exit(0)
except Exception as e:
    print(f"Could not read gulf ships: {e}")
    sys.exit(0)

today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

with open(hormuz_file) as f:
    data = json.load(f)

existing_dates = {e["date"] for e in data}
if today in existing_dates:
    print(f"hormuz.json already has entry for {today} — skipping")
    sys.exit(0)

data.append({
    "date": today,
    "ships": ships,
    "tankers": tankers,
    "oil_mbpd": 0.0,
    "status": "critical",
    "notes": f"AIS: {ships} vessels detected.",
    "tollPassage": True
})
data.sort(key=lambda x: x["date"])

with open(hormuz_file, "w") as f:
    json.dump(data, f, indent=2)

print(f"hormuz.json: added {today} — ships={ships}, tankers={tankers}")
