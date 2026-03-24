#!/usr/bin/env node
/**
 * Grok Data Accuracy Reviewer — xAI API version
 * Uses grok-4-1-fast via https://api.x.ai/v1/chat/completions
 * Called by .github/workflows/grok-data-review.yml
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY;
const XAI_API_KEY = process.env.XAI_API_KEY;

if (!XAI_API_KEY) {
  console.log("XAI_API_KEY not set — skipping Grok review");
  process.exit(0);
}

if (!PR_NUMBER || !REPO) {
  console.log("Missing PR_NUMBER or GITHUB_REPOSITORY — skipping");
  process.exit(0);
}

import { execSync } from "child_process";

// Data files that warrant Grok review
const DATA_FILES = [
  "public/data-uae.json",
  "public/data-oman.json",
  "public/data-saudi.json",
  "public/data-kuwait.json",
  "public/data-bahrain.json",
  "public/data-iran.json",
  "public/data-israel.json",
  "public/data-iraq.json",
  "public/data-qatar.json",
  "public/data-market.json",
  "public/data-bonds.json",
  "public/data-substitution.json",
  "src/data/energy-attacks.json",
  "src/data/electrical-threats.json",
  "src/data/hormuz.json",
];

function getDiff() {
  try {
    return execSync("git diff HEAD~1 HEAD -- " + DATA_FILES.join(" "), {
      encoding: "utf8",
      maxBuffer: 50 * 1024,
    }).trim();
  } catch {
    return "";
  }
}

async function askGrok(diff) {
  const prompt = `You are fact-checking data changes for ww3live.xyz, a conflict tracker covering the Iran-GCC war (started Feb 28, 2026). Claude handles code review — your job is DATA ACCURACY ONLY.

Use live web search to verify figures against Reuters, AP, official MOD statements, and verified X posts.

## Data schema context
- \`daily[].unconfirmed: true\` = bar shown in different colour on chart
- \`cumulative.<field>Unconfirmed: true\` = asterisk shown on UI with explanation
- \`pendingConfirmation[]\` = unconfirmed non-numeric events tracked but NOT shown on UI

## For each changed data point, classify as one of:
- **VERIFIED** — matches a named source
- **UNCONFIRMED_NUMERIC** — number exists in reporting but not officially confirmed (include with unconfirmed flag)
- **WRONG_DATA** — number contradicts a verified source (suggest correct value)
- **UNCONFIRMED_EVENT** — non-numeric claim (e.g. person killed) with no verified source (move to pendingConfirmation, remove from displayed data)

## REQUIRED output format — you MUST use this exact 5-column markdown table. Every row MUST include a non-empty "Suggested Fix" column:

| Field | Current Value | Classification | Issue | Suggested Fix |
|-------|--------------|----------------|-------|---------------|
| cumulative.killed | 1500 | WRONG_DATA | IDF reported 4,000–5,000 as of Mar 13 [Reuters] | Set to 4500; add \`killedUnconfirmed: true\` |
| daily.2026-03-11.dronesDetected | 4 | UNCONFIRMED_NUMERIC | No MOD statement found, sourced from LWJ only | Keep value; add \`"unconfirmed": true\` to this daily entry |
| cumulative.notes — Mousavi killed | (text) | UNCONFIRMED_EVENT | No Reuters/AP/IDF confirmation found | Remove from notes; add to \`pendingConfirmation\` array as \`{type:"leadership_killed", description:"...", source:"unverified", addedDate:"YYYY-MM-DD", status:"pending"}\` |
| cumulative.ballisticDetected | 357 | VERIFIED | Matches UAE MOD Mar 24 statement [source] | No change needed |

Rules for "Suggested Fix" column:
- VERIFIED → "No change needed"
- WRONG_DATA → "Set to [correct value] per [source]"
- UNCONFIRMED_NUMERIC → "Keep value; add \`[field]Unconfirmed: true\` to cumulative OR add \`unconfirmed: true\` to daily entry"
- UNCONFIRMED_EVENT → "Remove from [field]; add to \`pendingConfirmation\` array"

After the table, on separate lines:
**OVERALL: PASS** or **OVERALL: FLAGGED**
**CONFIDENCE: high / medium / low**

Do NOT comment on code, JSON structure, or style. Data values only.

Diff:
${diff.slice(0, 8000)}`;

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast",
      tools: [{ type: "web_search" }, { type: "x_search" }],
      input: [
        { role: "system", content: "You are a conflict data fact-checker with live web search. Output a markdown table classifying each changed data point as VERIFIED, UNCONFIRMED_NUMERIC, WRONG_DATA, or UNCONFIRMED_EVENT. Suggest exact fixes. Do not review code." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  // /v1/responses format
  if (data.output_text) return data.output_text.trim();
  for (const item of data.output || []) {
    if (item.type === "message") {
      for (const c of item.content || []) {
        if (c.type === "output_text" && c.text) return c.text.trim();
      }
    }
  }
  return "No response from Grok.";
}

async function postComment(body) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({ body }),
  });
  return res.json();
}

async function main() {
  const diff = getDiff();

  if (!diff) {
    console.log("No relevant data file changes found — skipping Grok review");
    await postComment("🤖 **Grok Data Review**: No data file changes detected in this PR. Skipping review.");
    return;
  }

  console.log(`Sending ${diff.length} chars of diff to Grok API...`);
  let review;
  try {
    review = await askGrok(diff);
  } catch (err) {
    console.error("Grok API error:", err.message);
    await postComment(`🤖 **Grok Data Review**: API error — ${err.message}`);
    process.exit(1);
  }

  const verdict = review.includes("FLAGGED") ? "⚠️ FLAGGED" : "✅ PASS";
  const comment = `## 🤖 Grok Data Accuracy Review

${verdict}

${review}

---
*Reviewed by [Grok API](https://x.ai) (grok-4-1-fast) via xAI API*`;

  await postComment(comment);
  console.log("Review posted:", verdict);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
