# Implementation Spec: Attack Data Parser

**Script:** `.github/scripts/parse-attack-data.js`  
**Purpose:** Parse tweet cache and extract structured attack data using Groq LLM  
**Date:** 2026-04-02

---

## Overview

This script bridges the gap between raw tweet scraping and structured data files. It reads cached tweets from `.github/scripts/tweet-cache/{country}.json`, uses Groq's LLM API to extract numeric attack data, and updates `public/data-{country}.json` with new daily entries.

---

## 1. Input Files

### Tweet Cache (read)
- **Path:** `.github/scripts/tweet-cache/{country}.json`
- **Countries:** `uae`, `bahrain`, `qatar`, `saudi`, `israel`, `iran` (skip `kuwait`, `oman` if no attack data format)
- **Schema:**
```json
{
  "account": "@modgovae",
  "country": "uae",
  "fetchedAt": "2026-04-02T08:19:37.318Z",
  "tweets": [
    {
      "text": "تعاملت الدفاعات الجوية...",
      "time": "2026-04-01T11:20:08.000Z",
      "url": "https://x.com/modgovae/status/...",
      "likes": 767,
      "retweets": 335
    }
  ]
}
```

### Country Data (read + write)
- **Path:** `public/data-{country}.json`
- **Key fields used:**
  - `lastUpdated` — ISO timestamp of last processed data
  - `sources.{account}.lastTweetId` — last processed tweet ID (extract from URL)
  - `daily[]` — array of daily entries
  - `cumulative{}` — running totals

---

## 2. Groq API Integration

### Configuration
```javascript
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
// API key from env: process.env.GROQ_API_KEY
```

### Request Format
```javascript
const response = await fetch(GROQ_API_URL, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    temperature: 0,           // deterministic output
    response_format: { type: "json_object" }
  })
});
```

### Rate Limiting
- Max 30 requests/minute for free tier
- Implement exponential backoff: 1s, 2s, 4s, 8s (max 3 retries)
- Process one country at a time sequentially

---

## 3. Prompt Engineering

### System Prompt
```
You are a military data extraction assistant. Extract ONLY explicitly stated numbers from official Ministry of Defence tweets. Never interpolate, estimate, or infer values.

CRITICAL RULES:
1. Only extract numbers that are explicitly written in the tweet
2. If a number is ambiguous or unclear, omit that field entirely
3. Never use 0 as a placeholder for missing data — omit the field
4. Return valid JSON only — no prose, no markdown
5. Arabic numerals (٠١٢٣٤٥٦٧٨٩) must be converted to Western numerals
6. Handle both Arabic and English text
7. Distinguish between DAILY counts (for a specific date) and CUMULATIVE totals (running total)
8. If a tweet only mentions "engaged" or "intercepted" without breakdown, use the sum as the engaged/intercepted count
```

### User Prompt Template (UAE example)
```
Country: UAE
Account: @modgovae
Reporting format change: From 2026-03-13 onwards, UAE MoD reports "engaged" counts instead of intercepted/impacted breakdown.

Extract attack data from these tweets. Return JSON with this structure:
{
  "entries": [
    {
      "type": "daily",
      "date": "YYYY-MM-DD",
      "reportingType": "engaged" | "intercepted",
      "ballisticDetected": <number or omit>,
      "ballisticIntercepted": <number or omit>,
      "ballisticEngaged": <number or omit>,
      "ballisticImpacted": <number or omit>,
      "cruiseDetected": <number or omit>,
      "cruiseIntercepted": <number or omit>,
      "dronesDetected": <number or omit>,
      "dronesIntercepted": <number or omit>,
      "dronesEngaged": <number or omit>,
      "dronesImpacted": <number or omit>,
      "killed": <number or omit>,
      "injured": <number or omit>,
      "source": "<tweet URL>"
    }
  ],
  "cumulative": {
    "ballistic": <number or omit>,
    "cruise": <number or omit>,
    "drones": <number or omit>,
    "killed": <number or omit>,
    "injured": <number or omit>,
    "source": "<tweet URL if stated>"
  },
  "skipped": ["<tweet URL>: <reason>", ...]
}

If no extractable data, return: {"entries": [], "cumulative": null, "skipped": [...]}

TWEETS:
---
[Tweet 1]
Time: 2026-04-01T11:20:08.000Z
URL: https://x.com/modgovae/status/2039301785207390675
Text: تعاملت الدفاعات الجوية الإماراتية مع 5 صواريخ باليستية و35 طائرة مسيرة...
---
[Tweet 2]
...
```

