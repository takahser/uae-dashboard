#!/usr/bin/env node
/**
 * Generate Airport Discrepancy Diagrams
 * 
 * Creates SVG diagrams comparing prod data vs OpenSky vs AeroDataBox
 * for each airport with production data.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const DOCS_DIR = join(ROOT_DIR, 'docs');

// Airport configurations - 4 airports with prod data
const AIRPORTS = {
  DXB: { name: 'Dubai International (DXB)', icao: 'OMDB', hasOpenSky: true },
  AUH: { name: 'Abu Dhabi Intl (AUH)', icao: 'OMAA', hasOpenSky: false },
  DOH: { name: 'Hamad Intl (DOH)', icao: 'OTHH', hasOpenSky: true },
  JED: { name: 'Jeddah (JED)', icao: 'JED', hasOpenSky: false },
};

function loadJson(filepath) {
  try {
    const content = readFileSync(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function calculateDiscrepancy(groundTruth, apiValue) {
  if (groundTruth === 0) return apiValue === 0 ? 0 : 100;
  return Math.abs(apiValue - groundTruth) / groundTruth * 100;
}

function getDirection(groundTruth, apiValue) {
  if (apiValue < groundTruth) return 'undercount';
  if (apiValue > groundTruth) return 'overcount';
  return 'exact';
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
 * Build comparison data for each date
 */
function buildComparisonData(iata, data) {
  const { prod, openSky, verification } = data;
  const comparisons = [];
  
  // Create maps
  const prodMap = new Map();
  if (prod?.daily) {
    for (const day of prod.daily) {
      prodMap.set(day.date, day);
    }
  }
  
  const openSkyMap = new Map();
  if (openSky?.daily) {
    for (const day of openSky.daily) {
      openSkyMap.set(day.date, day);
    }
  }
  
  // Use verification data as ground truth
  if (verification?.entries) {
    for (const entry of verification.entries) {
      if (entry.total !== undefined && !entry.error) {
        const date = entry.date;
        const groundTruth = entry.total;
        
        const dayData = {
          date,
          groundTruth,
          prod: null,
          openSky: null
        };
        
        // Get production data (AeroDataBox) for this date
        if (prodMap.has(date)) {
          const prodDay = prodMap.get(date);
          dayData.prod = {
            value: prodDay.total,
            discrepancy: calculateDiscrepancy(groundTruth, prodDay.total),
            direction: getDirection(groundTruth, prodDay.total)
          };
        }
        
        // Get OpenSky data for this date
        if (openSkyMap.has(date)) {
          const openSkyDay = openSkyMap.get(date);
          if (openSkyDay.total > 0) {
            dayData.openSky = {
              value: openSkyDay.total,
              discrepancy: calculateDiscrepancy(groundTruth, openSkyDay.total),
              direction: getDirection(groundTruth, openSkyDay.total)
            };
          }
        }
        
        comparisons.push(dayData);
      }
    }
  }
  
  // Sort by date
  comparisons.sort((a, b) => new Date(a.date) - new Date(b.date));
  return comparisons;
}

/**
 * Calculate max discrepancies for over/under counting
 */
function calculateMaxDiscrepancies(comparisons) {
  const result = {
    prod: { maxOver: 0, maxUnder: 0, overDate: null, underDate: null },
    openSky: { maxOver: 0, maxUnder: 0, overDate: null, underDate: null }
  };
  
  for (const day of comparisons) {
    if (day.prod) {
      if (day.prod.direction === 'overcount' && day.prod.discrepancy > result.prod.maxOver) {
        result.prod.maxOver = day.prod.discrepancy;
        result.prod.overDate = day.date;
      }
      if (day.prod.direction === 'undercount' && day.prod.discrepancy > result.prod.maxUnder) {
        result.prod.maxUnder = day.prod.discrepancy;
        result.prod.underDate = day.date;
      }
    }
    
    if (day.openSky) {
      if (day.openSky.direction === 'overcount' && day.openSky.discrepancy > result.openSky.maxOver) {
        result.openSky.maxOver = day.openSky.discrepancy;
        result.openSky.overDate = day.date;
      }
      if (day.openSky.direction === 'undercount' && day.openSky.discrepancy > result.openSky.maxUnder) {
        result.openSky.maxUnder = day.openSky.discrepancy;
        result.openSky.underDate = day.date;
      }
    }
  }
  
  return result;
}

