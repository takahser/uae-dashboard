#!/usr/bin/env node
/**
 * Grok Data Accuracy Reviewer
 * Reviews PR diffs for data accuracy using xAI Grok API.
 * Focuses on data files: data-uae.json, energy-attacks.json, etc.
 * Called by .github/workflows/grok-data-review.yml
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const XAI_API_KEY = process.env.XAI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY; // e.g. "takahser/uae-dashboard"

if (!XAI_API_KEY) {
  console.log('XAI_API_KEY not set — skipping Grok review');
  process.exit(0);
}

// Data files that warrant Grok review
const DATA_FILES = [
  'public/data-uae.json',
  'public/data-market.json',
  'public/data-bonds.json',
  'public/data-substitution.json',
  'src/data/energy-attacks.json',
  'src/data/electrical-threats.json',
  'src/data/hormuz.json',
];

async function getDiff() {
  try {
    // Get changed files in the PR
    const diffOutput = execSync('git diff HEAD~1 HEAD -- ' + DATA_FILES.join(' '), {
      encoding: 'utf8',
      maxBuffer: 100 * 1024,
    });
    return diffOutput.trim();
  } catch (e) {
    return '';
  }
}

async function callGrok(diff) {
  const prompt = `You are a data accuracy reviewer for a conflict tracking dashboard (ww3live.xyz) covering the Iran-UAE war that started February 28, 2026.

Review the following PR diff for DATA ACCURACY. Check:
1. Attack numbers (ballistic missiles, cruise missiles, UAVs) — do they match official UAE MoD (@modgovae) reporting?
2. Geographic coordinates for attack sites — are they plausible?
3. Energy/market data — do the figures match known benchmarks?
4. Cumulative totals — do they add up correctly from the daily data?

IMPORTANT RULES:
- Only flag genuine data errors, not code style
- If data cannot be verified, say UNVERIFIED (not FLAGGED)
- Never accept estimated or fabricated data
- Official source is @modgovae on X (Twitter)

Respond with one of:
- PASS: All data appears accurate. [brief summary]
- FLAGGED: [specific issue with the data point and what the correct value should be]
- UNVERIFIED: [data point that cannot be independently verified]

PR Diff:
${diff}`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`xAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response from Grok';
}

async function postComment(verdict) {
  const badge = verdict.startsWith('PASS') ? '✅' :
                verdict.startsWith('FLAGGED') ? '🚨' : '⚠️';

  const body = `## ${badge} Grok Data Review

${verdict}

---
*Reviewed by [Grok](https://x.ai) via xAI API | Data files checked: \`${DATA_FILES.join('`, `')}\`*`;

  const url = `https://api.github.com/repos/${REPO}/issues/${PR_NUMBER}/comments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const comment = await res.json();
  console.log('Posted comment:', comment.html_url);
}

async function main() {
  console.log('Running Grok data accuracy review...');

  const diff = await getDiff();
  if (!diff) {
    console.log('No data file changes detected — skipping review');
    process.exit(0);
  }

  console.log(`Diff size: ${diff.length} chars — sending to Grok...`);

  try {
    const verdict = await callGrok(diff);
    console.log('Grok verdict:', verdict.slice(0, 100));
    await postComment(verdict);
    console.log('Done');
  } catch (e) {
    console.error('Grok review failed:', e.message);
    // Don't fail the CI — Grok review is advisory only
    process.exit(0);
  }
}

main();
