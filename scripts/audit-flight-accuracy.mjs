#!/usr/bin/env node
/**
 * Flight Data Accuracy Audit Script
 * 
 * Compares production flight data (from official airport scrapers) against
 * 3rd party API data to identify discrepancies and recommend correction factors
 * for pre-April 2026 backfill.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const DOCS_DIR = join(ROOT_DIR, 'docs');

// Airport configurations
const AIRPORTS = {
  DXB: { name: 'Dubai International (DXB)', icao: 'OMDB', hasOpenSky: true, hasVerification: true },
  AUH: { name: 'Abu Dhabi Intl (AUH)', icao: 'OMAA', hasOpenSky: false, hasVerification: true },
  DWC: { name: 'Al Maktoum Intl (DWC)', icao: 'OMDW', hasOpenSky: false, hasVerification: true },
  MCT: { name: 'Muscat Intl (MCT)', icao: 'OOMS', hasOpenSky: true, hasVerification: true },
  DOH: { name: 'Hamad Intl (DOH)', icao: 'OTHH', hasOpenSky: true, hasVerification: true },
  TLV: { name: 'Ben Gurion Intl (TLV)', icao: 'LLBG', hasOpenSky: false, hasVerification: true },
  JED: { name: 'Jeddah (JED)', icao: 'JED', hasOpenSky: false, hasVerification: true },
  RUH: { name: 'Riyadh (RUH)', icao: 'RUH', hasOpenSky: false, hasVerification: true },
};

// Third-party API sources
const THIRD_PARTY_SOURCES = ['aerodatabox', 'opensky', 'flightradar24', 'aviationstack'];

// Official sources
const OFFICIAL_SOURCES = [
  'dubaiairports.ae',
  'zayedinternationalairport.ae',
  'dohahamadairport.com',
  'omanairports.co.om',
  'muscatairport.co.om',
  'official'
];

/**
 * Check if source is a third-party API
 */
function isThirdParty(source) {
  if (!source) return true; // unknown sources treated as third-party for safety
  const s = source.toLowerCase();
  return THIRD_PARTY_SOURCES.some(tp => s.includes(tp)) || s === 'unknown';
}

/**
 * Check if source is official
 */
function isOfficial(source) {
  if (!source) return false;
  const s = source.toLowerCase();
  return OFFICIAL_SOURCES.some(o => s.includes(o.toLowerCase()));
}

/**
 * Load JSON file if it exists
 */