/**
 * Generate SVG diagram for an airport
 */
function generateSVGBarChart(iata, comparisons, airportName) {
  if (comparisons.length === 0) return null;
  
  const width = 800;
  const height = 400;
  const margin = { top: 60, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Find max value for scaling
  let maxValue = 0;
  for (const day of comparisons) {
    maxValue = Math.max(maxValue, day.groundTruth);
    if (day.prod) maxValue = Math.max(maxValue, day.prod.value);
    if (day.openSky) maxValue = Math.max(maxValue, day.openSky.value);
  }
  maxValue = Math.ceil(maxValue / 100) * 100; // Round up to nearest 100
  
  const numDays = comparisons.length;
  const groupWidth = chartWidth / numDays;
  const barWidth = groupWidth * 0.25;
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${width}" height="${height}" fill="#fafafa"/>`;
  
  // Title
  svg += `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${airportName} - Daily Flight Counts</text>`;
  
  // Y-axis
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#333" stroke-width="1"/>`;
  
  // Y-axis labels and grid
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const value = Math.round((maxValue / ySteps) * i);
    const y = height - margin.bottom - (chartHeight / ySteps) * i;
    svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${value}</text>`;
    if (i > 0) {
      svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#ddd" stroke-width="1"/>`;
    }
  }
  
  // X-axis
  svg += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#333" stroke-width="1"/>`;
  
  // Bars
  comparisons.forEach((day, i) => {
    const x = margin.left + i * groupWidth + groupWidth * 0.1;
    
    // Ground Truth bar (green)
    const gtHeight = (day.groundTruth / maxValue) * chartHeight;
    const gtY = height - margin.bottom - gtHeight;
    svg += `<rect x="${x}" y="${gtY}" width="${barWidth}" height="${gtHeight}" fill="#22c55e" opacity="0.9"/>`;
    
    // Prod/AeroDataBox bar (blue)
    if (day.prod) {
      const prodHeight = (day.prod.value / maxValue) * chartHeight;
      const prodY = height - margin.bottom - prodHeight;
      svg += `<rect x="${x + barWidth}" y="${prodY}" width="${barWidth}" height="${prodHeight}" fill="#3b82f6" opacity="0.9"/>`;
    }
    
    // OpenSky bar (orange)
    if (day.openSky) {
      const osHeight = (day.openSky.value / maxValue) * chartHeight;
      const osY = height - margin.bottom - osHeight;
      svg += `<rect x="${x + barWidth * 2}" y="${osY}" width="${barWidth}" height="${osHeight}" fill="#f97316" opacity="0.9"/>`;
    }
    
    // X-axis label (date)
    const labelX = x + barWidth * 1.5;
    const shortDate = day.date.substring(5); // MM-DD
    svg += `<text x="${labelX}" y="${height - margin.bottom + 20}" text-anchor="middle" font-size="10" fill="#666" transform="rotate(-45, ${labelX}, ${height - margin.bottom + 20})">${shortDate}</text>`;
  });
  
  // Legend
  const legendY = 50;
  svg += `<rect x="${width - 200}" y="${legendY}" width="12" height="12" fill="#22c55e"/>`;
  svg += `<text x="${width - 185}" y="${legendY + 10}" font-size="11" fill="#333">Ground Truth (Official)</text>`;
  svg += `<rect x="${width - 200}" y="${legendY + 18}" width="12" height="12" fill="#3b82f6"/>`;
  svg += `<text x="${width - 185}" y="${legendY + 28}" font-size="11" fill="#333">AeroDataBox</text>`;
  svg += `<rect x="${width - 200}" y="${legendY + 36}" width="12" height="12" fill="#f97316"/>`;
  svg += `<text x="${width - 185}" y="${legendY + 46}" font-size="11" fill="#333">OpenSky</text>`;
  
  svg += `</svg>`;
  return svg;
}

/**
 * Generate discrepancy chart SVG
 */
