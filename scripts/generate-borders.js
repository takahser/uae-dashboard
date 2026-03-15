#!/usr/bin/env node
/**
 * Generate pre-projected SVG path strings for GCC theatre map countries
 * from world-atlas TopoJSON data.
 *
 * Output: src/data/gcc-borders.json
 *   { "saudiArabia": { "path": "M... Z", "pts": [[lat,lng], ...] }, ... }
 *
 * "path" is pre-projected to the GCC equirectangular bounds (800x500 SVG).
 * "pts" contains raw [lat,lng] coordinate arrays for use with other projections.
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use 50m for good balance of detail and file size
// Bahrain is missing from 50m/110m, so we add it manually from 10m below
const topoPath = join(__dirname, "..", "node_modules", "world-atlas", "countries-50m.json");
const topoPath10m = join(__dirname, "..", "node_modules", "world-atlas", "countries-10m.json");
const topo = JSON.parse(readFileSync(topoPath, "utf-8"));

// Extract GeoJSON features
const countries = feature(topo, topo.objects.countries);

// ISO 3166-1 numeric → key mapping
const ISO_MAP = {
  "682": "saudiArabia",
  "512": "oman",
  "887": "yemen",
  "400": "jordan",
  "760": "syria",
  "368": "iraq",
  "364": "iran",
  "818": "egypt",
  "376": "israel",
  "414": "kuwait",
  "634": "qatar",
  "48":  "bahrain",
  "048": "bahrain",
  "784": "uae",
  // Additional countries visible in the GCC theatre map
  "792": "turkey",
  "736": "sudan",   // old code for Sudan
  "729": "sudan",   // new code for Sudan
  "231": "ethiopia",
  "706": "somalia",
  "262": "djibouti",
  "232": "eritrea",
  "422": "lebanon",
  "275": "palestine",
};

// GCC theatre bounds
const SVG_W = 800, SVG_H = 500;
const BOUNDS = { latMin: 10.0, latMax: 41.0, lngMin: 33.0, lngMax: 60.0 };

function project(lat, lng) {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * SVG_W;
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * SVG_H;
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function ringToPath(ring) {
  return ring.map(([lng, lat], i) => {
    const [x, y] = project(lat, lng);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ") + " Z";
}

function ringToPts(ring) {
  return ring.map(([lng, lat]) => [
    Math.round(lat * 10000) / 10000,
    Math.round(lng * 10000) / 10000,
  ]);
}

function geometryToPathAndPts(geometry) {
  const pathParts = [];
  const allPts = [];

  if (geometry.type === "Polygon") {
    pathParts.push(ringToPath(geometry.coordinates[0]));
    allPts.push(ringToPts(geometry.coordinates[0]));
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      pathParts.push(ringToPath(polygon[0]));
      allPts.push(ringToPts(polygon[0]));
    }
  }

  return {
    path: pathParts.join(" "),
    pts: allPts.length === 1 ? allPts[0] : allPts,
    multiPolygon: allPts.length > 1,
  };
}

const result = {};

for (const f of countries.features) {
  const id = f.id || f.properties?.iso_n3;
  const key = ISO_MAP[id];
  if (!key) continue;

  const { path: svgPath, pts, multiPolygon } = geometryToPathAndPts(f.geometry);
  result[key] = { path: svgPath, pts, multiPolygon };
}

// Fallback to 10m for any missing countries (e.g. Bahrain)
const found = Object.keys(result);
const wanted = [...new Set(Object.values(ISO_MAP))];
const missing = wanted.filter(k => !result[k]);
if (missing.length) {
  console.log(`Fetching ${missing.join(", ")} from 10m dataset...`);
  const topo10 = JSON.parse(readFileSync(topoPath10m, "utf-8"));
  const countries10 = feature(topo10, topo10.objects.countries);
  for (const f2 of countries10.features) {
    const id2 = f2.id || f2.properties?.iso_n3;
    const key2 = ISO_MAP[id2];
    if (key2 && !result[key2]) {
      const { path: svgPath, pts, multiPolygon } = geometryToPathAndPts(f2.geometry);
      result[key2] = { path: svgPath, pts, multiPolygon };
    }
  }
  const stillMissing = wanted.filter(k => !result[k]);
  if (stillMissing.length) {
    console.warn("Warning: still missing:", stillMissing.join(", "));
  }
}

const outPath = join(__dirname, "..", "src", "data", "gcc-borders.json");
writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Wrote ${found.length} countries to ${outPath}`);
console.log("Countries:", found.join(", "));