### Country-Specific Prompt Variations

#### UAE (post-Mar 13)
- `reportingType: "engaged"` — only `ballisticEngaged`, `dronesEngaged` fields
- Map "تعاملت" (engaged) to engaged counts

#### UAE (pre-Mar 13)
- `reportingType: "intercepted"` — full breakdown with detected/intercepted/impacted
- Map "اعترضت" (intercepted), "رصدت" (detected), "أصابت" (impacted)

#### Bahrain
- Reports cumulative totals in each infographic tweet
- Calculate daily delta from cumulative changes

#### Israel (IDF)
- Sparse data — often no daily breakdown
- Look for "intercepted X missiles/drones" phrases

#### Iran (@khamenei_ir)
- Claims of attacks launched, not defenses
- Different schema: `missilesLaunched`, `dronesLaunched`

#### Saudi (@modgovksa)
- Arabic tweets, similar format to UAE

---

## 4. Processing Logic

### Main Flow
```javascript
async function main() {
  const countries = ["uae", "bahrain", "qatar", "saudi", "israel", "iran"];
  const log = [];

  for (const country of countries) {
    const result = await processCountry(country);
    log.push(result);
  }

  // Write processing log
  const logPath = ".github/scripts/parse-attack-data.log";
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
}
```

### Per-Country Processing
```javascript
async function processCountry(country) {
  // 1. Load tweet cache
  const cachePath = `.github/scripts/tweet-cache/${country}.json`;
  if (!fs.existsSync(cachePath)) {
    return { country, status: "skipped", reason: "no cache file" };
  }
  const cache = JSON.parse(fs.readFileSync(cachePath));

  // 2. Load country data
  const dataPath = `public/data-${country}.json`;
  const data = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath))
    : { daily: [], cumulative: {}, lastUpdated: null };

  // 3. Filter new tweets (after lastUpdated)
  const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : new Date(0);
  const newTweets = cache.tweets.filter(t => new Date(t.time) > lastUpdated);

  if (newTweets.length === 0) {
    return { country, status: "skipped", reason: "no new tweets" };
  }

  // 4. Call Groq API
  const extracted = await callGroqExtractor(country, newTweets, data);

  // 5. Merge entries (idempotent)
  const updates = mergeEntries(data, extracted);

  // 6. Recalculate cumulative
  recalculateCumulative(data);

  // 7. Update lastUpdated
  data.lastUpdated = new Date().toISOString();

  // 8. Write back
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

  return { country, status: "updated", ...updates };
}
```

### Idempotent Merge Logic
```javascript
function mergeEntries(data, extracted) {
  const existingDates = new Set(data.daily.map(e => e.date));
  let added = 0, skipped = 0;

  for (const entry of extracted.entries) {
    if (entry.type !== "daily") continue;

    if (existingDates.has(entry.date)) {
      skipped++;
      continue; // Never overwrite existing entries
    }

    // Build entry with only present fields
    const dailyEntry = {
      date: entry.date,
      label: formatLabel(entry.date), // "1 Apr"
      source: entry.source
    };

    // Copy only non-null fields
    const fields = [
      "reportingType",
      "ballisticDetected", "ballisticIntercepted", "ballisticEngaged", "ballisticImpacted",
      "cruiseDetected", "cruiseIntercepted",
      "dronesDetected", "dronesIntercepted", "dronesEngaged", "dronesImpacted",
      "killed", "injured", "notes"
    ];

    for (const field of fields) {
      if (entry[field] !== undefined && entry[field] !== null) {
        dailyEntry[field] = entry[field];
      }
    }

    // Calculate total
    dailyEntry.total = calculateTotal(dailyEntry);

    data.daily.push(dailyEntry);
    existingDates.add(entry.date);
    added++;
  }

  // Sort by date
  data.daily.sort((a, b) => a.date.localeCompare(b.date));

  // Handle cumulative updates (only if higher than current)
  if (extracted.cumulative) {
    updateCumulativeIfHigher(data.cumulative, extracted.cumulative);
  }

  return { added, skipped, skippedReasons: extracted.skipped || [] };
}
```

