# Flight Data Accuracy Audit (2026-04-12)

## Summary

This audit compares **official airport scraper data** (ground truth) against **3rd party API data** 
to identify discrepancies and determine the most accurate data sources for backfilling
pre-April 2026 historical data.

### Methodology

- **Ground Truth:** Official airport website scrapers (verification logs) and official production entries
- **Test Sources:** Third-party APIs (OpenSky, AeroDataBox, etc.)
- **Metric:** Discrepancy = |API - Ground Truth| / Ground Truth × 100%

### Best API per Airport

| Airport | Best API | Avg Discrepancy | Bias | Data Points | Recommendation |
|---------|----------|-----------------|------|-------------|----------------|
| DXB (Dubai International (DXB)) | AeroDataBox/Prod | 6.6% | chronically overcounts | 10 | Use with ÷1.06 correction |
| AUH (Abu Dhabi Intl (AUH)) | AeroDataBox/Prod | 61.6% | chronically undercounts | 5 | Use with ×1.52 correction |
| DOH (Hamad Intl (DOH)) | AeroDataBox/Prod | 77.0% | chronically undercounts | 9 | Use with ×1.77 correction |
| JED (Jeddah (JED)) | AeroDataBox/Prod | 39.1% | chronically undercounts | 10 | Use with ×1.39 correction |

### Overall API Accuracy Ranking

| Rank | API Source | Avg Discrepancy | Airports Covered | Data Points |
|------|------------|-----------------|------------------|-------------|
| 1 | AeroDataBox (Production) | 42.9% | DXB, AUH, DOH, JED | 34 |
| 2 | OpenSky | 82.1% | DXB, DOH | 19 |

---

## Per-Airport Analysis

### DXB (Dubai International (DXB))

- **Date range compared:** 2026-04-03 to 2026-04-12
- **Total days compared:** 10
- **Third-party APIs available:** OpenSky
- **Ground truth source:** Official airport website scraper

#### Best Third-Party API: AeroDataBox (Production)

- Average discrepancy: 6.6%
- Standard deviation: 16.4%
- Min discrepancy: 0.0%
- Max discrepancy: 55.8%
- Average signed error: 5.9%
- Direction: 4 undercount days, 5 overcount days, 1 exact
- Pattern: chronically overcounts

**Correction Factor:** Divide AeroDataBox totals by **1.06**

#### OpenSky Detailed Analysis

- Days compared: 9
- Average discrepancy: 75.7%
- Standard deviation: 13.9%
- Average signed error: -75.7%
- Pattern: chronically undercounts (9 under, 0 over)
- **Correction factor for backfill:** Multiply OpenSky by 1.76

#### Production/AeroDataBox Detailed Analysis

- Days compared: 10
- Average discrepancy: 6.6%
- Standard deviation: 16.4%
- Average signed error: 5.9%
- Pattern: chronically overcounts (4 under, 5 over)
- **Correction factor for backfill:** Divide AeroDataBox by 1.06

#### Daily Comparison Table

| Date | Ground Truth | Source | OpenSky | Δ% | Direction | Prod/Aero | Δ% | Direction |
|------|--------------|--------|---------|-----|-----------|-----------|-----|-----------|
| 2026-04-03 | 460 | dubaiairports.ae... | 108 | 76.5% | undercount | 471 | 2.4% | overcount |
| 2026-04-04 | 469 | dubaiairports.ae... | 92 | 80.4% | undercount | 476 | 1.5% | overcount |
| 2026-04-05 | 473 | dubaiairports.ae... | 90 | 81.0% | undercount | 485 | 2.5% | overcount |
| 2026-04-06 | 471 | dubaiairports.ae... | 232 | 50.7% | undercount | 467 | 0.8% | undercount |
| 2026-04-07 | 486 | dubaiairports.ae... | 50 | 89.7% | undercount | 479 | 1.4% | undercount |
| 2026-04-08 | 473 | dubaiairports.ae... | 78 | 83.5% | undercount | 472 | 0.2% | undercount |
| 2026-04-09 | 488 | dubaiairports.ae... | 230 | 52.9% | undercount | 488 | 0.0% | exact |
| 2026-04-10 | 478 | dubaiairports.ae... | 124 | 74.1% | undercount | 480 | 0.4% | overcount |
| 2026-04-11 | 489 | dubaiairports.ae... | 36 | 92.6% | undercount | 484 | 1.0% | undercount |
| 2026-04-12 | 491 | dubaiairports.ae... | - | - | - | 765 | 55.8% | overcount |

---

### AUH (Abu Dhabi Intl (AUH))

- **Date range compared:** 2026-04-04 to 2026-04-12
- **Total days compared:** 5
- **Third-party APIs available:** None
- **Ground truth source:** Official airport website scraper