function generateDiscrepancyChart(iata, comparisons, airportName) {
  if (comparisons.length === 0) return null;
  
  const width = 800;
  const height = 350;
  const margin = { top: 60, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Find max discrepancy for scaling
  let maxDisc = 0;
  for (const day of comparisons) {
    if (day.prod) maxDisc = Math.max(maxDisc, day.prod.discrepancy);
    if (day.openSky) maxDisc = Math.max(maxDisc, day.openSky.discrepancy);
  }
  maxDisc = Math.ceil(maxDisc / 10) * 10; // Round up to nearest 10
  
  const numDays = comparisons.length;
  const groupWidth = chartWidth / numDays;
  const barWidth = groupWidth * 0.35;
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${width}" height="${height}" fill="#fafafa"/>`;
  
  // Title
  svg += `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${airportName} - Discrepancy % vs Ground Truth</text>`;
  
  // Y-axis
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#333" stroke-width="1"/>`;
  
  // Y-axis labels and grid
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const value = Math.round((maxDisc / ySteps) * i);
    const y = height - margin.bottom - (chartHeight / ySteps) * i;
    svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${value}%</text>`;
    if (i > 0) {
      svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#ddd" stroke-width="1"/>`;
    }
  }
  
  // X-axis
  svg += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#333" stroke-width="1"/>`;
  
  // Bars
  comparisons.forEach((day, i) => {
    const x = margin.left + i * groupWidth + groupWidth * 0.15;
    
    // Prod/AeroDataBox discrepancy (blue)
    if (day.prod) {
      const prodHeight = (day.prod.discrepancy / maxDisc) * chartHeight;
      const prodY = height - margin.bottom - prodHeight;
      const color = day.prod.direction === 'overcount' ? '#3b82f6' : '#60a5fa';
      svg += `<rect x="${x}" y="${prodY}" width="${barWidth}" height="${prodHeight}" fill="${color}" opacity="0.9"/>`;
    }
    
    // OpenSky discrepancy (orange)
    if (day.openSky) {
      const osHeight = (day.openSky.discrepancy / maxDisc) * chartHeight;
      const osY = height - margin.bottom - osHeight;
      const color = day.openSky.direction === 'overcount' ? '#f97316' : '#fb923c';
      svg += `<rect x="${x + barWidth}" y="${osY}" width="${barWidth}" height="${osHeight}" fill="${color}" opacity="0.9"/>`;
    }
    
    // X-axis label (date)
    const labelX = x + barWidth;
    const shortDate = day.date.substring(5);
    svg += `<text x="${labelX}" y="${height - margin.bottom + 20}" text-anchor="middle" font-size="10" fill="#666" transform="rotate(-45, ${labelX}, ${height - margin.bottom + 20})">${shortDate}</text>`;
  });
  
  // Legend
  const legendY = 50;
  svg += `<rect x="${width - 180}" y="${legendY}" width="12" height="12" fill="#3b82f6"/>`;
  svg += `<text x="${width - 165}" y="${legendY + 10}" font-size="11" fill="#333">AeroDataBox</text>`;
  svg += `<rect x="${width - 180}" y="${legendY + 18}" width="12" height="12" fill="#f97316"/>`;
  svg += `<text x="${width - 165}" y="${legendY + 28}" font-size="11" fill="#333">OpenSky</text>`;
  
  svg += `</svg>`;
  return svg;
}

/**
 * Generate line chart showing trends
 */
