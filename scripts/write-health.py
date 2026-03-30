#!/usr/bin/env python3
"""
Write a health timestamp for a data source.
Usage: python scripts/write-health.py <source_id> [source_id2 ...]

Reads existing file to preserve all fields; only updates last_updated.
After writing, regenerates public/health/index.json from all source files.
"""
import argparse, json, os, sys, glob
from datetime import datetime, timezone

SOURCES_CONFIG = {
    "brent":            {"label": "Brent Crude (EU)",       "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "wti":              {"label": "WTI Crude (US)",          "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "dubai":            {"label": "Dubai Crude",             "category": "market",   "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "oman":             {"label": "Oman Crude",              "category": "market",   "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "natgas":           {"label": "Natural Gas",             "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "aramco":           {"label": "Saudi Aramco",            "category": "market",   "stale_after_hours": 36, "market_hours_only": True,  "trading_days": "sun-thu"},
    "frontline":        {"label": "Frontline (FRO)",         "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "stng":             {"label": "Scorpio Tankers (STNG)",  "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "rtx":              {"label": "RTX Corp",                "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "lmt":              {"label": "Lockheed Martin (LMT)",   "category": "market",   "stale_after_hours": 2,  "market_hours_only": True,  "trading_days": "mon-fri"},
    "gulf_ais":         {"label": "Gulf AIS Ships",          "category": "ais",      "stale_after_hours": 2,  "market_hours_only": False, "trading_days": None},
    "hormuz_chart":     {"label": "Hormuz Ship Count Chart", "category": "ais",      "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "yanbu_route":      {"label": "Yanbu Route (AIS)",       "category": "ais",      "stale_after_hours": 2,  "market_hours_only": False, "trading_days": None},
    "fujairah_route":   {"label": "Fujairah Route (AIS)",    "category": "ais",      "stale_after_hours": 2,  "market_hours_only": False, "trading_days": None},
    "bonds":            {"label": "Bond Market Yields",      "category": "bonds",    "stale_after_hours": 36, "market_hours_only": True,  "trading_days": "mon-fri"},
    "iran_data":        {"label": "Iran Conflict Data",      "category": "attacks",  "type": "event"},
    "uae_attacks":      {"label": "UAE Attack Data",         "category": "attacks",  "type": "event"},
    "bahrain_attacks":  {"label": "Bahrain Attack Data",     "category": "attacks",  "type": "event"},
    "kuwait_attacks":   {"label": "Kuwait Attack Data",      "category": "attacks",  "type": "event"},
    "flight_dxb":       {"label": "DXB Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_auh":       {"label": "AUH Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_dwc":       {"label": "DWC Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_mct":       {"label": "MCT Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_doh":       {"label": "DOH Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_tlv":       {"label": "TLV Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_bah":       {"label": "BAH Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_kwi":       {"label": "KWI Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
    "flight_shj":       {"label": "SHJ Flights",             "category": "flights",  "stale_after_hours": 36, "market_hours_only": False, "trading_days": None},
}

HEALTH_DIR = "public/health"
os.makedirs(HEALTH_DIR, exist_ok=True)

now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

parser = argparse.ArgumentParser()
parser.add_argument("source_ids", nargs="+")
parser.add_argument("--old-value")
parser.add_argument("--new-value")
parser.add_argument("--method")
parser.add_argument("--source-url")
args = parser.parse_args()

source_ids = args.source_ids

for source_id in source_ids:
    path = os.path.join(HEALTH_DIR, f"{source_id}.json")
    config = SOURCES_CONFIG.get(source_id, {})

    # Read-modify-write: preserve existing fields (especially override)
    existing = {}
    if os.path.exists(path):
        try:
            with open(path) as f:
                existing = json.load(f)
        except Exception:
            pass

    # Merge: config defaults < existing fields < new timestamp
    merged = {**config, **existing}
    merged["id"] = source_id
    merged["last_updated"] = now  # only field we overwrite

    with open(path, "w") as f:
        json.dump(merged, f, indent=2)

    print(f"health: {source_id} updated at {now}")

# Append to history if new_value provided
HISTORY_DIR = os.path.join(HEALTH_DIR, "history")
os.makedirs(HISTORY_DIR, exist_ok=True)

if args.new_value:
    for source_id in source_ids:
        hist_path = os.path.join(HISTORY_DIR, f"{source_id}.json")
        history = []
        if os.path.exists(hist_path):
            try:
                with open(hist_path) as f:
                    history = json.load(f)
            except Exception:
                pass

        entry = {"timestamp": now}
        if args.old_value:
            entry["old_value"] = args.old_value
        if args.new_value:
            entry["new_value"] = args.new_value
        if args.method:
            entry["method"] = args.method
        if args.source_url:
            entry["source_url"] = args.source_url

        history.insert(0, entry)
        history = history[:90]

        with open(hist_path, "w") as f:
            json.dump(history, f, indent=2)
        print(f"history: {source_id} logged ({len(history)} entries)")

# Regenerate index.json from all source files (atomic: write all, then move)
all_sources = {}
for fpath in sorted(glob.glob(os.path.join(HEALTH_DIR, "*.json"))):
    fname = os.path.basename(fpath)
    if fname == "index.json":
        continue
    try:
        with open(fpath) as f:
            data = json.load(f)
        sid = data.get("id", fname.replace(".json", ""))
        all_sources[sid] = data
    except Exception as e:
        print(f"Warning: could not read {fpath}: {e}")

index = {
    "generated_at": now,
    "sources": all_sources,
}
index_path = os.path.join(HEALTH_DIR, "index.json")
tmp_path = index_path + ".tmp"
with open(tmp_path, "w") as f:
    json.dump(index, f, indent=2)
os.replace(tmp_path, index_path)
print(f"health: index.json regenerated ({len(all_sources)} sources)")