#### Best Third-Party API: AeroDataBox (Production)

- Average discrepancy: 61.6%
- Standard deviation: 19.2%
- Min discrepancy: 51.1%
- Max discrepancy: 100.0%
- Average signed error: -52.0%
- Direction: 4 undercount days, 1 overcount days, 0 exact
- Pattern: chronically undercounts

**Correction Factor:** Multiply AeroDataBox totals by **1.52**

#### Production/AeroDataBox Detailed Analysis

- Days compared: 5
- Average discrepancy: 61.6%
- Standard deviation: 19.2%
- Average signed error: -52.0%
- Pattern: chronically undercounts (4 under, 1 over)
- **Correction factor for backfill:** Multiply AeroDataBox by 1.52

#### Daily Comparison Table

| Date | Ground Truth | Source | OpenSky | Δ% | Direction | Prod/Aero | Δ% | Direction |
|------|--------------|--------|---------|-----|-----------|-----------|-----|-----------|
| 2026-04-04 | 273 | zayedinternationalai... | - | - | - | 126 | 53.8% | undercount |
| 2026-04-06 | 266 | zayedinternationalai... | - | - | - | 130 | 51.1% | undercount |
| 2026-04-07 | 247 | zayedinternationalai... | - | - | - | 119 | 51.8% | undercount |
| 2026-04-08 | 231 | zayedinternationalai... | - | - | - | 113 | 51.1% | undercount |
| 2026-04-12 | 0 | zayedinternationalai... | - | - | - | 433 | 100.0% | overcount |

---

### DWC (Al Maktoum Intl (DWC))

**No comparison data available.**

This could mean:
- No verification log entries with valid data
- No overlapping dates between ground truth and third-party APIs
- All data sources are from the same origin

---

### MCT (Muscat Intl (MCT))

**No comparison data available.**

This could mean:
- No verification log entries with valid data
- No overlapping dates between ground truth and third-party APIs
- All data sources are from the same origin

---

### DOH (Hamad Intl (DOH))

- **Date range compared:** 2026-04-02 to 2026-04-11
- **Total days compared:** 10
- **Third-party APIs available:** OpenSky
- **Ground truth source:** Official airport website scraper

#### Best Third-Party API: AeroDataBox (Production)

- Average discrepancy: 77.0%
- Standard deviation: 9.2%
- Min discrepancy: 52.6%
- Max discrepancy: 84.8%
- Average signed error: -77.0%
- Direction: 9 undercount days, 0 overcount days, 0 exact
- Pattern: chronically undercounts

**Correction Factor:** Multiply AeroDataBox totals by **1.77**

#### OpenSky Detailed Analysis

- Days compared: 10
- Average discrepancy: 87.9%
- Standard deviation: 4.1%
- Average signed error: -87.9%
- Pattern: chronically undercounts (10 under, 0 over)
- **Correction factor for backfill:** Multiply OpenSky by 1.88

#### Production/AeroDataBox Detailed Analysis

- Days compared: 9
- Average discrepancy: 77.0%
- Standard deviation: 9.2%
- Average signed error: -77.0%
- Pattern: chronically undercounts (9 under, 0 over)
- **Correction factor for backfill:** Multiply AeroDataBox by 1.77

#### Daily Comparison Table

| Date | Ground Truth | Source | OpenSky | Δ% | Direction | Prod/Aero | Δ% | Direction |
|------|--------------|--------|---------|-----|-----------|-----------|-----|-----------|
| 2026-04-02 | 356 | dohahamadairport.com... | 58 | 83.7% | undercount | - | - | - |
| 2026-04-03 | 340 | dohahamadairport.com... | 63 | 81.5% | undercount | 161 | 52.6% | undercount |
| 2026-04-04 | 337 | dohahamadairport.com... | 37 | 89.0% | undercount | 60 | 82.2% | undercount |
| 2026-04-05 | 334 | dohahamadairport.com... | 13 | 96.1% | undercount | 58 | 82.6% | undercount |
| 2026-04-06 | 337 | dohahamadairport.com... | 52 | 84.6% | undercount | 57 | 83.1% | undercount |
| 2026-04-07 | 328 | dohahamadairport.com... | 37 | 88.7% | undercount | 50 | 84.8% | undercount |
| 2026-04-08 | 360 | dohahamadairport.com... | 36 | 90.0% | undercount | 74 | 79.4% | undercount |
| 2026-04-09 | 377 | dohahamadairport.com... | 56 | 85.1% | undercount | 83 | 78.0% | undercount |
| 2026-04-10 | 372 | dohahamadairport.com... | 29 | 92.2% | undercount | 88 | 76.3% | undercount |
| 2026-04-11 | 358 | dohahamadairport.com... | 44 | 87.7% | undercount | 92 | 74.3% | undercount |

---