### Cumulative Recalculation
```javascript
function recalculateCumulative(data) {
  const cum = {};
  
  const sumFields = [
    "ballisticDetected", "ballisticIntercepted", "ballisticImpacted",
    "cruiseDetected", "cruiseIntercepted", "cruiseImpacted",
    "dronesDetected", "dronesIntercepted", "dronesImpacted",
    "killed", "injured"
  ];

  for (const field of sumFields) {
    const sum = data.daily.reduce((acc, e) => {
      // Only sum if field exists and is a number
      return acc + (typeof e[field] === "number" ? e[field] : 0);
    }, 0);
    
    // Only set if there was at least one value
    const hasValue = data.daily.some(e => typeof e[field] === "number");
    if (hasValue) {
      cum[field] = sum;
    }
  }

  // For "engaged" reporting, sum engaged fields into detected equivalents
  const ballisticEngagedSum = data.daily.reduce((acc, e) =>
    acc + (typeof e.ballisticEngaged === "number" ? e.ballisticEngaged : 0), 0);
  const dronesEngagedSum = data.daily.reduce((acc, e) =>
    acc + (typeof e.dronesEngaged === "number" ? e.dronesEngaged : 0), 0);

  if (ballisticEngagedSum > 0) {
    cum.ballistic = (cum.ballisticDetected || 0) + ballisticEngagedSum;
  }
  if (dronesEngagedSum > 0) {
    cum.drones = (cum.dronesDetected || 0) + dronesEngagedSum;
  }

  // Preserve fields not derived from daily entries (e.g., manual overrides)
  const preserveFields = ["notes", "killedMilitary", "killedCivilian"];
  for (const field of preserveFields) {
    if (data.cumulative[field] !== undefined) {
      cum[field] = data.cumulative[field];
    }
  }

  data.cumulative = cum;
}
```

---

## 5. Data Schema Reference

### UAE Daily Entry (engaged format, post-Mar 13)
```json
{
  "date": "2026-04-01",
  "label": "1 Apr",
  "reportingType": "engaged",
  "ballisticEngaged": 5,
  "dronesEngaged": 35,
  "total": 40,
  "source": "https://x.com/modgovae/status/2039302488516702588"
}
```

### UAE Daily Entry (intercepted format, pre-Mar 13)
```json
{
  "date": "2026-03-12",
  "label": "12 Mar",
  "reportingType": "intercepted",
  "ballisticDetected": 10,
  "ballisticIntercepted": 10,
  "ballisticImpacted": 0,
  "cruiseDetected": 0,
  "cruiseIntercepted": 0,
  "dronesDetected": 26,
  "dronesIntercepted": 24,
  "dronesImpacted": 2,
  "total": 36,
  "source": "https://x.com/modgovae/status/2032151500949258650"
}
```

### Bahrain Daily Entry
```json
{
  "date": "2026-03-24",
  "label": "24 Mar",
  "ballisticDetected": 6,
  "ballisticIntercepted": 6,
  "ballisticImpacted": 0,
  "dronesDetected": 19,
  "dronesIntercepted": 19,
  "dronesImpacted": 0,
  "total": 25,
  "notes": "BDF cumulative to 2026-03-24: 301 drones + 153 missiles",
  "source": "https://x.com/BDF_Bahrain/status/..."
}
```

### Cumulative Object
```json
{
  "ballisticDetected": 352,
  "ballisticIntercepted": 317,
  "ballisticImpacted": 3,
  "cruiseDetected": 15,
  "cruiseIntercepted": 15,
  "cruiseImpacted": 0,
  "dronesDetected": 1789,
  "dronesIntercepted": 1591,
  "dronesImpacted": 85,
  "killed": 8,
  "injured": 161,
  "ballistic": 352,
  "cruise": 15,
  "drones": 1789
}
```

---

## 6. Error Handling

### Groq API Errors
```javascript
async function callGroqExtractor(country, tweets, existingData, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, { ... });
      
      if (response.status === 429) {
        // Rate limited — exponential backoff
        const waitMs = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }
      
      const json = await response.json();
      const content = json.choices[0].message.content;
      
      // Parse and validate JSON
      return JSON.parse(content);
      
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

### JSON Parse Errors
```javascript
// If Groq returns malformed JSON, log and skip
try {
  const extracted = JSON.parse(content);
  if (!extracted.entries || !Array.isArray(extracted.entries)) {
    throw new Error("Invalid response structure");
  }
  return extracted;
} catch (parseErr) {
  console.error(`[${country}] Failed to parse Groq response: ${parseErr.message}`);
  console.error(`Raw content: ${content.slice(0, 500)}`);
  return { entries: [], cumulative: null, skipped: ["parse_error"] };
}
```

### Missing/Invalid Data
- Tweet has no numbers → add to `skipped` array with reason
- Date cannot be determined → skip entry
- Conflicting values in multiple tweets → prefer official MoD account
- `null` or undefined values → omit field entirely (never write `null`)

---

## 7. Arabic Text Handling

### Number Conversion
```javascript
const ARABIC_NUMERALS = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
};

