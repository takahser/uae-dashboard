#!/bin/bash
# Run 45 min after GH Actions schedule as backup
# Crontab: 15 7 * * * /Users/chou/repos/uae-dashboard/scripts/watchdog-playwright.sh

WORKFLOW="log-flights-playwright.yml"
REPO="takahser/uae-dashboard"
REPO_DIR="/Users/chou/repos/uae-dashboard"

cd "$REPO_DIR" || exit 1

# Check if GH Action succeeded today
LATEST=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 1 --json conclusion,createdAt 2>/dev/null)
CONCLUSION=$(echo "$LATEST" | jq -r '.[0].conclusion // "unknown"')
RUN_DATE=$(echo "$LATEST" | jq -r '.[0].createdAt // ""' | cut -c1-10)
TODAY=$(date -u '+%Y-%m-%d')

if [[ "$CONCLUSION" == "success" && "$RUN_DATE" == "$TODAY" ]]; then
  echo "GH Action succeeded today, skipping local run"
  exit 0
fi

echo "Running local Playwright scrapers as backup..."

node .github/scripts/scrapers/scrape-auh.mjs || echo "AUH failed"
node .github/scripts/scrapers/scrape-dwc.mjs || echo "DWC failed"
node .github/scripts/scrapers/scrape-mct.mjs || echo "MCT failed"
node .github/scripts/scrapers/scrape-ruh.mjs || echo "RUH failed"
node .github/scripts/scrapers/scrape-tlv.mjs || echo "TLV failed"

# Commit and push
git add public/verification/ public/health/
git commit -m "chore: playwright flight data (local backup)" && git push
