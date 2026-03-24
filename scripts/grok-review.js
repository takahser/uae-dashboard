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
  const prompt = `You are reviewing a GitHub PR for a conflict tracking dashboard (ww3live.xyz) covering the Iran-GCC war starting Feb 28 2026.

Check this diff for DATA ACCURACY only:
1. Attack numbers (ballistic, cruise, UAVs) — consistent with known reporting?
2. Cumulative totals — add up correctly from daily data?
3. Coordinates for attack sites — geographically plausible?
4. Energy/market figures — match known benchmarks?
5. Dates — within the conflict timeline (Feb 28 2026 onwards)?

Reply format:
VERDICT: PASS or FLAGGED
ISSUES: (list any issues found, or "none")
CONFIDENCE: high/medium/low

Keep it concise. Only flag clear factual errors, not style issues.

Diff:
${diff.slice(0, 8000)}`;

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4-1-fast",
      stream: false,
      temperature: 0,
      messages: [
        { role: "system", content: "You are a conflict data accuracy reviewer. Be concise and factual." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`xAI API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "No response from Grok.";
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