function convertArabicNumerals(text) {
  return text.replace(/[٠-٩]/g, char => ARABIC_NUMERALS[char]);
}
```

### Key Arabic Terms (for reference in prompt)
| Arabic | English | Field |
|--------|---------|-------|
| صاروخ باليستي | ballistic missile | ballistic* |
| صاروخ جوال / كروز | cruise missile | cruise* |
| طائرة مسيرة | drone/UAV | drones* |
| تعاملت | engaged | *Engaged |
| اعترضت | intercepted | *Intercepted |
| رصدت | detected | *Detected |
| أصابت | impacted | *Impacted |
| قتيل/شهيد | killed | killed |
| مصاب/جريح | injured | injured |

---

## 8. Reliability Rules

### CRITICAL — No Fabrication
1. **Only extract explicitly stated numbers** — never infer or calculate
2. **Conflicting sources** — prefer official MoD account tweet over replies/quotes
3. **Gaps in data** — leave dates without entries rather than interpolating
4. **Missing fields** — omit entirely; never use 0 as placeholder
5. **Always include source** — every entry must have tweet URL

### Validation Checks
```javascript
function validateEntry(entry) {
  // Must have date
  if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
    return { valid: false, reason: "invalid_date" };
  }
  
  // Must have source URL
  if (!entry.source || !entry.source.startsWith("https://x.com/")) {
    return { valid: false, reason: "missing_source" };
  }
  
  // Must have at least one numeric field
  const numericFields = [
    "ballisticDetected", "ballisticIntercepted", "ballisticEngaged",
    "dronesDetected", "dronesIntercepted", "dronesEngaged",
    "cruiseDetected", "cruiseIntercepted", "killed", "injured"
  ];
  const hasNumeric = numericFields.some(f => typeof entry[f] === "number");
  if (!hasNumeric) {
    return { valid: false, reason: "no_numeric_data" };
  }
  
  return { valid: true };
}
```

---

## 9. GitHub Actions Integration

### update-data.yml Changes
Add after `Fetch tweets via Playwright` step, before `Commit`:

```yaml
- name: Parse attack data from tweets
  env:
    GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
  run: node .github/scripts/parse-attack-data.js
  continue-on-error: true
```

### Required Secrets
- `GROQ_API_KEY` — already available (per user context)

### Commit Step Update
Ensure `parse-attack-data.log` is excluded from commit (or add to .gitignore):
```yaml
git add public/data-*.json .github/scripts/tweet-cache/*.json public/health/
```

---

## 10. Testing & Validation

### Dry Run Mode
```bash
# Run without writing to data files
DRY_RUN=true node .github/scripts/parse-attack-data.js
```

### Validation Script
```javascript
// Separate script: validate-attack-data.js
// Checks:
// 1. All daily entries have valid dates and sources
// 2. No duplicate dates
// 3. Cumulative totals match sum of daily entries
// 4. No null/undefined values in numeric fields
```

### Manual Testing
1. Run tweet fetcher: `node .github/scripts/fetch-tweets-playwright.js`
2. Run parser: `GROQ_API_KEY=xxx node .github/scripts/parse-attack-data.js`
3. Diff data files: `git diff public/data-*.json`
4. Verify source URLs are valid

---

## 11. File Structure

```
.github/
  scripts/
    fetch-tweets-playwright.js   # existing
    parse-attack-data.js         # NEW — this spec
    parse-attack-data.log        # output log (gitignored)
    tweet-cache/
      uae.json
      bahrain.json
      ...
  workflows/
    update-data.yml              # add new step
public/
  data-uae.json
  data-bahrain.json
  ...
```

---

## 12. Implementation Checklist

- [ ] Create `.github/scripts/parse-attack-data.js`
- [ ] Implement Groq API client with retry logic
- [ ] Build country-specific prompt templates
- [ ] Implement idempotent merge logic
- [ ] Implement cumulative recalculation
- [ ] Add Arabic numeral conversion
- [ ] Add entry validation
- [ ] Add dry-run mode
- [ ] Update `update-data.yml` workflow
- [ ] Add `parse-attack-data.log` to `.gitignore`
- [ ] Test with real tweet cache
- [ ] Verify idempotency (re-run produces same result)