function generateTrendChart(iata, comparisons, airportName) {
  if (comparisons.length === 0) return null;
  
  const width = 800;
  const height = 350;
  const margin = { top: 60, right: 40, bottom: 80, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Find max value for scaling
  let maxValue = 0;
  for (const day of comparisons) {
    maxValue = Math.max(maxValue, day.groundTruth);
    if (day.prod) maxValue = Math.max(maxValue, day.prod.value);
    if (day.openSky) maxValue = Math.max(maxValue, day.openSky.value);
  }
  maxValue = Math.ceil(maxValue / 100) * 100;
  
  const numDays = comparisons.length;
  const xStep = chartWidth / (numDays - 1 || 1);
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Background
  svg += `<rect width="${width}" height="${height}" fill="#fafafa"/>`;
  
  // Title
  svg += `<text x="${width/2}" y="30" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${airportName} - Flight Count Trends</text>`;
  
  // Grid lines
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const value = Math.round((maxValue / ySteps) * i);
    const y = height - margin.bottom - (chartHeight / ySteps) * i;
    svg += `<text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${value}</text>`;
    if (i > 0) {
      svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
    }
  }
  
  // Axes
  svg += `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#333" stroke-width="1"/>`;
  svg += `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#333" stroke-width="1"/>`;
  
  // Build path points
  const gtPoints = [];
  const prodPoints = [];
  const osPoints = [];
  
  comparisons.forEach((day, i) => {
    const x = margin.left + i * xStep;
    const gtY = height - margin.bottom - (day.groundTruth / maxValue) * chartHeight;
    gtPoints.push(`${x},${gtY}`);
    
    if (day.prod) {
      const prodY = height - margin.bottom - (day.prod.value / maxValue) * chartHeight;
      prodPoints.push(`${x},${prodY}`);
    }
    
    if (day.openSky) {
      const osY = height - margin.bottom - (day.openSky.value / maxValue) * chartHeight;
      osPoints.push(`${x},${osY}`);
    }
    
    // X-axis labels
    const shortDate = day.date.substring(5);
    svg += `<text x="${x}" y="${height - margin.bottom + 20}" text-anchor="middle" font-size="10" fill="#666" transform="rotate(-45, ${x}, ${height - margin.bottom + 20})">${shortDate}</text>`;
  });
  
  // Draw lines
  if (gtPoints.length > 1) {
    svg += `<polyline points="${gtPoints.join(' ')}" fill="none" stroke="#22c55e" stroke-width="2.5"/>`;
  }
  if (prodPoints.length > 1) {
    svg += `<polyline points="${prodPoints.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="5,3"/>`;
  }
  if (osPoints.length > 1) {
    svg += `<polyline points="${osPoints.join(' ')}" fill="none" stroke="#f97316" stroke-width="2.5" stroke-dasharray="3,3"/>`;
  }
  
  // Draw points
  comparisons.forEach((day, i) => {
    const x = margin.left + i * xStep;
    const gtY = height - margin.bottom - (day.groundTruth / maxValue) * chartHeight;
    svg += `<circle cx="${x}" cy="${gtY}" r="4" fill="#22c55e"/>`;
    
    if (day.prod) {
      const prodY = height - margin.bottom - (day.prod.value / maxValue) * chartHeight;
      svg += `<circle cx="${x}" cy="${prodY}" r="3" fill="#3b82f6"/>`;
    }
    
    if (day.openSky) {
      const osY = height - margin.bottom - (day.openSky.value / maxValue) * chartHeight;
      svg += `<circle cx="${x}" cy="${osY}" r="3" fill="#f97316"/>`;
    }
  });
  
  // Legend
  const legendY = 50;
  svg += `<line x1="${width - 200}" y1="${legendY + 6}" x2="${width - 180}" y2="${legendY + 6}" stroke="#22c55e" stroke-width="2.5"/>`;
  svg += `<text x="${width - 175}" y="${legendY + 10}" font-size="11" fill="#333">Ground Truth</text>`;
  svg += `<line x1="${width - 200}" y1="${legendY + 24}" x2="${width - 180}" y2="${legendY + 24}" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="5,3"/>`;
  svg += `<text x="${width - 175}" y="${legendY + 28}" font-size="11" fill="#333">AeroDataBox</text>`;
  svg += `<line x1="${width - 200}" y1="${legendY + 42}" x2="${width - 180}" y2="${legendY + 42}" stroke="#f97316" stroke-width="2.5" stroke-dasharray="3,3"/>`;
  svg += `<text x="${width - 175}" y="${legendY + 46}" font-size="11" fill="#333">OpenSky</text>`;
  
  svg += `</svg>`;
  return svg;
}

/**
 * Main execution
 */