### TLV (Ben Gurion Intl (TLV))

**No comparison data available.**

This could mean:
- No verification log entries with valid data
- No overlapping dates between ground truth and third-party APIs
- All data sources are from the same origin

---

### JED (Jeddah (JED))

- **Date range compared:** 2026-04-03 to 2026-04-12
- **Total days compared:** 10
- **Third-party APIs available:** None
- **Ground truth source:** Official airport website scraper

#### Best Third-Party API: AeroDataBox (Production)

- Average discrepancy: 39.1%
- Standard deviation: 1.9%
- Min discrepancy: 35.9%
- Max discrepancy: 42.7%
- Average signed error: -39.1%
- Direction: 10 undercount days, 0 overcount days, 0 exact
- Pattern: chronically undercounts

**Correction Factor:** Multiply AeroDataBox totals by **1.39**

#### Production/AeroDataBox Detailed Analysis

- Days compared: 10
- Average discrepancy: 39.1%
- Standard deviation: 1.9%
- Average signed error: -39.1%
- Pattern: chronically undercounts (10 under, 0 over)
- **Correction factor for backfill:** Multiply AeroDataBox by 1.39

#### Daily Comparison Table

| Date | Ground Truth | Source | OpenSky | Δ% | Direction | Prod/Aero | Δ% | Direction |
|------|--------------|--------|---------|-----|-----------|-----------|-----|-----------|
| 2026-04-03 | 1223 | kaia.sa... | - | - | - | 768 | 37.2% | undercount |
| 2026-04-04 | 1257 | kaia.sa... | - | - | - | 777 | 38.2% | undercount |
| 2026-04-05 | 1230 | kaia.sa... | - | - | - | 765 | 37.8% | undercount |
| 2026-04-06 | 1213 | kaia.sa... | - | - | - | 748 | 38.3% | undercount |
| 2026-04-07 | 1236 | kaia.sa... | - | - | - | 739 | 40.2% | undercount |
| 2026-04-08 | 1200 | kaia.sa... | - | - | - | 728 | 39.3% | undercount |
| 2026-04-09 | 1242 | kaia.sa... | - | - | - | 712 | 42.7% | undercount |
| 2026-04-10 | 1159 | kaia.sa... | - | - | - | 679 | 41.4% | undercount |
| 2026-04-11 | 1272 | kaia.sa... | - | - | - | 762 | 40.1% | undercount |
| 2026-04-12 | 1236 | kaia.sa... | - | - | - | 792 | 35.9% | undercount |

---

### RUH (Riyadh (RUH))

**No comparison data available.**

This could mean:
- No verification log entries with valid data
- No overlapping dates between ground truth and third-party APIs
- All data sources are from the same origin

---

## Recommendations for Pre-April Backfill

Before April 2026, only 3rd party API data was available (no official airport scraping). Based on the accuracy analysis above, here are the recommended data sources and correction factors:

| Airport | Recommended API | Correction Factor | Confidence | Coverage | Date Range |
|---------|-----------------|-------------------|------------|----------|------------|
| DXB | AeroDataBox | ÷ 1.06 | High | Good | 2026-04-03 to 2026-04-12 |
| AUH | AeroDataBox | × 1.52 | Medium | Limited | 2026-04-04 to 2026-04-12 |
| DWC | N/A | N/A | No data | - | - |
| MCT | N/A | N/A | No data | - | - |
| DOH | AeroDataBox | × 1.77 | Medium | Limited | 2026-04-03 to 2026-04-11 |
| TLV | N/A | N/A | No data | - | - |
| JED | AeroDataBox | × 1.39 | High | Good | 2026-04-03 to 2026-04-12 |
| RUH | N/A | N/A | No data | - | - |

### Backfill Strategy

#### Confidence Levels

- **High (10+ days):** Reliable correction factors, consistent patterns observed
- **Medium (5-9 days):** Usable correction factors, some variation expected
- **Low (<5 days):** Limited data, use with caution and manual review
- **No data:** Cannot make recommendations without comparison data

#### Correction Factor Application

When applying correction factors for pre-April backfill:

1. **Multiplicative corrections:** If an API undercounts by 15% on average, multiply its values by 1.15
2. **Divisive corrections:** If an API overcounts by 15% on average, divide its values by 1.15
3. **No correction:** If average signed error is within ±5%, use values directly
4. **High variance caution:** If standard deviation > 20%, consider the data unreliable

#### Data Quality Warnings

- **OpenSky:** Often shows severe undercounting during certain periods (e.g., 90%+ discrepancy in March 2026 for DXB)
- **AeroDataBox:** Generally more reliable but can still have significant discrepancies compared to official sources
- **Official scrapers:** Should be treated as ground truth when available

---

*Generated: 2026-04-12T10:24:30.884Z*
