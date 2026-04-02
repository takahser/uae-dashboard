# Spec: Wire --new-value into Workflow Health Calls

**Status:** Ready for implementation
**Date:** 2026-03-31
**Audience:** Claude Sonnet (implementation agent)

## Current State

`extract-health-values.py` already extracts values and sets shell variables for most sources. Both workflows already `eval` this script and pass `--new-value` / `--old-value` via bash parameter expansion (`${VAR:+--flag "$VAR"}`).

**Already wired (no changes needed):**
- `update-market.yml`: brent, wti, natgas, aramco, frontline, stng, rtx, lmt, dubai, oman
- `update-bonds.yml`: bonds

**NOT wired (needs work):**

| Source | Workflow | Why missing |
|--------|----------|-------------|
| `gulf_ais` | update-market.yml (line 54) | AIS data comes from a separate script, not market JSON |
| `hormuz_chart` | update-market.yml (line 55) | Derived from hormuz.json append, no extraction logic |

## Changes Required

### 1. Add AIS extraction to `scripts/extract-health-values.py`

Add a new function `extract_ais()` and wire it into `__main__`:

```python
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
```

Also extract the latest hormuz entry for `hormuz_chart`:

```python
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
```

Add `elif mode == "ais"` branch to `__main__` that calls both.

### 2. Update `update-market.yml` — "Write health timestamps" step

Add an `eval` line for AIS extraction, then update the two AIS health calls:

```yaml
# After the existing eval line for market:
eval "$(python scripts/extract-health-values.py ais)"

# Replace existing gulf_ais line:
python scripts/write-health.py gulf_ais --method aisstream --source-url "wss://stream.aisstream.io/v0/stream" ${GULF_AIS_OLD:+--old-value "$GULF_AIS_OLD"} ${GULF_AIS_NEW:+--new-value "$GULF_AIS_NEW"} || true

# Replace existing hormuz_chart line:
python scripts/write-health.py hormuz_chart --method aisstream --source-url "wss://stream.aisstream.io/v0/stream" ${HORMUZ_CHART_OLD:+--old-value "$HORMUZ_CHART_OLD"} ${HORMUZ_CHART_NEW:+--new-value "$HORMUZ_CHART_NEW"} || true
```

### 3. No changes to `update-bonds.yml`

Already fully wired.

## Edge Cases

1. **AIS script fails**: `count-gulf-ships.py` writes `{"ships":null,"tankers":null}` on failure (line 28 of workflow). `extract_ais()` should treat `null` as missing — the `if ships is not None` guard handles this. No `--new-value` is passed, so no broken history entry is created.

2. **First run / no history file**: `write-health.py` creates the history file on first `--new-value` call (lines 88-94). No special handling needed.

3. **hormuz.json empty or missing**: `extract_hormuz()` catches exceptions and the `if data:` guard handles empty arrays. Shell variables stay unset, no `--new-value` passed.

4. **`/tmp/gulf-ships.json` not yet written**: The AIS step runs before the health step in the workflow, so the file will exist. If somehow missing, the try/except handles it.

5. **old_value semantics for AIS**: For market sources, old_value = previous close (meaningful delta). For AIS, we use tanker count as old_value — it's a secondary metric, not a "previous" value. This is a pragmatic choice; the AdminView history table shows "Old" / "New" columns and having both ship + tanker counts visible is useful.

## Files to Modify

1. `scripts/extract-health-values.py` — add `extract_ais()`, `extract_hormuz()`, and `ais` mode
2. `.github/workflows/update-market.yml` — add `eval` for ais, update 2 health lines

## Verification

After implementation:
- Run `python scripts/count-gulf-ships.py > /tmp/gulf-ships.json` (needs API key) or create a mock file
- Run `python scripts/extract-health-values.py ais` and confirm `GULF_AIS_NEW` and `HORMUZ_CHART_NEW` are printed
- Run the full health write and confirm `public/health/history/gulf_ais.json` is created
