#!/bin/bash
# ─────────────────────────────────────────────────────────────
# GitHub Actions Watchdog — runs as backup if GH Action fails
#
# Usage: ./scripts/watchdog-gh-action.sh <workflow-name> <fallback-command>
# Example: ./scripts/watchdog-gh-action.sh "log-flights.yml" "node .github/scripts/log-official-flights.mjs"
#
# Designed to run ~30 min after the GH Action schedule.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

WORKFLOW="${1:-log-flights.yml}"
FALLBACK_CMD="${2:-echo 'No fallback command specified'}"
REPO="takahser/uae-dashboard"
LOOKBACK_MINUTES=120 # Check runs from last 2 hours

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# ─────────────────────────────────────────────────────────────
# Check if gh CLI is available
# ─────────────────────────────────────────────────────────────
if ! command -v gh &> /dev/null; then
  log "${RED}Error: gh CLI not installed${NC}"
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# Get latest run of the workflow
# ─────────────────────────────────────────────────────────────
log "Checking GitHub Action: ${WORKFLOW}"

LATEST_RUN=$(gh run list \
  --repo "$REPO" \
  --workflow "$WORKFLOW" \
  --limit 1 \
  --json status,conclusion,createdAt,databaseId \
  2>/dev/null || echo "[]")

if [[ "$LATEST_RUN" == "[]" ]] || [[ -z "$LATEST_RUN" ]]; then
  log "${YELLOW}No runs found for workflow: $WORKFLOW${NC}"
  RUN_STATUS="not_found"
else
  RUN_STATUS=$(echo "$LATEST_RUN" | jq -r '.[0].status // "unknown"')
  RUN_CONCLUSION=$(echo "$LATEST_RUN" | jq -r '.[0].conclusion // "unknown"')
  RUN_CREATED=$(echo "$LATEST_RUN" | jq -r '.[0].createdAt // ""')
  RUN_ID=$(echo "$LATEST_RUN" | jq -r '.[0].databaseId // ""')
fi

# ─────────────────────────────────────────────────────────────
# Check if run is from today and recent enough
# ─────────────────────────────────────────────────────────────
TODAY=$(date -u '+%Y-%m-%d')
NOW_EPOCH=$(date +%s)

is_recent_run() {
  if [[ -z "${RUN_CREATED:-}" ]]; then
    return 1
  fi

  # Extract date from ISO timestamp
  RUN_DATE="${RUN_CREATED:0:10}"

  if [[ "$RUN_DATE" != "$TODAY" ]]; then
    return 1
  fi

  # Check if within lookback window (macOS compatible)
  if [[ "$(uname)" == "Darwin" ]]; then
    RUN_EPOCH=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "${RUN_CREATED}" +%s 2>/dev/null || echo 0)
  else
    RUN_EPOCH=$(date -d "$RUN_CREATED" +%s 2>/dev/null || echo 0)
  fi

  DIFF=$((NOW_EPOCH - RUN_EPOCH))
  MAX_AGE=$((LOOKBACK_MINUTES * 60))

  [[ $DIFF -lt $MAX_AGE ]]
}

# ─────────────────────────────────────────────────────────────
# Decision logic
# ─────────────────────────────────────────────────────────────
should_run_fallback() {
  case "$RUN_STATUS" in
    "not_found")
      log "${YELLOW}No workflow runs found${NC}"
      return 0
      ;;
    "completed")
      if [[ "$RUN_CONCLUSION" == "success" ]] && is_recent_run; then
        log "${GREEN}✓ GH Action succeeded (run $RUN_ID)${NC}"
        return 1
      elif [[ "$RUN_CONCLUSION" == "failure" ]] || [[ "$RUN_CONCLUSION" == "cancelled" ]]; then
        log "${RED}✗ GH Action $RUN_CONCLUSION (run $RUN_ID)${NC}"
        return 0
      else
        log "${YELLOW}GH Action completed but not recent: ${RUN_DATE:-unknown}${NC}"
        return 0
      fi
      ;;
    "in_progress"|"queued"|"waiting")
      log "${YELLOW}GH Action still running (status: $RUN_STATUS)${NC}"
      return 1 # Don't interfere with running job
      ;;
    *)
      log "${YELLOW}Unknown status: $RUN_STATUS${NC}"
      return 0
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────
# Main execution
# ─────────────────────────────────────────────────────────────
if should_run_fallback; then
  log "${YELLOW}Running fallback locally...${NC}"

  # Change to repo directory
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_DIR="$(dirname "$SCRIPT_DIR")"
  cd "$REPO_DIR"

  # Execute fallback
  if eval "$FALLBACK_CMD"; then
    log "${GREEN}✓ Local fallback succeeded${NC}"

    # Commit and push if there are changes
    if git diff --quiet public/verification/ 2>/dev/null; then
      log "No changes to commit"
    else
      git add public/verification/
      git commit -m "chore: log flight data (local fallback)"
      git push
      log "${GREEN}✓ Changes pushed${NC}"
    fi
  else
    log "${RED}✗ Local fallback FAILED${NC}"

    # Alert via Telegram (requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] && [[ -n "${TELEGRAM_CHAT_ID:-}" ]]; then
      MSG="⚠️ UAE Dashboard: Both GH Action and local fallback failed for $WORKFLOW"
      curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d chat_id="$TELEGRAM_CHAT_ID" \
        -d text="$MSG" \
        -d parse_mode="HTML" > /dev/null
      log "Alert sent to Telegram"
    fi

    exit 1
  fi
else
  log "No action needed"
fi
