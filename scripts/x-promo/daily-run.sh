#!/bin/bash
# Run once daily via cron: 0 9 * * * /Users/chou/repos/uae-dashboard/scripts/x-promo/daily-run.sh
cd /Users/chou/repos/uae-dashboard/scripts/x-promo
node generate-tweets.js >> /tmp/x-promo.log 2>&1