function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Generating Airport Discrepancy Diagrams                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const diagramsDir = join(DOCS_DIR, 'diagrams');
  
  // Create diagrams directory
  try {
    mkdirSync(diagramsDir, { recursive: true });
  } catch (e) {}
  
  const allResults = {};
  
  for (const [iata, config] of Object.entries(AIRPORTS)) {
    console.log(`📊 Processing ${iata} (${config.name})...`);
    
    const data = loadAirportData(iata);
    const comparisons = buildComparisonData(iata, data);
    const maxDisc = calculateMaxDiscrepancies(comparisons);
    
    allResults[iata] = {
      config,
      comparisons,
      maxDiscrepancies: maxDisc
    };
    
    if (comparisons.length === 0) {
      console.log(`   ⚠️  No comparison data available`);
      continue;
    }
    
    // Generate 3 diagrams for each airport
    const barChart = generateSVGBarChart(iata, comparisons, config.name);
    const discChart = generateDiscrepancyChart(iata, comparisons, config.name);
    const trendChart = generateTrendChart(iata, comparisons, config.name);
    
    // Save diagrams
    if (barChart) {
      writeFileSync(join(diagramsDir, `${iata}-bar-chart.svg`), barChart, 'utf-8');
      console.log(`   ✅ Bar chart saved`);
    }
    if (discChart) {
      writeFileSync(join(diagramsDir, `${iata}-discrepancy-chart.svg`), discChart, 'utf-8');
      console.log(`   ✅ Discrepancy chart saved`);
    }
    if (trendChart) {
      writeFileSync(join(diagramsDir, `${iata}-trend-chart.svg`), trendChart, 'utf-8');
      console.log(`   ✅ Trend chart saved`);
    }
    
    // Print max discrepancy info
    console.log(`   Max Overcount: AeroDataBox=${maxDisc.prod.maxOver.toFixed(1)}% (${maxDisc.prod.overDate || 'N/A'}), OpenSky=${maxDisc.openSky.maxOver.toFixed(1)}% (${maxDisc.openSky.overDate || 'N/A'})`);
    console.log(`   Max Undercount: AeroDataBox=${maxDisc.prod.maxUnder.toFixed(1)}% (${maxDisc.prod.underDate || 'N/A'}), OpenSky=${maxDisc.openSky.maxUnder.toFixed(1)}% (${maxDisc.openSky.underDate || 'N/A'})`);
    console.log('');
  }
  
  // Generate markdown summary
  generateMarkdownSummary(allResults);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`✅ Diagrams saved to: ${diagramsDir}`);
  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Generate markdown summary with max discrepancies
 */
function generateMarkdownSummary(allResults) {
  let md = `# Airport API Discrepancy Summary\n\n`;
  md += `Generated: ${new Date().toISOString().split('T')[0]}\n\n`;
  
  md += `## Max Discrepancy Summary\n\n`;
  md += `| Airport | API | Max Overcount | Max Undercount | Days Compared |\n`;
  md += `|---------|-----|---------------|----------------|---------------|\n`;
  
  for (const [iata, result] of Object.entries(allResults)) {
    if (result.comparisons.length === 0) continue;
    
    const { maxDiscrepancies } = result;
    const prodOver = maxDiscrepancies.prod.maxOver > 0 ? `${maxDiscrepancies.prod.maxOver.toFixed(1)}% (${maxDiscrepancies.prod.overDate})` : 'N/A';
    const prodUnder = maxDiscrepancies.prod.maxUnder > 0 ? `${maxDiscrepancies.prod.maxUnder.toFixed(1)}% (${maxDiscrepancies.prod.underDate})` : 'N/A';
    const osOver = maxDiscrepancies.openSky.maxOver > 0 ? `${maxDiscrepancies.openSky.maxOver.toFixed(1)}% (${maxDiscrepancies.openSky.overDate})` : 'N/A';
    const osUnder = maxDiscrepancies.openSky.maxUnder > 0 ? `${maxDiscrepancies.openSky.maxUnder.toFixed(1)}% (${maxDiscrepancies.openSky.underDate})` : 'N/A';
    
    md += `| ${iata} | AeroDataBox | ${prodOver} | ${prodUnder} | ${result.comparisons.filter(d => d.prod).length} |\n`;
    if (result.config.hasOpenSky) {
      md += `| ${iata} | OpenSky | ${osOver} | ${osUnder} | ${result.comparisons.filter(d => d.openSky).length} |\n`;
    }
  }
  
  md += `\n## Diagrams\n\n`;
  
  for (const [iata, result] of Object.entries(allResults)) {
    if (result.comparisons.length === 0) continue;
    
    md += `### ${iata} (${result.config.name})\n\n`;
    
    md += `#### 1. Daily Flight Counts (Bar Chart)\n\n`;
    md += `![${iata} Bar Chart](diagrams/${iata}-bar-chart.svg)\n\n`;
    
    md += `#### 2. Discrepancy Percentages\n\n`;
    md += `![${iata} Discrepancy Chart](diagrams/${iata}-discrepancy-chart.svg)\n\n`;
    
    md += `#### 3. Flight Count Trends\n\n`;
    md += `![${iata} Trend Chart](diagrams/${iata}-trend-chart.svg)\n\n`;
    
    md += `---\n\n`;
  }
  
  writeFileSync(join(DOCS_DIR, 'airport-discrepancy-diagrams.md'), md, 'utf-8');
  console.log('\n✅ Summary markdown saved to: docs/airport-discrepancy-diagrams.md');
}

main();