function loadJson(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Parse date string to Date object for comparison
 */
function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00.000Z');
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate discrepancy percentage
 */
function calculateDiscrepancy(prodTotal, apiTotal) {
  if (prodTotal === 0) return apiTotal === 0 ? 0 : 100;
  return Math.abs(prodTotal - apiTotal) / prodTotal * 100;
}

/**
 * Get direction of discrepancy
 */
function getDirection(prodTotal, apiTotal) {
  if (apiTotal < prodTotal) return 'undercount';
  if (apiTotal > prodTotal) return 'overcount';
  return 'exact';
}

/**
 * Format number with 1 decimal place
 */
function fmt(num) {
  return num.toFixed(1);
}

/**
 * Format number with 2 decimal places
 */
function fmt2(num) {
  return num.toFixed(2);
}

/**
 * Load all data for an airport
 */
function loadAirportData(iata) {
  const prodFile = join(PUBLIC_DIR, `data-flights-${iata.toLowerCase()}.json`);
  const openSkyFile = join(PUBLIC_DIR, `data-flights-${iata.toLowerCase()}-opensky.json`);
  const verificationFile = join(PUBLIC_DIR, 'verification', `flight-log-${iata}.json`);
  
  const prod = loadJson(prodFile);
  const openSky = loadJson(openSkyFile);
  const verification = loadJson(verificationFile);
  
  return { prod, openSky, verification };
}

/**
 * Build daily comparison data for an airport
 * Focus: Compare official sources (verification logs + official prod entries) with 3rd party APIs
 */
function buildDailyComparison(iata, data) {
  const { prod, openSky, verification } = data;
  const comparisons = [];
  
  // Create maps for easier lookup
  const prodMap = new Map();
  if (prod && prod.daily) {
    for (const day of prod.daily) {
      prodMap.set(day.date, day);
    }
  }
  
  const openSkyMap = new Map();
  if (openSky && openSky.daily) {
    for (const day of openSky.daily) {
      openSkyMap.set(day.date, day);
    }
  }
  
  const verificationMap = new Map();
  if (verification && verification.entries) {
    for (const entry of verification.entries) {
      if (entry.total !== undefined && !entry.error && entry.success !== false) {
        verificationMap.set(entry.date, entry);
      }
    }
  }
  
  // Find all dates where we have verification data (official ground truth)
  // and at least one third-party source for comparison
  for (const [date, verDay] of verificationMap) {
    // Use verification log as ground truth
    const groundTruth = {
      date,
      departures: verDay.departures,
      arrivals: verDay.arrivals,
      total: verDay.total,
      source: verDay.source || 'official-scraper'
    };
    
    const dateComparisons = {
      date,
      groundTruth,
      sources: {}
    };
    
    let hasThirdPartyData = false;
    
    // Compare with production data (may be from 3rd party API)
    if (prodMap.has(date)) {
      const prodDay = prodMap.get(date);
      const prodSource = prodDay.source || 'unknown';
      
      // Only include production data if it's from a third-party source
      if (isThirdParty(prodSource)) {
        dateComparisons.sources.production = {
          departures: prodDay.departures,
          arrivals: prodDay.arrivals,
          total: prodDay.total,
          source: prodSource,
          discrepancy: calculateDiscrepancy(groundTruth.total, prodDay.total),
          direction: getDirection(groundTruth.total, prodDay.total)
        };
        hasThirdPartyData = true;
      }
    }
    
    // Compare with OpenSky
    if (openSkyMap.has(date)) {
      const openSkyDay = openSkyMap.get(date);
      if (openSkyDay.total > 0) {
        dateComparisons.sources.openSky = {
          departures: openSkyDay.departures,
          arrivals: openSkyDay.arrivals,
          total: openSkyDay.total,
          source: 'opensky',
          discrepancy: calculateDiscrepancy(groundTruth.total, openSkyDay.total),
          direction: getDirection(groundTruth.total, openSkyDay.total)
        };
        hasThirdPartyData = true;
      }
    }
    
    if (hasThirdPartyData) {
      comparisons.push(dateComparisons);
    }
  }
  
  // Also check for dates with production official data vs OpenSky
  // (where we can use production official as ground truth)
  if (prod && prod.daily) {
    for (const day of prod.daily) {
      const prodSource = day.source || 'unknown';
      
      // Only use official production data as ground truth
      if (isOfficial(prodSource) && !verificationMap.has(day.date)) {
        const groundTruth = {
          date: day.date,
          departures: day.departures,
          arrivals: day.arrivals,
          total: day.total,
          source: prodSource
        };
        
        const dateComparisons = {
          date: day.date,
          groundTruth,
          sources: {}
        };
        
        let hasThirdPartyData = false;
        
        // Compare with OpenSky
        if (openSkyMap.has(day.date)) {
          const openSkyDay = openSkyMap.get(day.date);
          if (openSkyDay.total > 0) {
            dateComparisons.sources.openSky = {
              departures: openSkyDay.departures,
              arrivals: openSkyDay.arrivals,
              total: openSkyDay.total,
              source: 'opensky',
              discrepancy: calculateDiscrepancy(groundTruth.total, openSkyDay.total),
              direction: getDirection(groundTruth.total, openSkyDay.total)
            };
            hasThirdPartyData = true;
          }
        }
        
        if (hasThirdPartyData) {
          // Check if we already have this date from verification
          const existingIndex = comparisons.findIndex(c => c.date === day.date);
          if (existingIndex === -1) {
            comparisons.push(dateComparisons);
          }
        }
      }
    }
  }
  
  // Sort by date
  comparisons.sort((a, b) => parseDate(a.date) - parseDate(b.date));
  
  return comparisons;
}

/**
 * Calculate statistics for an airport
 */
function calculateStats(comparisons) {
  const stats = {
    production: { discrepancies: [], count: 0, totalDiscrepancy: 0, signedErrors: [] },
    openSky: { discrepancies: [], count: 0, totalDiscrepancy: 0, signedErrors: [] }
  };
  
  for (const day of comparisons) {
    for (const [source, data] of Object.entries(day.sources)) {
      if (stats[source]) {
        stats[source].discrepancies.push(data.discrepancy);
        stats[source].count++;
        stats[source].totalDiscrepancy += data.discrepancy;
        
        // Calculate signed error (not absolute)
        if (day.groundTruth.total > 0) {
          const signedError = (data.total - day.groundTruth.total) / day.groundTruth.total;
          stats[source].signedErrors.push(signedError);
        }
      }
    }
  }
  
  // Calculate averages and find best source
  let bestSource = null;
  let bestAvgDiscrepancy = Infinity;
  
  for (const [source, data] of Object.entries(stats)) {
    if (data.count > 0) {
      data.avgDiscrepancy = data.totalDiscrepancy / data.count;
      data.minDiscrepancy = Math.min(...data.discrepancies);
      data.maxDiscrepancy = Math.max(...data.discrepancies);
      data.stdDev = Math.sqrt(
        data.discrepancies.reduce((sum, d) => sum + Math.pow(d - data.avgDiscrepancy, 2), 0) / data.count
      );
      
      // Calculate systematic bias
      const directions = { undercount: 0, overcount: 0, exact: 0 };
      for (const day of comparisons) {
        if (day.sources[source]) {
          directions[day.sources[source].direction]++;
        }
      }
      data.directions = directions;
      
      // Calculate average signed error
      if (data.signedErrors.length > 0) {
        data.avgSignedError = data.signedErrors.reduce((a, b) => a + b, 0) / data.signedErrors.length;
      } else {
        data.avgSignedError = 0;
      }
      
      if (data.avgSignedError < -0.05) {
        data.bias = 'chronically undercounts';
        data.biasFactor = -1;
      } else if (data.avgSignedError > 0.05) {
        data.bias = 'chronically overcounts';
        data.biasFactor = 1;
      } else {
        data.bias = 'balanced';
        data.biasFactor = 0;
      }
      
      if (data.avgDiscrepancy < bestAvgDiscrepancy) {
        bestAvgDiscrepancy = data.avgDiscrepancy;
        bestSource = source;
      }
    }
  }
  
  return { stats, bestSource, bestAvgDiscrepancy };
}

/**
 * Get date range from comparisons
 */
function getDateRange(comparisons) {
  if (comparisons.length === 0) return null;
  const dates = comparisons.map(c => parseDate(c.date));
  return {
    start: formatDate(new Date(Math.min(...dates))),
    end: formatDate(new Date(Math.max(...dates)))
  };
}

/**
 * Generate markdown report
 */
function generateReport(allResults) {
  const today = formatDate(new Date());
  
  let md = `# Flight Data Accuracy Audit (${today})

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
`;

  // Summary table
  const summaryRows = [];
  for (const [iata, result] of Object.entries(allResults)) {
    if (!result.comparisons || result.comparisons.length === 0) continue;
    
    const { stats, bestSource, bestAvgDiscrepancy } = result.stats;
    const sourceName = bestSource === 'production' ? 'AeroDataBox/Prod' : 
                       bestSource === 'openSky' ? 'OpenSky' : 'N/A';
    const bias = bestSource && stats[bestSource] ? stats[bestSource].bias : 'N/A';
    const dataPoints = bestSource && stats[bestSource] ? stats[bestSource].count : 0;
    
    let recommendation;
    if (bestSource === 'production') {
      const s = stats.production;
      if (s.biasFactor !== 0 && Math.abs(s.avgSignedError) > 0.01 && isFinite(s.avgSignedError)) {
        const factor = 1 + Math.abs(s.avgSignedError);
        recommendation = s.biasFactor < 0 
          ? `Use with ×${fmt2(factor)} correction`
          : `Use with ÷${fmt2(factor)} correction`;
      } else {
        recommendation = 'Use directly';
      }
    } else if (bestSource === 'openSky') {
      const s = stats.openSky;
      if (s.biasFactor !== 0 && Math.abs(s.avgSignedError) > 0.01 && isFinite(s.avgSignedError)) {
        const factor = 1 + Math.abs(s.avgSignedError);
        recommendation = s.biasFactor < 0 
          ? `Use with ×${fmt2(factor)} correction`
          : `Use with ÷${fmt2(factor)} correction`;
      } else {
        recommendation = 'Use directly';
      }
    } else {
      recommendation = 'Insufficient data';
    }
    
    summaryRows.push(`| ${iata} (${AIRPORTS[iata].name}) | ${sourceName} | ${bestAvgDiscrepancy === Infinity ? 'N/A' : fmt(bestAvgDiscrepancy) + '%'} | ${bias} | ${dataPoints} | ${recommendation} |`);
  }
  md += summaryRows.join('\n') + '\n\n';

  // Overall accuracy ranking
  md += `### Overall API Accuracy Ranking

| Rank | API Source | Avg Discrepancy | Airports Covered | Data Points |
|------|------------|-----------------|------------------|-------------|
`;

  // Collect all source stats
  const sourceStats = {};
  for (const [iata, result] of Object.entries(allResults)) {
    if (!result.stats) continue;
    for (const [source, stats] of Object.entries(result.stats.stats)) {
      if (stats.count > 0) {
        if (!sourceStats[source]) {
          sourceStats[source] = { totalDiscrepancy: 0, totalCount: 0, airports: [] };
        }
        sourceStats[source].totalDiscrepancy += stats.totalDiscrepancy;
        sourceStats[source].totalCount += stats.count;
        sourceStats[source].airports.push(iata);
      }
    }
  }
  
  const rankedSources = Object.entries(sourceStats)
    .map(([source, data]) => ({
      source,
      avgDiscrepancy: data.totalDiscrepancy / data.totalCount,
      airports: [...new Set(data.airports)],
      totalCount: data.totalCount
    }))
    .sort((a, b) => a.avgDiscrepancy - b.avgDiscrepancy);
  
  const sourceNames = { production: 'AeroDataBox (Production)', openSky: 'OpenSky' };
  rankedSources.forEach((s, i) => {
    md += `| ${i + 1} | ${sourceNames[s.source] || s.source} | ${fmt(s.avgDiscrepancy)}% | ${s.airports.join(', ')} | ${s.totalCount} |\n`;
  });
  
  md += `\n---\n\n## Per-Airport Analysis\n\n`;

  // Per-airport sections
  for (const [iata, result] of Object.entries(allResults)) {
    const airport = AIRPORTS[iata];
    const comparisons = result.comparisons || [];
    const dateRange = getDateRange(comparisons);
    
    md += `### ${iata} (${airport.name})\n\n`;
    
    if (comparisons.length === 0) {
      md += `**No comparison data available.**\n\n`;
      md += `This could mean:\n`;
      md += `- No verification log entries with valid data\n`;
      md += `- No overlapping dates between ground truth and third-party APIs\n`;
      md += `- All data sources are from the same origin\n\n`;
      md += `---\n\n`;
      continue;
    }
    
    md += `- **Date range compared:** ${dateRange.start} to ${dateRange.end}\n`;
    md += `- **Total days compared:** ${comparisons.length}\n`;
    
    const availableApis = [];
    if (result.data.openSky) availableApis.push('OpenSky');
    md += `- **Third-party APIs available:** ${availableApis.join(', ') || 'None'}\n`;
    md += `- **Ground truth source:** Official airport website scraper\n\n`;
    
    // Stats
    const { stats, bestSource } = result.stats;
    
    if (bestSource && stats[bestSource]) {
      const bs = stats[bestSource];
      md += `#### Best Third-Party API: ${bestSource === 'production' ? 'AeroDataBox (Production)' : 'OpenSky'}\n\n`;
      md += `- Average discrepancy: ${fmt(bs.avgDiscrepancy)}%\n`;
      md += `- Standard deviation: ${fmt(bs.stdDev)}%\n`;
      md += `- Min discrepancy: ${fmt(bs.minDiscrepancy)}%\n`;
      md += `- Max discrepancy: ${fmt(bs.maxDiscrepancy)}%\n`;
      md += `- Average signed error: ${isFinite(bs.avgSignedError) ? (bs.avgSignedError * 100).toFixed(1) : 'N/A'}%\n`;
      md += `- Direction: ${bs.directions.undercount} undercount days, ${bs.directions.overcount} overcount days, ${bs.directions.exact} exact\n`;
      md += `- Pattern: ${bs.bias}\n\n`;
      
      // Calculate correction factor
      if (Math.abs(bs.avgSignedError) > 0.01 && isFinite(bs.avgSignedError)) {
        const correctionFactor = 1 + Math.abs(bs.avgSignedError);
        if (bs.avgSignedError < 0) {
          md += `**Correction Factor:** Multiply ${bestSource === 'production' ? 'AeroDataBox' : 'OpenSky'} totals by **${fmt2(correctionFactor)}**\n\n`;
        } else {
          md += `**Correction Factor:** Divide ${bestSource === 'production' ? 'AeroDataBox' : 'OpenSky'} totals by **${fmt2(correctionFactor)}**\n\n`;
        }
      }
    }
    
    // OpenSky specific stats
    if (stats.openSky.count > 0) {
      const os = stats.openSky;
      md += `#### OpenSky Detailed Analysis\n\n`;
      md += `- Days compared: ${os.count}\n`;
      md += `- Average discrepancy: ${fmt(os.avgDiscrepancy)}%\n`;
      md += `- Standard deviation: ${fmt(os.stdDev)}%\n`;
      md += `- Average signed error: ${isFinite(os.avgSignedError) ? (os.avgSignedError * 100).toFixed(1) : 'N/A'}%\n`;
      md += `- Pattern: ${os.bias} (${os.directions.undercount} under, ${os.directions.overcount} over)\n`;
      
      // Calculate correction factor
      if (Math.abs(os.avgSignedError) > 0.01 && isFinite(os.avgSignedError)) {
        const correctionFactor = 1 + Math.abs(os.avgSignedError);
        if (os.avgSignedError < 0) {
          md += `- **Correction factor for backfill:** Multiply OpenSky by ${fmt2(correctionFactor)}\n`;
        } else {
          md += `- **Correction factor for backfill:** Divide OpenSky by ${fmt2(correctionFactor)}\n`;
        }
      }
      md += '\n';
    }
    
    // Production/AeroDataBox specific stats
    if (stats.production.count > 0) {
      const prod = stats.production;
      md += `#### Production/AeroDataBox Detailed Analysis\n\n`;
      md += `- Days compared: ${prod.count}\n`;
      md += `- Average discrepancy: ${fmt(prod.avgDiscrepancy)}%\n`;
      md += `- Standard deviation: ${fmt(prod.stdDev)}%\n`;
      md += `- Average signed error: ${isFinite(prod.avgSignedError) ? (prod.avgSignedError * 100).toFixed(1) : 'N/A'}%\n`;
      md += `- Pattern: ${prod.bias} (${prod.directions.undercount} under, ${prod.directions.overcount} over)\n`;
      
      if (Math.abs(prod.avgSignedError) > 0.01 && isFinite(prod.avgSignedError)) {
        const correctionFactor = 1 + Math.abs(prod.avgSignedError);
        if (prod.avgSignedError < 0) {
          md += `- **Correction factor for backfill:** Multiply AeroDataBox by ${fmt2(correctionFactor)}\n`;
        } else {
          md += `- **Correction factor for backfill:** Divide AeroDataBox by ${fmt2(correctionFactor)}\n`;
        }
      }
      md += '\n';
    }
    
    // Daily comparison table
    md += `#### Daily Comparison Table\n\n`;
    md += `| Date | Ground Truth | Source | OpenSky | Δ% | Direction | Prod/Aero | Δ% | Direction |\n`;
    md += `|------|--------------|--------|---------|-----|-----------|-----------|-----|-----------|\n`;
    
    for (const day of comparisons) {
      const openSkyCol = day.sources.openSky 
        ? `${day.sources.openSky.total}`
        : '-';
      const openSkyDelta = day.sources.openSky ? fmt(day.sources.openSky.discrepancy) + '%' : '-';
      const openSkyDir = day.sources.openSky ? day.sources.openSky.direction : '-';
      
      const prodCol = day.sources.production 
        ? `${day.sources.production.total}`
        : '-';
      const prodDelta = day.sources.production ? fmt(day.sources.production.discrepancy) + '%' : '-';
      const prodDir = day.sources.production ? day.sources.production.direction : '-';
      
      md += `| ${day.date} | ${day.groundTruth.total} | ${day.groundTruth.source.substring(0, 20)}... | ${openSkyCol} | ${openSkyDelta} | ${openSkyDir} | ${prodCol} | ${prodDelta} | ${prodDir} |\n`;
    }
    
    md += '\n---\n\n';
  }

  // Pre-April backfill recommendations
  md += `## Recommendations for Pre-April Backfill\n\n`;
  md += `Before April 2026, only 3rd party API data was available (no official airport scraping). `;
  md += `Based on the accuracy analysis above, here are the recommended data sources and correction factors:\n\n`;
  
  md += `| Airport | Recommended API | Correction Factor | Confidence | Coverage | Date Range |\n`;
  md += `|---------|-----------------|-------------------|------------|----------|------------|\n`;
  
  for (const [iata, result] of Object.entries(allResults)) {
    const comparisons = result.comparisons || [];
    if (comparisons.length === 0) {
      md += `| ${iata} | N/A | N/A | No data | - | - |\n`;
      continue;
    }
    
    const { stats, bestSource } = result.stats;
    let recommendedApi = 'N/A';
    let correctionFactor = 'None';
    let confidence = 'Low';
    let coverage = 'None';
    let dateRange = 'N/A';
    
    if (bestSource && stats[bestSource]) {
      const s = stats[bestSource];
      recommendedApi = bestSource === 'production' ? 'AeroDataBox' : 'OpenSky';
      
      if (Math.abs(s.avgSignedError) > 0.01 && isFinite(s.avgSignedError)) {
        const factor = 1 + Math.abs(s.avgSignedError);
        correctionFactor = s.avgSignedError < 0 ? `× ${fmt2(factor)}` : `÷ ${fmt2(factor)}`;
      } else {
        correctionFactor = 'None needed';
      }
      
      confidence = s.count >= 10 ? 'High' : s.count >= 5 ? 'Medium' : 'Low';
      coverage = s.count >= 10 ? 'Good' : s.count >= 5 ? 'Limited' : 'Minimal';
      
      // Get date range
      const dates = comparisons
        .filter(c => c.sources[bestSource])
        .map(c => parseDate(c.date));
      if (dates.length > 0) {
        dateRange = `${formatDate(new Date(Math.min(...dates)))} to ${formatDate(new Date(Math.max(...dates)))}`;
      }
    }
    
    md += `| ${iata} | ${recommendedApi} | ${correctionFactor} | ${confidence} | ${coverage} | ${dateRange} |\n`;
  }
  
  md += `\n### Backfill Strategy\n\n`;
  md += `#### Confidence Levels\n\n`;
  md += `- **High (10+ days):** Reliable correction factors, consistent patterns observed\n`;
  md += `- **Medium (5-9 days):** Usable correction factors, some variation expected\n`;
  md += `- **Low (<5 days):** Limited data, use with caution and manual review\n`;
  md += `- **No data:** Cannot make recommendations without comparison data\n\n`;
  
  md += `#### Correction Factor Application\n\n`;
  md += `When applying correction factors for pre-April backfill:\n\n`;
  md += `1. **Multiplicative corrections:** If an API undercounts by 15% on average, multiply its values by 1.15\n`;
  md += `2. **Divisive corrections:** If an API overcounts by 15% on average, divide its values by 1.15\n`;
  md += `3. **No correction:** If average signed error is within ±5%, use values directly\n`;
  md += `4. **High variance caution:** If standard deviation > 20%, consider the data unreliable\n\n`;
  
  md += `#### Data Quality Warnings\n\n`;
  md += `- **OpenSky:** Often shows severe undercounting during certain periods (e.g., 90%+ discrepancy in March 2026 for DXB)\n`;
  md += `- **AeroDataBox:** Generally more reliable but can still have significant discrepancies compared to official sources\n`;
  md += `- **Official scrapers:** Should be treated as ground truth when available\n\n`;
  
  md += `---\n\n*Generated: ${new Date().toISOString()}*\n`;
  
  return md;
}

/**
 * Main execution
 */
function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Flight Data Accuracy Audit                               ║');
  console.log('║     Comparing 3rd Party APIs against Official Sources        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const allResults = {};
  
  for (const [iata, config] of Object.entries(AIRPORTS)) {
    console.log(`📊 Processing ${iata} (${config.name})...`);
    
    const data = loadAirportData(iata);
    const comparisons = buildDailyComparison(iata, data);
    const stats = comparisons.length > 0 ? calculateStats(comparisons) : { stats: {}, bestSource: null, bestAvgDiscrepancy: Infinity };
    
    allResults[iata] = {
      config,
      data,
      comparisons,
      stats
    };
    
    console.log(`   Production data days: ${data.prod?.daily?.length || 0}`);
    console.log(`   OpenSky data days: ${data.openSky?.daily?.length || 0}`);
    console.log(`   Verification entries: ${data.verification?.entries?.length || 0}`);
    console.log(`   Comparable days with ground truth: ${comparisons.length}`);
    
    if (stats.bestSource) {
      const s = stats.stats[stats.bestSource];
      console.log(`   ✅ Best API: ${stats.bestSource} (${fmt(stats.bestAvgDiscrepancy)}% avg discrepancy, ${s.count} days)`);
    } else {
      console.log(`   ⚠️  No comparison data available`);
    }
    console.log('');
  }
  
  // Generate report
  const report = generateReport(allResults);
  const reportPath = join(DOCS_DIR, 'flight-data-accuracy-audit.md');
  writeFileSync(reportPath, report, 'utf-8');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Report written to: ${reportPath}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main();
