import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

const UAE_GREEN = "#00732F";
const UAE_GOLD = "#CF9B1A";

const COUNTRY_CONFIG = [
  { code: "uae", name: "UAE", flag: "\u{1F1E6}\u{1F1EA}", file: "data-uae.json", color: "#00732F", accent: "#CF9B1A", source: "@modgovae" },
  { code: "qatar", name: "Qatar", flag: "\u{1F1F6}\u{1F1E6}", file: "data-qatar.json", color: "#8A1538", accent: "#FFFFFF", source: "@MOD_Qatar" },
  { code: "kuwait", name: "Kuwait", flag: "\u{1F1F0}\u{1F1FC}", file: "data-kuwait.json", color: "#007A3D", accent: "#CE1126", source: "@MOD_KW" },
  { code: "bahrain", name: "Bahrain", flag: "\u{1F1E7}\u{1F1ED}", file: "data-bahrain.json", color: "#CE1126", accent: "#FFFFFF", source: "@BDF_Bahrain" },
];
const INTERCEPTED = "#00A86B";
const IMPACTED = "#C0392B";
const SEA = "#2980B9";
const BG = "#0A0F1E";
const CARD_BG = "#0F1829";
const BORDER = "#1A2840";
const TEXT = "#E8EDF5";
const SUBTEXT = "#8899BB";

// Live Intel map constants
const MAP_BG = "#060A14";
const MAP_LAND = "#0A1628";
const MAP_BORDER_COLOR = "#1A3050";
const MAP_GRID = "#0D2040";
const DRONE_HIT = "#C0392B";
const DEBRIS_HIT = "#E67E22";

const STRATEGIC_BLUE = "#3498DB";

// Equirectangular projection: configurable bounds → SVG coords
const SVG_W = 800, SVG_H = 500;
function makeToSVG(bounds) {
  return (lat, lng) => ({
    x: ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * SVG_W,
    y: ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * SVG_H,
  });
}

// Default UAE bounds (also used for path generation)
const UAE_BOUNDS = { latMin: 22.5, latMax: 26.2, lngMin: 51.5, lngMax: 56.5 };
const toSVG = makeToSVG(UAE_BOUNDS);

// Per-country map configurations
const MAP_CONFIGS = {
  uae: {
    bounds: UAE_BOUNDS,
    // Simplified UAE outline for use in the GCC-wide map
    regions: [
      { name: "UAE", labelLat: 24.0, labelLng: 54.0, pts: [[26.08,56.16],[25.60,56.36],[24.85,56.28],[24.08,56.02],[23.97,55.48],[23.77,55.57],[23.12,55.25],[22.70,55.21],[22.50,55.01],[23.00,52.00],[23.98,51.57],[24.36,51.58],[24.27,51.78],[24.00,52.32],[24.20,52.60],[24.06,53.87],[24.18,53.97],[24.15,54.11],[24.30,54.09],[24.42,54.26],[24.47,54.30],[24.45,54.61],[24.83,54.72],[24.98,55.01],[25.27,55.28],[25.31,55.45],[25.40,55.42],[25.51,55.52],[25.66,55.75],[25.74,55.89],[25.88,56.05],[26.07,56.09],[26.08,56.16]] },
    ],
    title: "LIVE INTEL — UAE IMPACT MAP",
    subtitle: "CONFIRMED STRIKE LOCATIONS",
    impacts: [
      { id: 1, name: "Palm Jumeirah / Fairmont Hotel", type: "drone_hit", date: "28 Feb", casualties: "4 injured", lat: 25.1425, lng: 55.1400, region: "Dubai" },
      { id: 2, name: "Dubai Intl Airport T3", type: "drone_hit", date: "28 Feb", casualties: "4 injured", lat: 25.2528, lng: 55.3644, region: "Dubai" },
      { id: 3, name: "US Consulate Dubai", type: "drone_hit", date: "~3 Mar", casualties: "None", lat: 25.2601, lng: 55.3091, region: "Dubai" },
      { id: 4, name: "Burj Al Arab", type: "debris", date: "28 Feb", casualties: "None", lat: 25.1413, lng: 55.1857, region: "Dubai" },
      { id: 5, name: "Jebel Ali Port", type: "debris", date: "28 Feb", casualties: "None", lat: 25.0050, lng: 55.0175, region: "Dubai" },
      { id: 6, name: "Zayed Intl Airport", type: "debris", date: "28 Feb", casualties: "1 killed, 7 injured", lat: 24.4267, lng: 54.6510, region: "Abu Dhabi" },
      { id: 7, name: "Camp de la Paix (French Naval Base)", type: "drone_hit", date: "1-2 Mar", casualties: "None", lat: 24.4475, lng: 54.3500, region: "Abu Dhabi" },
      { id: 8, name: "Etihad Towers", type: "debris", date: "28 Feb-3 Mar", casualties: "None", lat: 24.4397, lng: 54.3605, region: "Abu Dhabi" },
      { id: 9, name: "Sharjah (general area)", type: "drone_hit", date: "1 Mar", casualties: "None", lat: 25.3488, lng: 55.4121, region: "Sharjah" },
    ],
    strategicSites: [
      { id: "s1", name: "Al Dhafra Air Base", type: "US/UAE Air Base", lat: 24.2482, lng: 54.5477 },
      { id: "s2", name: "Al Minhad Air Base", type: "UK/AUS Air Base", lat: 25.0267, lng: 55.3696 },
      { id: "s3", name: "US Embassy Abu Dhabi", type: "US Embassy", lat: 24.4539, lng: 54.3773 },
      { id: "s4", name: "US Consulate Dubai", type: "US Consulate", lat: 25.2601, lng: 55.3091 },
      { id: "s5", name: "French Embassy Abu Dhabi", type: "FR Embassy", lat: 24.4587, lng: 54.3218 },
      { id: "s6", name: "British Embassy Abu Dhabi", type: "UK Embassy", lat: 24.4834, lng: 54.3512 },
      { id: "s7", name: "Fujairah Naval Facility", type: "US Navy", lat: 25.1612, lng: 56.3658 },
    ],
  },
  qatar: {
    bounds: { latMin: 24.4, latMax: 26.3, lngMin: 50.6, lngMax: 52.0 },
    title: "LIVE INTEL — QATAR IMPACT MAP",
    subtitle: "CONFIRMED STRIKE LOCATIONS",
    regions: [
      { name: "QATAR", labelLat: 25.3, labelLng: 51.2, pts: [[26.15,51.25],[26.10,51.58],[25.80,51.61],[25.60,51.53],[25.40,51.58],[25.20,51.56],[24.95,51.40],[24.56,51.28],[24.55,51.03],[24.70,50.85],[24.87,50.82],[25.10,50.80],[25.38,50.76],[25.60,50.82],[25.82,50.87],[26.05,51.02],[26.15,51.25]] },
    ],
    impacts: [
      { id: 1, name: "Al Udeid Air Base (vicinity)", type: "drone_hit", date: "28 Feb", casualties: "None", lat: 25.1173, lng: 51.3150, region: "Al Rayyan" },
      { id: 2, name: "Doha West (residential)", type: "debris", date: "28 Feb", casualties: "3 injured", lat: 25.2800, lng: 51.4000, region: "Doha" },
      { id: 3, name: "Lusail area", type: "drone_hit", date: "2 Mar", casualties: "None", lat: 25.4200, lng: 51.4900, region: "Lusail" },
      { id: 4, name: "Hamad Intl Airport (perimeter)", type: "debris", date: "5 Mar", casualties: "None", lat: 25.2731, lng: 51.6081, region: "Doha" },
      { id: 5, name: "Ras Laffan Industrial Area", type: "drone_hit", date: "4 Mar", casualties: "4 injured", lat: 25.9300, lng: 51.5300, region: "Al Khor" },
      { id: 6, name: "Dukhan Oil Fields", type: "drone_hit", date: "5 Mar", casualties: "None", lat: 25.4300, lng: 50.7800, region: "Dukhan" },
    ],
    strategicSites: [
      { id: "s1", name: "Al Udeid Air Base", type: "US/Qatar Air Base", lat: 25.1173, lng: 51.3150 },
      { id: "s2", name: "US Embassy Doha", type: "US Embassy", lat: 25.3134, lng: 51.4722 },
      { id: "s3", name: "Camp As Sayliyah", type: "US Army Base", lat: 25.2800, lng: 51.3300 },
    ],
  },
  kuwait: {
    bounds: { latMin: 28.5, latMax: 30.2, lngMin: 46.5, lngMax: 48.6 },
    title: "LIVE INTEL — KUWAIT IMPACT MAP",
    subtitle: "CONFIRMED STRIKE LOCATIONS",
    regions: [
      { name: "KUWAIT", labelLat: 29.3, labelLng: 47.5, pts: [[30.10,47.70],[30.00,48.00],[29.86,48.05],[29.36,48.40],[29.10,48.42],[29.00,48.15],[28.80,48.10],[28.55,47.70],[28.55,47.43],[28.67,47.45],[29.10,47.00],[29.35,47.00],[29.35,47.15],[29.57,47.45],[29.80,47.70],[30.10,47.70]] },
    ],
    impacts: [
      { id: 1, name: "Ali Al Salem Air Base (vicinity)", type: "drone_hit", date: "1 Mar", casualties: "None", lat: 29.3467, lng: 47.5208, region: "Al Jahra" },
      { id: 2, name: "Kuwait City South", type: "debris", date: "1 Mar", casualties: "7 injured", lat: 29.3400, lng: 47.9900, region: "Kuwait City" },
      { id: 3, name: "Arifjan Camp (perimeter)", type: "drone_hit", date: "3 Mar", casualties: "None", lat: 28.9300, lng: 48.0800, region: "Ahmadi" },
      { id: 4, name: "Mina al-Ahmadi Refinery", type: "debris", date: "3 Mar", casualties: "1 killed, 12 injured", lat: 29.0700, lng: 48.1300, region: "Ahmadi" },
      { id: 5, name: "Bubiyan Island radar", type: "drone_hit", date: "1 Mar", casualties: "None", lat: 29.7800, lng: 48.2500, region: "Bubiyan" },
    ],
    strategicSites: [
      { id: "s1", name: "Ali Al Salem Air Base", type: "US/Kuwait Air Base", lat: 29.3467, lng: 47.5208 },
      { id: "s2", name: "Camp Arifjan", type: "US Army Base", lat: 28.9300, lng: 48.0800 },
      { id: "s3", name: "Camp Buehring", type: "US Army Base", lat: 29.5600, lng: 47.5400 },
      { id: "s4", name: "US Embassy Kuwait", type: "US Embassy", lat: 29.2600, lng: 47.9400 },
    ],
  },
  bahrain: {
    bounds: { latMin: 25.7, latMax: 26.4, lngMin: 50.2, lngMax: 50.9 },
    title: "LIVE INTEL — BAHRAIN IMPACT MAP",
    subtitle: "CONFIRMED STRIKE LOCATIONS",
    regions: [
      { name: "BAHRAIN", labelLat: 26.05, labelLng: 50.55, pts: [[26.24,50.45],[26.27,50.55],[26.24,50.65],[26.14,50.70],[26.00,50.65],[25.90,50.62],[25.80,50.55],[25.79,50.45],[25.85,50.38],[25.97,50.35],[26.07,50.37],[26.18,50.40],[26.24,50.45]] },
      { name: "MUHARRAQ", labelLat: 26.26, labelLng: 50.62, pts: [[26.28,50.58],[26.30,50.63],[26.27,50.67],[26.22,50.67],[26.20,50.62],[26.22,50.57],[26.28,50.58]] },
    ],
    impacts: [
      { id: 1, name: "NSA Bahrain (vicinity)", type: "drone_hit", date: "28 Feb", casualties: "None", lat: 26.2400, lng: 50.6100, region: "Juffair" },
      { id: 2, name: "Bahrain Intl Airport area", type: "debris", date: "1 Mar", casualties: "1 killed", lat: 26.2708, lng: 50.6336, region: "Muharraq" },
      { id: 3, name: "Isa Air Base", type: "drone_hit", date: "2 Mar", casualties: "None", lat: 25.9182, lng: 50.5906, region: "Isa Town" },
      { id: 4, name: "Manama Diplomatic Quarter", type: "debris", date: "4 Mar", casualties: "None", lat: 26.2300, lng: 50.5800, region: "Manama" },
      { id: 5, name: "Sitra Industrial Area", type: "drone_hit", date: "5 Mar", casualties: "None", lat: 26.1500, lng: 50.6400, region: "Sitra" },
    ],
    strategicSites: [
      { id: "s1", name: "NSA Bahrain (US 5th Fleet)", type: "US Naval Base", lat: 26.2400, lng: 50.6100 },
      { id: "s2", name: "Isa Air Base", type: "Bahrain/US Air Base", lat: 25.9182, lng: 50.5906 },
      { id: "s3", name: "US Embassy Manama", type: "US Embassy", lat: 26.2280, lng: 50.5830 },
      { id: "s4", name: "UK Naval Support Facility", type: "UK Naval Base", lat: 26.1700, lng: 50.6200 },
    ],
  },
};

// Simplified geography for the All GCC theatre map (Arabian Peninsula + Iran)
// Coordinates are [lat, lng] pairs forming simplified country outlines
const GCC_GEOGRAPHY = {
  // Sea background: the entire SVG is water-colored; land polygons are drawn on top
  saudiArabia: {
    name: "SAUDI ARABIA", color: "#0E1A2A", labelLat: 24.5, labelLng: 45.0,
    pts: [
      // Red Sea coast (north to south)
      [29.5,34.8],[28.0,35.2],[27.0,36.7],[25.5,37.2],[24.5,37.5],[23.5,38.5],[22.0,39.0],[20.5,39.5],[19.0,40.0],[17.5,41.0],[16.5,42.5],
      // Yemen border (west to east)
      [16.0,43.0],[16.5,43.5],[17.0,44.5],[17.5,46.0],[18.0,48.5],[19.0,48.0],[19.5,49.5],[20.0,50.5],[19.5,51.5],[19.5,52.0],[19.0,55.0],
      // Oman border (south to tripoint)
      [20.5,55.0],[21.5,55.0],[22.0,55.0],[22.50,55.01],
      // Saudi-UAE border (tripoint northwest through Rub al Khali to Qatar)
      [23.00,52.00],[23.98,51.57],[24.36,51.58],
      // Persian Gulf coast (south to north)
      [24.00,49.50],[24.00,49.0],[24.50,48.50],[25.00,48.00],[25.50,47.80],[26.00,47.50],[26.50,47.30],[27.00,47.80],[27.50,48.00],[28.00,48.40],[28.50,48.50],
      // Kuwait border area
      [28.55,47.70],[28.55,47.43],[28.67,47.45],[29.10,47.00],[29.35,47.00],
      // Iraq/Jordan border north
      [30.00,47.00],[30.5,47.7],[30.50,46.50],[31.00,46.0],[31.50,44.0],[31.80,42.0],[32.0,39.0],
      // Jordan border
      [31.5,37.0],[29.5,34.8]
    ],
  },
  oman: {
    name: "OMAN", color: "#0E1A2A", labelLat: 21.5, labelLng: 57.5,
    pts: [
      // Musandam peninsula (Strait of Hormuz)
      [26.35,56.30],[26.20,56.50],[26.10,56.65],[25.90,56.60],[25.75,56.56],[25.59,56.36],[25.35,56.45],[25.22,56.57],[25.10,56.42],[24.85,56.50],[24.60,56.65],[24.40,56.55],
      // UAE eastern border south
      [24.08,56.02],[23.97,55.48],[23.77,55.57],[23.12,55.25],[22.70,55.21],
      // Saudi-Oman-UAE tripoint, then south along Saudi border
      [22.50,55.01],[22.0,55.0],[21.5,55.0],[20.5,55.0],[19.0,55.0],
      // Yemen-Oman border and south coast
      [18.0,53.5],[17.0,54.0],[16.5,54.5],[16.0,55.5],[16.5,56.0],[17.5,55.5],[18.0,56.0],
      // East coast north
      [19.5,57.5],[20.0,58.0],[20.5,58.5],[21.0,59.0],[21.5,59.5],[22.0,59.8],[22.5,59.8],[23.0,59.5],[23.5,58.8],[24.0,58.0],[24.2,57.5],[24.5,57.0],[24.6,56.8],
      // UAE border back to Musandam
      [24.40,56.55],[24.08,56.02],[24.24,55.95],[24.23,55.78],[24.70,55.82],[24.95,55.88],[25.00,55.98],[25.15,55.98],[25.25,55.99],[25.30,55.96],[25.37,56.00],[25.43,56.05],[25.50,56.10],[25.55,56.20],[25.65,56.30],[25.80,56.33],[25.85,56.40],[25.95,56.38],[26.07,56.09],[26.08,56.16],[26.10,56.25],[26.35,56.30]
    ],
  },
  iran: {
    name: "IRAN", color: "#1A1020", labelLat: 33.0, labelLng: 53.0,
    pts: [
      // Shatt al-Arab / Iraq border
      [30.5,48.0],[30.0,48.8],
      // Persian Gulf coast (west to east)
      [29.8,49.3],[29.5,50.0],[29.0,50.5],[28.9,50.8],[28.5,51.3],[28.0,51.8],[27.8,52.3],[27.5,52.8],[27.3,53.5],[27.1,54.0],[27.0,54.5],[26.8,55.0],
      // Strait of Hormuz (Qeshm/Bandar Abbas)
      [26.7,55.5],[26.6,55.8],[26.5,56.0],[26.6,56.3],[27.2,56.3],[27.1,56.8],
      // Gulf of Oman coast east
      [26.5,57.3],[26.2,57.8],[25.8,58.5],[25.5,59.0],[25.3,59.8],[25.2,60.0],
      // Eastern border north (Pakistan/Afghanistan/Turkmenistan)
      [26.0,60.0],[27.0,60.0],[28.5,60.0],[30.0,60.0],[31.5,60.0],[33.0,60.0],[34.5,60.0],[36.0,60.0],[37.5,60.0],[39.0,60.0],
      // Turkmenistan border / Caspian
      [40.0,58.0],[40.5,56.0],[40.0,54.0],[39.5,52.5],[38.5,52.0],
      // Caspian Sea coast (south shore)
      [37.5,51.5],[37.0,50.5],[37.5,50.0],[38.0,49.5],[38.5,49.0],[38.5,48.5],
      // Azerbaijan/Armenia border
      [39.5,48.0],[39.5,47.0],[39.0,46.0],[38.5,45.5],
      // Turkey border
      [38.0,44.5],[37.5,44.5],[37.5,45.5],[37.0,45.5],[36.5,45.5],
      // Iraq border south
      [36.0,45.5],[35.5,46.0],[35.0,46.5],[34.5,46.0],[34.0,45.5],
      [33.5,45.5],[33.0,45.5],[32.5,45.5],[32.0,46.0],[31.5,47.0],[31.0,47.5],[30.5,48.0]
    ],
  },
  iraq: {
    name: "IRAQ", color: "#0E1A2A", labelLat: 33.5, labelLng: 44.0,
    pts: [
      // Persian Gulf coast to Iran border
      [30.5,48.0],[30.0,48.8],
      // Iran border north
      [31.0,47.5],[31.5,47.0],[32.0,46.0],[32.5,45.5],[33.0,45.5],[33.5,45.5],[34.0,45.5],[34.5,46.0],[35.0,46.5],[35.5,46.0],[36.0,45.5],[36.5,45.5],
      // Turkey border
      [37.0,45.5],[37.5,45.5],[38.0,44.5],[37.5,43.5],[37.5,42.5],
      // Syria border
      [37.0,42.0],[36.5,42.0],[36.0,41.5],[35.5,41.0],[35.0,41.0],[34.5,41.0],[34.0,41.0],[33.5,41.0],
      // Jordan/Saudi border south
      [33.0,39.0],[32.5,39.0],[32.0,39.0],[31.0,39.0],
      // Saudi border
      [30.5,39.0],[30.0,40.0],[29.5,44.0],[29.5,46.5],[29.5,47.0],[30.0,47.0],[30.5,47.7],[30.5,48.0]
    ],
  },
  yemen: {
    name: "YEMEN", color: "#0E1A2A", labelLat: 15.5, labelLng: 47.0,
    pts: [
      // Saudi border (east to west)
      [19.0,55.0],[19.5,52.0],[19.5,51.5],[20.0,50.5],[19.5,49.5],[19.0,48.0],[18.0,48.5],[17.5,46.0],[17.0,44.5],[16.5,43.5],[16.0,43.0],
      // Red Sea / Gulf of Aden coast
      [15.0,43.0],[13.5,43.5],[12.5,43.5],[12.5,44.5],[12.8,45.0],[13.0,45.5],[13.5,47.0],[14.0,48.5],[14.5,49.5],[15.0,50.5],[15.5,51.5],[16.0,52.5],
      // Oman border
      [16.5,53.0],[17.0,54.0],[18.0,53.5],[19.0,55.0]
    ],
  },
  jordan: {
    name: "JORDAN", color: "#0E1A2A", labelLat: 31.2, labelLng: 36.5,
    pts: [
      // Iraq border
      [33.0,39.0],[33.5,38.5],
      // Syria border west to tripoint
      [33.3,36.3],[33.0,35.8],
      // Israel border south
      [32.5,35.5],[31.5,35.5],[31.0,35.4],[30.0,35.0],[29.5,34.8],
      // Saudi border east
      [29.5,36.0],[30.0,37.0],[30.5,37.5],[31.0,38.0],[31.5,38.5],[32.0,39.0],[32.5,39.0],[33.0,39.0]
    ],
  },
  syria: {
    name: "SYRIA", color: "#0E1A2A", labelLat: 35.0, labelLng: 38.0,
    pts: [
      // Jordan border to tripoint
      [33.0,39.0],[33.5,38.5],[33.3,36.3],
      // Tripoint with Israel/Lebanon — Golan
      [33.0,35.8],[33.3,35.6],
      // Lebanon border
      [34.0,36.0],[34.5,36.2],[34.7,36.2],
      // Mediterranean coast
      [35.8,35.8],[36.0,35.8],[36.2,36.0],[36.5,36.2],
      // Turkey border
      [37.0,36.5],[37.5,37.0],[37.5,38.0],[37.5,39.0],[37.5,40.0],[37.5,41.0],[37.5,42.0],
      // Iraq border
      [37.0,42.0],[36.5,42.0],[36.0,41.5],[35.5,41.0],[35.0,41.0],[34.5,41.0],[34.0,41.0],[33.5,41.0],
      [33.0,39.0]
    ],
  },
  lebanon: {
    name: "", color: "#0E1A2A",
    pts: [
      [34.7,36.2],[34.5,36.0],[34.0,36.0],[33.3,35.6],[33.8,35.1],[34.0,35.5],[34.7,35.8],[34.7,36.2]
    ],
  },
  israel: {
    name: "", color: "#0E1A2A",
    pts: [
      // Tripoint with Syria/Jordan
      [33.0,35.8],[33.3,35.6],[33.8,35.1],
      // Med coast south
      [32.9,35.1],[32.5,34.9],[32.0,34.5],[31.5,34.5],[31.0,34.5],[30.5,34.8],
      // Egypt border
      [29.5,34.8],
      // Jordan border north
      [30.0,35.0],[31.0,35.4],[31.5,35.5],[32.5,35.5],[33.0,35.8]
    ],
  },
  turkey: {
    name: "TURKEY", color: "#0E1A2A", labelLat: 39.5, labelLng: 37.0,
    pts: [
      // Syria border (Mediterranean to Iraq)
      [37.0,36.5],[36.5,36.2],[36.2,36.0],[36.0,35.8],[35.8,35.8],[34.7,35.8],[34.7,34.0],
      // Off-map north (extends well above map edge)
      [42.0,34.0],[42.0,36.0],[42.0,38.0],[42.0,40.0],[42.0,42.0],[42.0,44.0],[42.0,46.0],[42.0,48.0],
      // Iran/Armenia border
      [39.5,48.0],[39.5,47.0],[39.0,46.0],[38.5,45.5],[38.0,44.5],[37.5,44.5],
      // Iraq border
      [37.5,43.5],[38.0,44.5],[37.5,42.5],[37.0,42.0],
      // Syria border
      [37.5,42.0],[37.5,41.0],[37.5,40.0],[37.5,39.0],[37.5,38.0],[37.5,37.0],[37.0,36.5]
    ],
  },
  egypt: {
    name: "EGYPT", color: "#0E1A2A", labelLat: 28.0, labelLng: 34.0,
    pts: [
      // Sinai / Israel border
      [31.5,34.5],[31.0,34.5],[30.5,34.0],[30.0,34.0],
      // Suez / Red Sea coast south
      [29.5,33.0],[29.0,33.0],[28.0,33.5],[27.5,34.0],[27.0,34.5],[26.0,34.8],[25.0,35.0],[24.0,35.3],[23.0,35.8],[22.0,36.5],
      // Sudan border west then north along Nile/off-map
      [22.0,34.0],[25.0,34.0],[29.5,34.0],[29.5,34.8],[30.5,34.8],[31.0,34.5],[31.5,34.5]
    ],
  },
  sudan: {
    name: "SUDAN", color: "#0E1A2A",
    pts: [
      // Egypt border
      [22.0,36.5],[22.0,34.0],
      // Off-map west/south
      [12.0,34.0],[12.0,36.0],
      // Eritrea border
      [15.0,36.5],[15.5,37.5],[16.0,38.0],[17.0,38.5],[18.0,38.5],
      // Red Sea coast north
      [19.0,38.0],[19.5,37.5],[20.0,37.5],[20.5,37.0],[21.0,37.0],[21.5,36.8],[22.0,36.5]
    ],
  },
  ethiopia: {
    name: "", color: "#0E1A2A",
    pts: [
      // Eritrea border
      [18.0,38.5],[17.0,38.5],[15.5,37.5],[15.0,36.5],
      // Off-map south/west
      [12.0,36.0],[12.0,38.0],[10.0,38.0],[10.0,42.0],
      // Djibouti/Somalia border
      [11.5,42.0],[11.5,42.5],[12.0,42.0],
      // Eritrea border east
      [13.0,42.0],[14.5,40.0],[15.0,39.5],[16.0,39.0],[17.0,38.5],[18.0,38.5]
    ],
  },
  somalia: {
    name: "SOMALIA", color: "#0E1A2A",
    pts: [
      // Gulf of Aden coast
      [12.0,43.3],[11.5,43.5],[11.0,44.0],[11.2,45.0],[11.0,46.0],[11.5,47.0],[12.0,48.0],[12.0,49.0],[12.0,50.0],[11.5,51.0],
      // Off-map south
      [10.0,51.5],[10.0,42.0],
      // Djibouti border
      [11.5,42.0],[11.5,42.5],[11.5,43.0],[12.0,43.3]
    ],
  },
  djibouti: {
    name: "", color: "#0E1A2A",
    pts: [[12.5,43.5],[12.0,43.3],[11.5,43.0],[11.5,42.5],[12.0,42.0],[13.0,42.0],[12.5,43.0],[12.5,43.5]],
  },
  eritrea: {
    name: "", color: "#0E1A2A",
    pts: [[18.0,38.5],[17.0,38.5],[16.0,39.0],[15.0,39.5],[14.5,40.0],[13.0,42.0],[12.0,42.0],[11.5,42.0],[11.5,40.5],[13.0,40.0],[14.0,39.0],[15.0,38.5],[15.5,37.5],[16.0,38.0],[17.0,38.5],[18.0,38.5]],
  },
};
const GCC_COVERED_COUNTRIES = new Set(["UAE", "QATAR", "KUWAIT", "BAHRAIN"]);

// UAE emirate boundary paths from GADM/OpenStreetMap data (simplified with Douglas-Peucker)
// Source: github.com/wjdanalharthi/MENA_GeoJSON (GADM boundaries)
const UAE_EMIRATES = [
  { name: "ABU DHABI", labelLat: 23.6, labelLng: 53.5, path: (() => {
    const pts = [[24.00,52.32],[24.20,52.60],[24.06,53.87],[24.18,53.85],[24.17,53.62],[24.28,53.84],[24.18,53.97],[24.10,53.92],[24.15,54.11],[24.19,54.01],[24.22,54.14],[24.30,54.09],[24.27,54.30],[24.42,54.26],[24.25,54.29],[24.31,54.53],[24.47,54.30],[24.45,54.61],[24.57,54.47],[24.51,54.59],[24.83,54.72],[24.98,55.01],[24.60,55.16],[24.70,55.82],[24.23,55.78],[24.24,55.95],[24.08,56.02],[23.97,55.48],[23.77,55.57],[23.12,55.25],[22.70,55.21],[22.50,55.01],[23.00,52.00],[23.98,51.57],[24.36,51.58],[24.20,51.63],[24.33,51.65],[24.21,51.70],[24.27,51.78],[23.99,51.83],[24.00,52.32]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "DUBAI", labelLat: 25.15, labelLng: 55.22, path: (() => {
    const pts = [[25.01,55.05],[25.27,55.28],[25.23,55.35],[25.19,55.33],[25.22,55.36],[25.28,55.30],[25.31,55.45],[25.19,55.62],[25.05,55.66],[24.98,55.62],[24.90,55.66],[24.72,55.68],[24.61,55.46],[24.60,55.16],[24.98,55.01],[25.02,55.04],[24.97,55.05],[24.99,55.08],[25.01,55.05]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "SHARJAH", labelLat: 25.35, labelLng: 55.50, path: (() => {
    const pts = [[24.98,55.98],[24.95,55.87],[24.88,55.81],[24.70,55.82],[24.71,55.67],[24.90,55.66],[24.98,55.62],[25.05,55.66],[25.19,55.62],[25.31,55.45],[25.30,55.33],[25.37,55.38],[25.33,55.39],[25.36,55.38],[25.40,55.42],[25.36,55.61],[25.42,55.63],[25.45,55.50],[25.51,55.52],[25.42,55.71],[25.28,55.82],[25.30,55.91],[25.35,55.90],[25.33,55.94],[25.39,55.98],[25.37,56.00],[25.30,55.96],[25.25,55.99],[25.18,55.95],[25.14,55.98],[25.08,55.95],[24.98,55.98]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "SHARJAH", labelLat: 0, labelLng: 0, path: (() => {
    const pts = [[25.23,56.21],[25.31,56.21],[25.32,56.26],[25.36,56.27],[25.42,56.36],[25.37,56.35],[25.31,56.37],[25.22,56.27],[25.23,56.21]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "AJMAN", labelLat: 25.42, labelLng: 55.48, path: (() => {
    const pts = [[25.40,55.42],[25.42,55.44],[25.42,55.46],[25.40,55.46],[25.42,55.46],[25.42,55.49],[25.43,55.47],[25.44,55.47],[25.43,55.45],[25.46,55.48],[25.48,55.48],[25.47,55.48],[25.48,55.49],[25.45,55.50],[25.42,55.63],[25.36,55.60],[25.36,55.51],[25.40,55.42]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "UMM AL QUWAIN", labelLat: 25.56, labelLng: 55.65, path: (() => {
    const pts = [[25.51,55.52],[25.61,55.58],[25.52,55.57],[25.55,55.65],[25.59,55.65],[25.66,55.75],[25.64,55.80],[25.47,55.84],[25.43,55.89],[25.40,55.87],[25.35,55.93],[25.35,55.90],[25.30,55.91],[25.28,55.81],[25.35,55.78],[25.42,55.71],[25.51,55.52]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "RAS AL KHAIMAH", labelLat: 25.80, labelLng: 55.97, path: (() => {
    const pts = [[25.74,55.89],[25.88,56.05],[26.07,56.09],[26.08,56.16],[25.66,56.16],[25.58,55.96],[25.49,55.98],[25.50,56.10],[25.47,56.13],[25.42,56.09],[25.40,56.14],[25.36,56.14],[25.34,56.08],[25.39,55.97],[25.33,55.94],[25.40,55.87],[25.43,55.89],[25.47,55.84],[25.63,55.80],[25.66,55.75],[25.72,55.80],[25.74,55.89]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "RAS AL KHAIMAH", labelLat: 0, labelLng: 0, path: (() => {
    const pts = [[24.82,56.19],[24.85,56.06],[24.96,56.03],[25.04,55.95],[25.14,55.98],[25.20,55.96],[25.22,56.12],[25.29,56.18],[25.31,56.12],[25.34,56.15],[25.31,56.21],[24.94,56.21],[24.85,56.28],[24.82,56.19]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "FUJAIRAH", labelLat: 25.40, labelLng: 56.20, path: (() => {
    const pts = [[25.42,56.36],[25.31,56.23],[25.32,56.12],[25.29,56.18],[25.22,56.12],[25.23,55.99],[25.38,56.00],[25.34,56.09],[25.38,56.15],[25.42,56.09],[25.47,56.13],[25.50,56.10],[25.49,55.98],[25.59,55.97],[25.66,56.16],[25.61,56.22],[25.63,56.27],[25.60,56.36],[25.42,56.36]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
  { name: "FUJAIRAH", labelLat: 0, labelLng: 0, path: (() => {
    const pts = [[25.07,56.36],[24.98,56.37],[24.85,56.28],[24.94,56.21],[25.23,56.21],[25.22,56.27],[25.31,56.37],[25.07,56.36]];
    return "M" + pts.map(([lat,lng]) => { const {x,y} = toSVG(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
  })() },
];

// Safe number helper: treat null/undefined as 0 for math
const n = (v) => (v == null ? 0 : v);

function buildDerivedData(raw) {
  const { cumulative, daily } = raw;
  const c = cumulative;

  const hasDailyData = daily && daily.length > 0;

  const dailyData = hasDailyData ? daily.map((d, i) => ({
    day: d.label, label: `Day ${i + 1}`,
    ballistic: n(d.ballisticDetected), drones: n(d.dronesDetected), cruise: n(d.cruiseDetected),
    ballisticIntercepted: n(d.ballisticIntercepted), droneIntercepted: n(d.dronesIntercepted),
    droneImpact: n(d.dronesImpacted), ballisticSea: n(d.ballisticSea),
  })) : [];

  let runDetected = 0, runIntercepted = 0, runImpacted = 0;
  const cumulativeData = hasDailyData ? daily.map((d) => {
    runDetected    += n(d.ballisticDetected) + n(d.cruiseDetected) + n(d.dronesDetected);
    runIntercepted += n(d.ballisticIntercepted) + n(d.cruiseIntercepted) + n(d.dronesIntercepted);
    runImpacted    += n(d.ballisticImpacted) + n(d.dronesImpacted);
    return { day: d.label, totalDetected: runDetected, totalIntercepted: runIntercepted, impacted: runImpacted };
  }) : [];

  // For countries like Bahrain that report "missiles intercepted" without ballistic/cruise split
  const missilesIntercepted = n(c.missilesIntercepted);
  const totalIntercepted = n(c.ballisticIntercepted) + n(c.cruiseIntercepted) + n(c.dronesIntercepted) + missilesIntercepted;
  const totalDetected    = n(c.ballisticDetected) + n(c.cruiseDetected) + n(c.dronesDetected) + missilesIntercepted;
  const totalImpacted    = n(c.ballisticImpacted) + n(c.dronesImpacted);

  const finalTotals = [
    { name: "Ballistic\nMissiles", detected: n(c.ballisticDetected), intercepted: n(c.ballisticIntercepted), sea: n(c.ballisticSea), impacted: n(c.ballisticImpacted) },
    { name: "Cruise\nMissiles",    detected: n(c.cruiseDetected),    intercepted: n(c.cruiseIntercepted),    sea: 0, impacted: n(c.cruiseImpacted) },
    { name: "Drones\n(UAVs)",      detected: n(c.dronesDetected),    intercepted: n(c.dronesIntercepted),    sea: 0, impacted: n(c.dronesImpacted) },
  ];
  // Add missiles row for countries that don't split types
  if (missilesIntercepted > 0) {
    finalTotals.unshift({ name: "Missiles\n(unspec.)", detected: missilesIntercepted, intercepted: missilesIntercepted, sea: 0, impacted: 0 });
  }

  const pieData = [
    { name: "Intercepted",        value: totalIntercepted,  color: INTERCEPTED },
    { name: "Fell in Sea",        value: n(c.ballisticSea), color: SEA },
    { name: "Impacted Territory", value: totalImpacted,     color: IMPACTED },
  ].filter(d => d.value > 0);

  const ballisticRate = n(c.ballisticDetected) > 0 ? +((n(c.ballisticIntercepted) / n(c.ballisticDetected)) * 100).toFixed(1) : null;
  const cruiseRate    = n(c.cruiseDetected) > 0 ? +((n(c.cruiseIntercepted) / n(c.cruiseDetected)) * 100).toFixed(1) : null;
  const droneRate     = n(c.dronesDetected) > 0 ? +((n(c.dronesIntercepted) / n(c.dronesDetected)) * 100).toFixed(1) : null;
  const overallRate   = totalDetected > 0 ? +((totalIntercepted / totalDetected) * 100).toFixed(1) : null;

  const rateData = [
    ballisticRate !== null && { category: "Ballistic\nMissiles", rate: ballisticRate },
    cruiseRate !== null && { category: "Cruise\nMissiles",    rate: cruiseRate },
    droneRate !== null && { category: "Drones",              rate: droneRate },
    overallRate !== null && { category: "Overall",             rate: overallRate },
  ].filter(Boolean);

  const trendData = hasDailyData ? daily.map((d) => ({
    day: d.label, ballistic: n(d.ballisticDetected), cruise: n(d.cruiseDetected),
    drones: n(d.dronesDetected), total: n(d.total),
  })) : [];

  const interceptorData = hasDailyData ? daily.map(d => ({
    day: d.label,
    intercepted: n(d.ballisticIntercepted) + n(d.cruiseIntercepted) + n(d.dronesIntercepted),
    estimatedUsed: n(d.ballisticIntercepted) * 2 + n(d.cruiseIntercepted) * 1.5 + n(d.dronesIntercepted) * 1,
  })) : [];

  return { dailyData, cumulativeData, finalTotals, pieData, rateData, trendData, interceptorData,
           cumulative: c, totalDetected, totalIntercepted, totalImpacted, overallRate, hasDailyData };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#0D1525", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
        <p style={{ color: UAE_GOLD, fontWeight: 700, marginBottom: 6, fontFamily: "Georgia, serif" }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></p>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ label, value, sub, color = UAE_GOLD }) => (
  <div style={{
    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
    padding: "16px 20px", flex: 1, minWidth: 130,
    borderTop: `3px solid ${color}`
  }}>
    <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "Georgia, serif", letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 11, color: TEXT, fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: SUBTEXT, marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("intel");
  const [hoveredImpact, setHoveredImpact] = useState(null);
  const [selectedImpact, setSelectedImpact] = useState(null);
  const [allData, setAllData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState("uae");
  const [error, setError] = useState(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showStrategicSites, setShowStrategicSites] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedSite, setSelectedSite] = useState(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all(
      COUNTRY_CONFIG.map(c =>
        fetch(base + c.file).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    ).then(results => {
      const data = {};
      COUNTRY_CONFIG.forEach((c, i) => { if (results[i]) data[c.code] = results[i]; });
      if (Object.keys(data).length === 0) { setError("Failed to load data files"); return; }
      setAllData(data);
    });
  }, []);

  if (error) return <div style={{ background: BG, color: IMPACTED, padding: 40, fontFamily: "monospace" }}>{error}</div>;
  if (!allData) return <div style={{ background: BG, color: SUBTEXT, padding: 40, fontFamily: "monospace", minHeight: "100vh" }}>Loading...</div>;

  const isAllGCC = selectedCountry === "all";
  const countryConf = COUNTRY_CONFIG.find(c => c.code === selectedCountry) || COUNTRY_CONFIG[0];
  const rawData = isAllGCC ? allData.uae : (allData[selectedCountry] || allData.uae);
  const themeColor = isAllGCC ? UAE_GREEN : countryConf.color;
  const themeAccent = isAllGCC ? UAE_GOLD : countryConf.accent;

  // When All GCC, aggregate stats across all countries
  const derived = isAllGCC ? (() => {
    const perCountry = COUNTRY_CONFIG.map(c => allData[c.code]).filter(Boolean).map(buildDerivedData);
    const aggDetected = perCountry.reduce((s, d) => s + d.totalDetected, 0);
    const aggIntercepted = perCountry.reduce((s, d) => s + d.totalIntercepted, 0);
    const aggImpacted = perCountry.reduce((s, d) => s + d.totalImpacted, 0);
    const aggRate = aggDetected > 0 ? +((aggIntercepted / aggDetected) * 100).toFixed(1) : null;
    const aggSea = perCountry.reduce((s, d) => s + n(d.cumulative.ballisticSea), 0);
    const aggKilled = perCountry.reduce((s, d) => s + n(d.cumulative.killed), 0);
    const aggInjured = perCountry.reduce((s, d) => s + n(d.cumulative.injured), 0);
    return {
      ...buildDerivedData(rawData),
      totalDetected: aggDetected, totalIntercepted: aggIntercepted, totalImpacted: aggImpacted,
      overallRate: aggRate,
      cumulative: { ...rawData.cumulative, ballisticSea: aggSea, killed: aggKilled, injured: aggInjured },
    };
  })() : buildDerivedData(rawData);

  const { dailyData, cumulativeData, finalTotals, pieData, rateData, trendData, interceptorData,
          cumulative, totalDetected, totalIntercepted, totalImpacted, overallRate, hasDailyData } = derived;

  const lastUpdated = new Date(rawData.lastUpdated).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai"
  });
  const dayCount = rawData.daily.length;

  const allTabs = [
    { id: "intel",       label: "Live Intel" },
    { id: "overview",    label: "Overview" },
    { id: "trends",      label: "Trend Lines",         needsDaily: true },
    { id: "daily",       label: "Daily Attacks",        needsDaily: true },
    { id: "cumulative",  label: "Cumulative",           needsDaily: true },
    { id: "rates",       label: "Interception Rates" },
    { id: "arsenal",     label: "Arsenal & Defence" },
  ];
  const tabs = isAllGCC ? [{ id: "intel", label: "Live Intel" }, { id: "comparison", label: "Comparison" }] : allTabs.filter(t => {
    if (t.needsUAE) return false; // reserved for future use
    if (t.needsDaily && !hasDailyData) return false;
    return true;
  });

  // Reset tab if current tab is not available
  if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
    const validTab = tabs[0].id;
    if (activeTab !== validTab) setTimeout(() => setActiveTab(validTab), 0);
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'Trebuchet MS', sans-serif", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #060C1A 0%, #0C1830 50%, #060C1A 100%)`,
        borderBottom: `1px solid ${BORDER}`, padding: "24px 28px 20px",
        position: "relative", overflow: "visible"
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 39px, #1A2840 39px, #1A2840 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #1A2840 39px, #1A2840 40px)",
          opacity: 0.15, overflow: "hidden", pointerEvents: "none"
        }} />
        <div style={{ position: "relative" }}>
          <a href="https://github.com/takahser/uae-dashboard" target="_blank" rel="noopener noreferrer"
            style={{ position: "absolute", top: 0, right: 0, color: SUBTEXT, fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div style={{
              background: themeColor, borderRadius: "50%", width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 900, color: "white", flexShrink: 0
            }}>{isAllGCC ? "GCC" : countryConf.flag}</div>
            <div>
              <div style={{ fontSize: 11, color: themeAccent, textTransform: "uppercase", letterSpacing: 3, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {isAllGCC ? "GCC Coalition Defence" : `${countryConf.name} Ministry of Defence`}
                <span
                  onClick={() => setShowDisclaimer(!showDisclaimer)}
                  style={{ cursor: "pointer", fontSize: 10, color: SUBTEXT, border: `1px solid ${BORDER}`, borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}
                  title="Disclaimer"
                >(i)</span>
                {showDisclaimer && (
                  <div style={{ position: "absolute", top: "100%", left: 50, zIndex: 100, marginTop: 4, background: "#0D1525", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: SUBTEXT, maxWidth: 360, lineHeight: 1.5, fontWeight: 400, textTransform: "none", letterSpacing: 0, boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
                    This is an independent project using publicly available data from UAE Ministry of Defence (@modgovae). It is not affiliated with or endorsed by any government entity.
                  </div>
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, fontFamily: "Georgia, serif", letterSpacing: -0.5 }}>
                Iran Missile Tracker
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 11, color: SUBTEXT }}>
            <span>📅 28 Feb 2026{dayCount > 0 ? ` — Day ${dayCount}` : ""}</span>
            <span>📡 Source: {isAllGCC ? "Multiple MoD accounts" : `${countryConf.source} official statements`}</span>
            <span style={{ color: themeAccent }}>⚡ Updated: {lastUpdated} GST</span>
          </div>
        </div>
      </div>

      {/* Country selector */}
      <div style={{ display: "flex", gap: 8, padding: "16px 28px 0", flexWrap: "wrap" }}>
        {[{ code: "all", name: "All GCC", flag: "🌐" }, ...COUNTRY_CONFIG].map(c => (
          <button key={c.code} onClick={() => { setSelectedCountry(c.code); setHoveredImpact(null); setSelectedImpact(null); setSelectedSite(null); }}
            style={{
              background: selectedCountry === c.code ? (c.color || UAE_GREEN) : "transparent",
              color: selectedCountry === c.code ? "#fff" : SUBTEXT,
              border: `1px solid ${selectedCountry === c.code ? (c.color || UAE_GREEN) : BORDER}`,
              borderRadius: 20, padding: "6px 16px", cursor: "pointer",
              fontSize: 12, fontWeight: selectedCountry === c.code ? 700 : 500,
              transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6
            }}>
            <span>{c.flag}</span> {c.name}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, padding: "20px 28px", flexWrap: "wrap" }}>
        <StatCard label="Total Detected" value={totalDetected.toLocaleString()} sub="Missiles + drones" color={themeAccent || UAE_GOLD} />
        <StatCard label="Intercepted" value={totalIntercepted.toLocaleString()} sub={overallRate != null ? `${overallRate}% success rate` : "Rate N/A"} color={INTERCEPTED} />
        <StatCard label="Impacted Territory" value={totalImpacted.toLocaleString()} sub="Drones + missiles landed" color={IMPACTED} />
        {n(cumulative.ballisticSea) > 0 && <StatCard label="Fell in Sea" value={n(cumulative.ballisticSea).toLocaleString()} sub="Ballistic missiles only" color={SEA} />}
        {n(cumulative.killed) > 0 && <StatCard label="Killed" value={cumulative.killed} sub="" color="#E74C3C" />}
        {cumulative.injured != null && <StatCard label="Injured" value={cumulative.injured} sub="" color="#E67E22" />}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "0 28px 20px", flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: activeTab === t.id ? (themeAccent || UAE_GOLD) : "transparent",
            color: activeTab === t.id ? (themeAccent === "#FFFFFF" ? themeColor : "#000") : SUBTEXT,
            border: `1px solid ${activeTab === t.id ? (themeAccent || UAE_GOLD) : BORDER}`,
            borderRadius: 6, padding: "7px 16px", cursor: "pointer",
            fontSize: 12, fontWeight: activeTab === t.id ? 700 : 500,
            transition: "all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "0 28px" }}>

        {/* ALL GCC COMPARISON VIEW */}
        {isAllGCC && activeTab === "comparison" && (() => {
          const countryStats = COUNTRY_CONFIG.map(cc => {
            const d = allData[cc.code];
            if (!d) return null;
            const bd = buildDerivedData(d);
            return { ...cc, ...bd };
          }).filter(Boolean);
          const compData = countryStats.map(cs => ({
            name: cs.flag + " " + cs.name,
            detected: cs.totalDetected,
            intercepted: cs.totalIntercepted,
            impacted: cs.totalImpacted,
            rate: cs.overallRate,
          }));
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
              {/* Per-country stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${countryStats.length}, 1fr)`, gap: 16 }}>
                {countryStats.map(cs => (
                  <div key={cs.code} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, borderTop: `3px solid ${cs.color}` }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{cs.flag}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 12 }}>{cs.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: cs.accent || UAE_GOLD, fontFamily: "Georgia, serif" }}>{cs.totalDetected.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>Detected</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: INTERCEPTED, fontFamily: "Georgia, serif" }}>{cs.totalIntercepted.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>Intercepted</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: IMPACTED, fontFamily: "Georgia, serif" }}>{cs.totalImpacted.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>Impacted</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: cs.overallRate != null && cs.overallRate >= 95 ? INTERCEPTED : "#E67E22", fontFamily: "Georgia, serif" }}>{cs.overallRate != null ? `${cs.overallRate}%` : "N/A"}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>Success Rate</div></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grouped bar chart */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Detected / Intercepted / Impacted by Country</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="detected" name="Detected" fill="#1A3A5C" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="intercepted" name="Intercepted" fill={INTERCEPTED} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="impacted" name="Impacted" fill={IMPACTED} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Interception rate comparison */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>Interception Rate Comparison</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={compData.filter(d => d.rate != null)} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, "Rate"]} />
                    <Bar dataKey="rate" name="Interception Rate" radius={[4, 4, 0, 0]}>
                      {compData.filter(d => d.rate != null).map((_, i) => (
                        <Cell key={i} fill={COUNTRY_CONFIG[i]?.color || INTERCEPTED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown table */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, overflow: "auto" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Detailed Breakdown</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {["Country", "Ballistic", "Cruise", "Drones", "Total Detected", "Intercepted", "Impacted", "Killed", "Injured"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: SUBTEXT, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {countryStats.map(cs => (
                      <tr key={cs.code} style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <td style={{ padding: "10px", color: TEXT, fontWeight: 600 }}>{cs.flag} {cs.name}</td>
                        <td style={{ padding: "10px", color: TEXT }}>{n(cs.cumulative.ballisticDetected) || "—"}</td>
                        <td style={{ padding: "10px", color: TEXT }}>{n(cs.cumulative.cruiseDetected) || "—"}</td>
                        <td style={{ padding: "10px", color: TEXT }}>{n(cs.cumulative.dronesDetected) || "—"}</td>
                        <td style={{ padding: "10px", color: themeAccent, fontWeight: 700 }}>{cs.totalDetected.toLocaleString()}</td>
                        <td style={{ padding: "10px", color: INTERCEPTED, fontWeight: 700 }}>{cs.totalIntercepted.toLocaleString()}</td>
                        <td style={{ padding: "10px", color: IMPACTED, fontWeight: 700 }}>{cs.totalImpacted.toLocaleString()}</td>
                        <td style={{ padding: "10px", color: "#E74C3C" }}>{n(cs.cumulative.killed) || "—"}</td>
                        <td style={{ padding: "10px", color: "#E67E22" }}>{cs.cumulative.injured != null ? cs.cumulative.injured : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* LIVE INTEL TAB */}
        {activeTab === "intel" && (() => {
          // Unified map for All GCC, or per-country map
          const GCC_BOUNDS = { latMin: 10.0, latMax: 41.0, lngMin: 33.0, lngMax: 60.0 };
          const mapConf = isAllGCC ? { bounds: GCC_BOUNDS, title: "LIVE INTEL — GCC THEATRE MAP", subtitle: "ALL CONFIRMED STRIKE LOCATIONS" } : (MAP_CONFIGS[selectedCountry] || MAP_CONFIGS.uae);
          const proj = makeToSVG(mapConf.bounds);
          // Merge all country impacts/sites for All GCC view
          const impacts = isAllGCC
            ? Object.values(MAP_CONFIGS).flatMap((mc, ci) => (mc.impacts || []).map(imp => ({ ...imp, id: `${ci}-${imp.id}`, _country: COUNTRY_CONFIG[ci]?.flag })))
            : (mapConf.impacts || []);
          const sites = isAllGCC
            ? Object.values(MAP_CONFIGS).flatMap((mc, ci) => (mc.strategicSites || []).map(s => ({ ...s, id: `${ci}-${s.id}` })))
            : (mapConf.strategicSites || []);
          // Merge all regions for All GCC using raw pts re-projected to GCC bounds
          const allGCCRegions = isAllGCC
            ? Object.values(MAP_CONFIGS).flatMap(mc =>
                (mc.regions || []).map(r => ({
                  ...r,
                  path: "M" + r.pts.map(([lat,lng]) => { const {x,y} = proj(lat,lng); return `${x},${y}`; }).join(" L") + " Z",
                }))
              )
            : [];
          const regions = isAllGCC ? allGCCRegions : (selectedCountry === "uae" ? UAE_EMIRATES : (mapConf.regions || []));
          const isUAE = selectedCountry === "uae" && !isAllGCC;
          // Generate region paths dynamically for non-UAE
          const regionPaths = isUAE ? regions : regions.map(r => ({
            ...r,
            path: "M" + r.pts.map(([lat,lng]) => { const {x,y} = proj(lat,lng); return `${x},${y}`; }).join(" L") + " Z",
          }));
          const bnd = mapConf.bounds;
          const lngTicks = [];
          for (let lng = Math.ceil(bnd.lngMin); lng <= Math.floor(bnd.lngMax); lng++) lngTicks.push(lng);
          const latTicks = [];
          for (let lat = Math.ceil(bnd.latMin); lat <= Math.floor(bnd.latMax); lat++) latTicks.push(lat);
          const directHits = impacts.filter(i => i.type === "drone_hit").length;
          const debrisHits = impacts.filter(i => i.type === "debris").length;
          const withCasualties = impacts.filter(i => i.casualties !== "None");
          const totalKIA = withCasualties.reduce((s, i) => { const m = i.casualties.match(/(\d+)\s*killed/); return s + (m ? +m[1] : 0); }, 0);
          const totalWIA = withCasualties.reduce((s, i) => { const m = i.casualties.match(/(\d+)\s*injured/); return s + (m ? +m[1] : 0); }, 0);
          const uniqueRegions = [...new Set(impacts.map(i => i.region))];
          return (
          <div>
            <div style={{ position: "relative", background: MAP_BG, border: `1px solid ${MAP_BORDER_COLOR}`, borderRadius: 12, overflow: "hidden" }}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.3 : 0.3;
                setMapZoom(z => Math.min(5, Math.max(1, z + delta)));
              }}
              onMouseDown={(e) => {
                if (mapZoom > 1) {
                  setIsDragging(true);
                  setDragStart({ x: e.clientX - mapPan.x, y: e.clientY - mapPan.y });
                }
              }}
              onMouseMove={(e) => {
                if (isDragging) {
                  setMapPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {/* Zoom controls */}
              <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <button onClick={() => setMapZoom(z => Math.min(5, z + 0.5))} style={{ background: "#0D1525", border: `1px solid ${MAP_BORDER_COLOR}`, color: TEXT, width: 28, height: 28, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <button onClick={() => setMapZoom(z => Math.max(1, z - 0.5))} style={{ background: "#0D1525", border: `1px solid ${MAP_BORDER_COLOR}`, color: TEXT, width: 28, height: 28, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                <button onClick={() => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); }} style={{ background: "#0D1525", border: `1px solid ${MAP_BORDER_COLOR}`, color: SUBTEXT, width: 28, height: 28, borderRadius: 4, cursor: "pointer", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>RST</button>
              </div>
              {mapZoom > 1 && <div style={{ position: "absolute", bottom: 8, left: 12, zIndex: 10, fontSize: 9, color: SUBTEXT, fontFamily: "monospace" }}>{mapZoom.toFixed(1)}x — drag to pan</div>}
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", height: "auto", display: "block", cursor: mapZoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}>
                <defs>
                  <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={MAP_GRID} strokeWidth="0.5" opacity="0.4" />
                  </pattern>
                  <pattern id="scanLines" width="4" height="4" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="4" y2="0" stroke="#0A3060" strokeWidth="0.5" opacity="0.15" />
                  </pattern>
                  <filter id="glowRed" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor={DRONE_HIT} floodOpacity="0.6" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="glowOrange" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor={DEBRIS_HIT} floodOpacity="0.6" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <style>{`
                    @keyframes pulse { 0% { r: 5; opacity: 0.8; } 100% { r: 18; opacity: 0; } }
                    @keyframes pulseFast { 0% { r: 5; opacity: 0.9; } 100% { r: 24; opacity: 0; } }
                    .pulse-ring { animation: pulse 2s ease-out infinite; }
                    .pulse-ring-fast { animation: pulseFast 1.4s ease-out infinite; }
                  `}</style>
                </defs>

                <g transform={`translate(${mapPan.x / (SVG_W / 800) + SVG_W / 2 * (1 - mapZoom)}, ${mapPan.y / (SVG_H / 500) + SVG_H / 2 * (1 - mapZoom)}) scale(${mapZoom})`}>
                {/* Base: dark sea for All GCC, dark bg for single country */}
                <rect width={SVG_W} height={SVG_H} fill={isAllGCC ? "#040810" : MAP_BG} />
                {isAllGCC && <rect width={SVG_W} height={SVG_H} fill="#061020" opacity="0.8" />}
                <rect width={SVG_W} height={SVG_H} fill="url(#mapGrid)" />
                <rect width={SVG_W} height={SVG_H} fill="url(#scanLines)" />

                {/* Background geography (All GCC only): surrounding countries in grey/muted */}
                {isAllGCC && Object.entries(GCC_GEOGRAPHY).map(([key, geo]) => {
                  const geoPath = "M" + geo.pts.map(([lat,lng]) => { const {x,y} = proj(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
                  return <g key={key}>
                    <path d={geoPath} fill={geo.color} stroke="#1A2840" strokeWidth="0.8" opacity="0.95" />
                    {geo.name && geo.labelLat && (() => {
                      const { x, y } = proj(geo.labelLat, geo.labelLng);
                      return <text x={x} y={y} fill="#334466" fontSize={key === "iran" ? "10" : "8"} fontFamily="monospace" textAnchor="middle" fontWeight="600" letterSpacing="2">{geo.name}</text>;
                    })()}
                  </g>;
                })}

                {/* Covered country regions (GCC members) */}
                {regionPaths.map((e, i) => (
                  <path key={`${e.name}-${i}`} d={e.path} fill={isAllGCC ? "#0F2038" : MAP_LAND} stroke={isAllGCC ? "#1E4060" : MAP_BORDER_COLOR} strokeWidth={isAllGCC ? "1.5" : "1.2"} opacity="0.95" />
                ))}

                {/* Region labels */}
                {regionPaths.filter(e => e.labelLat > 0).map((e, i) => {
                  const { x, y } = proj(e.labelLat, e.labelLng);
                  return <text key={`lbl-${e.name}-${i}`} x={x} y={y} fill={isAllGCC ? "#4488BB" : "#2A4A70"} fontSize={isAllGCC ? "6" : "7"} fontFamily="monospace" textAnchor="middle" fontWeight="600" letterSpacing="1.5">{e.name}</text>;
                })}

                {/* Coordinate ticks */}
                {lngTicks.map(lng => {
                  const { x } = proj(bnd.latMin, lng);
                  return <g key={`lng-${lng}`}>
                    <line x1={x} y1={SVG_H - 12} x2={x} y2={SVG_H} stroke="#1A3050" strokeWidth="0.5" />
                    <text x={x} y={SVG_H - 3} fill="#1A3050" fontSize="6" fontFamily="monospace" textAnchor="middle">{lng}°E</text>
                  </g>;
                })}
                {latTicks.map(lat => {
                  const { y } = proj(lat, bnd.lngMin);
                  return <g key={`lat-${lat}`}>
                    <line x1={0} y1={y} x2={12} y2={y} stroke="#1A3050" strokeWidth="0.5" />
                    <text x={14} y={y + 2} fill="#1A3050" fontSize="6" fontFamily="monospace">{lat}°N</text>
                  </g>;
                })}

                {/* Impact markers */}
                {impacts.map(loc => {
                  const { x, y } = proj(loc.lat, loc.lng);
                  const color = loc.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT;
                  const hasCasualties = loc.casualties !== "None";
                  const filterId = loc.type === "drone_hit" ? "glowRed" : "glowOrange";
                  return (
                    <g key={loc.id}
                      onMouseEnter={() => setHoveredImpact(loc)}
                      onMouseLeave={() => setHoveredImpact(null)}
                      onClick={() => setSelectedImpact(selectedImpact?.id === loc.id ? null : loc)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx={x} cy={y} fill="none" stroke={color} strokeWidth="1.5"
                        className={hasCasualties ? "pulse-ring-fast" : "pulse-ring"} />
                      <circle cx={x} cy={y} r="4" fill={color} filter={`url(#${filterId})`} />
                      <circle cx={x} cy={y} r="1.5" fill="#fff" opacity="0.8" />
                    </g>
                  );
                })}

                {/* Map title overlay */}
                <text x="16" y="22" fill={themeAccent} fontSize="10" fontFamily="monospace" fontWeight="700" letterSpacing="2">{mapConf.title}</text>
                <text x="16" y="34" fill="#2A5A80" fontSize="7" fontFamily="monospace">{mapConf.subtitle} • FEB 28, 2026 –</text>

                {/* Legend */}
                <g transform={`translate(${SVG_W - 170}, 16)`}>
                  <rect x="-8" y="-8" width="165" height={showStrategicSites ? 68 : 50} rx="4" fill="#060A14" fillOpacity="0.85" stroke={MAP_BORDER_COLOR} strokeWidth="0.5" />
                  <circle cx="6" cy="6" r="4" fill={DRONE_HIT} />
                  <text x="16" y="9" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Direct drone/missile hit</text>
                  <circle cx="6" cy="22" r="4" fill={DEBRIS_HIT} />
                  <text x="16" y="25" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Debris / shrapnel</text>
                  <circle cx="6" cy="38" r="3" fill="none" stroke={DRONE_HIT} strokeWidth="1" className="pulse-ring-fast" />
                  <circle cx="6" cy="38" r="2" fill={DRONE_HIT} />
                  <text x="16" y="41" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Casualties reported</text>
                  {showStrategicSites && <>
                    <polygon points="6,50 10,54 6,58 2,54" fill={STRATEGIC_BLUE} />
                    <text x="16" y="57" fill="#AAB8CC" fontSize="7" fontFamily="monospace">Military / diplomatic site</text>
                  </>}
                </g>

                {/* Strategic sites */}
                {showStrategicSites && sites.map(site => {
                  const { x, y } = proj(site.lat, site.lng);
                  const isSelected = selectedSite?.id === site.id;
                  return (
                    <g key={site.id}
                      onClick={() => setSelectedSite(isSelected ? null : site)}
                      style={{ cursor: "pointer" }}
                    >
                      <polygon points={`${x},${y-6} ${x+5},${y} ${x},${y+6} ${x-5},${y}`} fill={isSelected ? "#fff" : STRATEGIC_BLUE} opacity={isSelected ? 1 : 0.85} />
                      <polygon points={`${x},${y-6} ${x+5},${y} ${x},${y+6} ${x-5},${y}`} fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
                    </g>
                  );
                })}
                </g>
              </svg>

              {/* Hover tooltip */}
              {hoveredImpact && (() => {
                const { x, y } = proj(hoveredImpact.lat, hoveredImpact.lng);
                const pctX = (x / SVG_W) * 100;
                const pctY = (y / SVG_H) * 100;
                const color = hoveredImpact.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT;
                return (
                  <div style={{
                    position: "absolute", left: `${pctX}%`, top: `${pctY}%`,
                    transform: `translate(${pctX > 70 ? "-110%" : "10%"}, -50%)`,
                    background: "#0B1420", border: `1px solid ${color}`, borderRadius: 6,
                    padding: "10px 14px", pointerEvents: "none", zIndex: 10,
                    minWidth: 180, boxShadow: `0 0 20px ${color}33`
                  }}>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                      {hoveredImpact.name}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#8899BB", lineHeight: 1.6 }}>
                      <div>TYPE: {hoveredImpact.type === "drone_hit" ? "DIRECT HIT" : "DEBRIS/SHRAPNEL"}</div>
                      <div>DATE: {hoveredImpact.date.toUpperCase()}</div>
                      <div>REGION: {(hoveredImpact.region || hoveredImpact.emirate || "").toUpperCase()}</div>
                      <div style={{ color: hoveredImpact.casualties !== "None" ? "#E74C3C" : "#556677" }}>
                        CASUALTIES: {hoveredImpact.casualties.toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Selected strategic site tooltip */}
              {selectedSite && (() => {
                const { x, y } = proj(selectedSite.lat, selectedSite.lng);
                const pctX = (x / SVG_W) * 100;
                const pctY = (y / SVG_H) * 100;
                return (
                  <div style={{
                    position: "absolute", left: `${pctX}%`, top: `${pctY}%`,
                    transform: `translate(${pctX > 60 ? "-110%" : "10%"}, -50%)`,
                    background: "#0B1420", border: `1px solid ${STRATEGIC_BLUE}`, borderRadius: 6,
                    padding: "10px 14px", zIndex: 10,
                    minWidth: 200, boxShadow: `0 0 20px ${STRATEGIC_BLUE}33`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: STRATEGIC_BLUE, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                        {selectedSite.name}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedSite(null); }} style={{ background: "none", border: `1px solid ${BORDER}`, color: SUBTEXT, borderRadius: 4, padding: "1px 6px", cursor: "pointer", fontSize: 8 }}>X</button>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#8899BB", lineHeight: 1.6 }}>
                      <div>TYPE: {selectedSite.type.toUpperCase()}</div>
                      <div>COORDS: {selectedSite.lat.toFixed(4)}°N, {selectedSite.lng.toFixed(4)}°E</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Selected impact detail panel */}
            {selectedImpact && (
              <div style={{
                marginTop: 12, background: "#0B1420", border: `1px solid ${selectedImpact.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT}`,
                borderRadius: 8, padding: "14px 20px", fontFamily: "monospace"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: themeAccent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>INTEL BRIEFING — IMPACT SITE #{selectedImpact.id}</span>
                  <button onClick={() => setSelectedImpact(null)} style={{ background: "none", border: `1px solid ${BORDER}`, color: SUBTEXT, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>CLOSE</button>
                </div>
                <div style={{ fontSize: 13, color: "#33CC77", fontWeight: 700, marginBottom: 6 }}>{selectedImpact.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, fontSize: 9, color: "#8899BB" }}>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>WEAPON</div><div style={{ color: TEXT }}>{selectedImpact.type === "drone_hit" ? "Drone / missile" : "Shrapnel / debris"}</div></div>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>DATE</div><div style={{ color: TEXT }}>{selectedImpact.date}</div></div>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>REGION</div><div style={{ color: TEXT }}>{selectedImpact.region || selectedImpact.emirate}</div></div>
                  <div><div style={{ color: "#556677", marginBottom: 2 }}>CASUALTIES</div><div style={{ color: selectedImpact.casualties !== "None" ? "#E74C3C" : TEXT }}>{selectedImpact.casualties}</div></div>
                </div>
                <div style={{ fontSize: 9, color: "#556677", marginTop: 8 }}>
                  COORDS: {selectedImpact.lat.toFixed(4)}°N, {selectedImpact.lng.toFixed(4)}°E
                </div>
              </div>
            )}

            {/* Strategic sites toggle */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: SUBTEXT, fontFamily: "monospace" }}>
                <input type="checkbox" checked={showStrategicSites} onChange={(e) => setShowStrategicSites(e.target.checked)}
                  style={{ accentColor: STRATEGIC_BLUE }} />
                Show military / diplomatic sites
              </label>
            </div>

            {/* Info strip */}
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <StatCard label="Impact Sites" value={impacts.length} sub="Confirmed locations" color={DRONE_HIT} />
              <StatCard label="Regions Hit" value={uniqueRegions.length} sub={uniqueRegions.slice(0, 3).join(", ")} color={DEBRIS_HIT} />
              <StatCard label="Direct Hits" value={directHits} sub="Drone / missile strikes" color={DRONE_HIT} />
              <StatCard label="Debris Impacts" value={debrisHits} sub="Shrapnel / interception debris" color={DEBRIS_HIT} />
              {totalKIA > 0 && <StatCard label="KIA" value={totalKIA} sub="" color="#E74C3C" />}
              {totalWIA > 0 && <StatCard label="WIA" value={totalWIA} sub="" color="#E67E22" />}
            </div>
          </div>
        ); })()}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Pie chart */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>All Projectiles — Final Outcome</h3>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                    dataKey="value" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    labelLine={{ stroke: SUBTEXT, strokeWidth: 1 }} fontSize={11} fill={TEXT}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown bar */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Totals by Category</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={finalTotals} layout="vertical" barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                  <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="detected" name="Detected" fill="#1A3A5C" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="intercepted" name="Intercepted" fill={INTERCEPTED} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="impacted" name="Impacted Territory" fill={IMPACTED} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Interception rates */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Interception Rate by Category (%)</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rateData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, "Rate"]} />
                  <Bar dataKey="rate" name="Interception Rate" radius={[4, 4, 0, 0]}>
                    {rateData.map((entry, i) => (
                      <Cell key={i} fill={entry.rate === 100 ? UAE_GOLD : INTERCEPTED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TRENDS TAB */}
        {activeTab === "trends" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Incoming by Category + Total</h3>
              <p style={{ margin: "0 0 24px", fontSize: 11, color: SUBTEXT }}>Projectiles detected per day — all categories tracked individually alongside total</p>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    {["total","ballistic","drones","cruise"].map((k, i) => (
                      <filter key={k} id={`glow-${k}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={{ stroke: BORDER }} tickLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />

                  {/* Total — thick white, prominent */}
                  <Line
                    type="monotone" dataKey="total" name="Total (All)"
                    stroke="#FFFFFF" strokeWidth={3} strokeDasharray="6 3"
                    dot={{ fill: "#FFFFFF", r: 6, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 8, fill: "#FFFFFF" }}
                  />
                  {/* Drones */}
                  <Line
                    type="monotone" dataKey="drones" name="Drones (UAVs)"
                    stroke={UAE_GOLD} strokeWidth={2}
                    dot={{ fill: UAE_GOLD, r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Ballistic */}
                  <Line
                    type="monotone" dataKey="ballistic" name="Ballistic Missiles"
                    stroke="#4DA6FF" strokeWidth={2}
                    dot={{ fill: "#4DA6FF", r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Cruise */}
                  <Line
                    type="monotone" dataKey="cruise" name="Cruise Missiles"
                    stroke="#E74C3C" strokeWidth={2}
                    dot={{ fill: "#E74C3C", r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Annotation cards below */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {trendData.map((d, i) => (
                <div key={i} style={{
                  background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                  padding: "14px 16px",
                  borderTop: `3px solid ${i === 0 ? IMPACTED : i === 4 ? INTERCEPTED : BORDER}`
                }}>
                  <div style={{ fontSize: 11, color: UAE_GOLD, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{d.day}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, fontFamily: "Georgia, serif" }}>{d.total}</div>
                  <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 8 }}>total incoming</div>
                  <div style={{ fontSize: 10, color: "#4DA6FF" }}>🚀 {d.ballistic} ballistic</div>
                  <div style={{ fontSize: 10, color: UAE_GOLD }}>🚁 {d.drones} drones</div>
                  {d.cruise > 0 && <div style={{ fontSize: 10, color: "#E74C3C" }}>✈️ {d.cruise} cruise</div>}
                  {i === 0 && <div style={{ fontSize: 9, color: IMPACTED, marginTop: 6, fontWeight: 600 }}>⚠️ Peak day</div>}
                  {i === 4 && <div style={{ fontSize: 9, color: INTERCEPTED, marginTop: 6, fontWeight: 600 }}>↓ Lowest total</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAILY TAB */}
        {activeTab === "daily" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Ballistic Missiles</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Detected per day — attack intensity declining</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ballisticIntercepted" name="Intercepted" fill={INTERCEPTED} radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="ballisticSea" name="Fell in Sea" fill={SEA} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Drones (UAVs)</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Intercepted vs impacted territory</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="droneIntercepted" name="Intercepted" fill={INTERCEPTED} radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="droneImpact" name="Impacted Territory" fill={IMPACTED} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Total Daily Incoming (All Categories)</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Ballistic missiles + drones + cruise missiles per day</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorBallistic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2980B9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2980B9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDrones" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={UAE_GOLD} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={UAE_GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="ballistic" name="Ballistic Missiles" stroke="#2980B9" fill="url(#colorBallistic)" strokeWidth={2} />
                  <Area type="monotone" dataKey="drones" name="Drones" stroke={UAE_GOLD} fill="url(#colorDrones)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CUMULATIVE TAB */}
        {activeTab === "cumulative" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Running Total — Detected vs Intercepted</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Gap between lines = projectiles that reached/hit territory or sea</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="gradDetected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2980B9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2980B9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradIntercepted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={INTERCEPTED} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={INTERCEPTED} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="totalDetected" name="Total Detected" stroke="#2980B9" fill="url(#gradDetected)" strokeWidth={2} dot={{ fill: "#2980B9", r: 4 }} />
                  <Area type="monotone" dataKey="totalIntercepted" name="Total Intercepted" stroke={INTERCEPTED} fill="url(#gradIntercepted)" strokeWidth={2} dot={{ fill: INTERCEPTED, r: 4 }} />
                  <Area type="monotone" dataKey="impacted" name="Impacted Territory" stroke={IMPACTED} fill="none" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: IMPACTED, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Cumulative Impacted Territory</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Projectiles that penetrated UAE airspace and landed</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cumulativeData} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="impacted" name="Cumulative Impacted" radius={[4, 4, 0, 0]}>
                    {cumulativeData.map((_, i) => (
                      <Cell key={i} fill={`rgba(192, 57, 43, ${0.4 + i * 0.13})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* RATES TAB */}
        {activeTab === "rates" && !isAllGCC && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {[
              n(cumulative.ballisticDetected) > 0 && { label: "Ballistic Missiles", intercepted: n(cumulative.ballisticIntercepted), total: n(cumulative.ballisticDetected), rate: rateData.find(r => r.category.includes("Ballistic"))?.rate, color: "#2980B9" },
              n(cumulative.cruiseDetected) > 0 && { label: "Cruise Missiles", intercepted: n(cumulative.cruiseIntercepted), total: n(cumulative.cruiseDetected), rate: rateData.find(r => r.category.includes("Cruise"))?.rate, color: UAE_GOLD },
              n(cumulative.dronesDetected) > 0 && { label: "Drones (UAVs)", intercepted: n(cumulative.dronesIntercepted), total: n(cumulative.dronesDetected), rate: rateData.find(r => r.category === "Drones")?.rate, color: INTERCEPTED },
              { label: "Overall", intercepted: totalIntercepted, total: totalDetected, rate: overallRate, color: "#9B59B6" },
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 12, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: item.color, fontFamily: "Georgia, serif", lineHeight: 1 }}>{item.rate != null ? `${item.rate}%` : "N/A"}</div>
                <div style={{ fontSize: 11, color: SUBTEXT, marginTop: 6 }}>interception rate</div>
                <div style={{ marginTop: 16, background: "#0A0F1E", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.rate || 0}%`, background: item.color, borderRadius: 6, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: SUBTEXT }}>
                  <span>✅ {item.intercepted.toLocaleString()} intercepted</span>
                  <span>📡 {item.total.toLocaleString()} detected</span>
                </div>
              </div>
            ))}

            {/* Interceptors Used Per Day */}
            <div style={{ gridColumn: "1 / -1", background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Interceptors Used Per Day</h3>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: SUBTEXT }}>Actual targets intercepted vs estimated interceptor missiles expended</p>
              <p style={{ margin: "0 0 16px", fontSize: 10, color: "#556677", fontStyle: "italic" }}>Estimated — based on standard engagement doctrine (ballistic: 2 per target, cruise: 1.5, drone: 1)</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={interceptorData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="intercepted" name="Targets Intercepted" fill={INTERCEPTED} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="estimatedUsed" name="Est. Interceptors Used" fill="#9B59B6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: "#556677", marginTop: 8 }}>
                Sources: shoot-look-shoot doctrine averages — ballistic (2 interceptors/target), cruise (1.5), drones (1)
              </div>
            </div>
          </div>
        )}

        {/* ARSENAL & DEFENCE TAB */}
        {activeTab === "arsenal" && (() => {
          const attackSystems = [
            {
              name: "Ballistic Missiles", sub: "MRBM", color: "#4DA6FF",
              img: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Kheibar_Shekan_%281%29.jpg",
              desc: "High-speed projectiles arcing through the upper atmosphere. Iran's most destructive but costly weapon.",
              types: "Kheibar Shekan, Emad, Fattah-1/2, Ghadr, Sejjil",
              speed: 8500, range: 2500, warhead: 1500, cost: 2750, altitude: 150,
              costLabel: "$500K–$5M", speedLabel: "Mach 7–13+", rangeLabel: "1,300–2,500km", altLabel: "150–1,000km",
            },
            {
              name: "Cruise Missiles", sub: "Subsonic Strike", color: "#E74C3C",
              img: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Hoveyzeh_cruise_missile.jpg",
              desc: "Jet-powered, low-altitude terrain-huggers that evade radar. Slower but stealthier.",
              types: "Paveh, Hoveyzeh, Soumar",
              speed: 900, range: 2000, warhead: 400, cost: 750, altitude: 0.05,
              costLabel: "$500K–$1M", speedLabel: "~900 km/h", rangeLabel: "1,350–2,500km", altLabel: "~50m",
            },
            {
              name: "Suicide Drones", sub: "Loitering Munitions", color: UAE_GOLD,
              img: "https://upload.wikimedia.org/wikipedia/commons/e/ef/2023_IRGC_Aerospace_Force_achievements_Exhibition_in_Kermanshah_%28018%29.jpg",
              desc: "Cheap GPS-guided kamikaze drones in massive swarms. Designed to exhaust expensive interceptor stocks.",
              types: "Shahed-136, Shahed-131, Mohajer-6",
              speed: 185, range: 2000, warhead: 50, cost: 35, altitude: 4,
              costLabel: "$20K–$50K", speedLabel: "~185 km/h", rangeLabel: "900–2,000km", altLabel: "1–4km",
            },
          ];
          const defenceSystems = [
            {
              name: "THAAD", maker: "Lockheed Martin (US)", color: "#4DA6FF",
              img: "https://upload.wikimedia.org/wikipedia/commons/4/45/The_first_of_two_Terminal_High_Altitude_Area_Defense_%28THAAD%29_interceptors_is_launched_during_a_successful_intercept_test_-_US_Army.jpg",
              target: "Ballistic missiles", altitude: 150, range: 200, cost: 12,
              costLabel: "$12M", desc: "Exo-atmospheric hit-to-kill. Sonic booms heard 100km away.",
            },
            {
              name: "Patriot PAC-3", maker: "Raytheon (US)", color: INTERCEPTED,
              img: "https://upload.wikimedia.org/wikipedia/commons/f/f8/Patriot_missile_launch_b.jpg",
              target: "Ballistic + cruise", altitude: 40, range: 35, cost: 4,
              costLabel: "$4–12M", desc: "Gulf workhorse. Lower-tier terminal phase interceptor.",
            },
            {
              name: "Cheongung-II", maker: "LIG Nex1 (South Korea)", color: "#9B59B6",
              img: "https://upload.wikimedia.org/wikipedia/commons/d/d1/M-SAM_Block-2_battery.jpg",
              target: "Medium-range threats", altitude: 20, range: 40, cost: 2.5,
              costLabel: "$2–3M", desc: "First-ever combat use. $3.5B UAE deal — proved itself here.",
            },
            {
              name: "Barak MX", maker: "IAI (Israel)", color: "#E67E22",
              img: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Salon_du_Bourget_20090619_077.jpg",
              target: "Multi-layer", altitude: 30, range: 150, cost: 1,
              costLabel: "~$1M", desc: "Modular system via Abraham Accords. Drones to ballistic.",
            },
          ];
          const comparisonData = [
            { metric: "Speed", ballistic: 100, cruise: 10.6, drone: 2.2 },
            { metric: "Range", ballistic: 100, cruise: 80, drone: 80 },
            { metric: "Altitude", ballistic: 100, cruise: 0.005, drone: 0.4 },
            { metric: "Warhead", ballistic: 100, cruise: 26.7, drone: 3.3 },
            { metric: "Cost", ballistic: 100, cruise: 27.3, drone: 1.3 },
          ];
          const defenceCompData = defenceSystems.map(s => ({
            name: s.name, altitude: s.altitude, range: s.range, cost: s.cost,
          }));
          return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>

            {/* ATTACK SYSTEMS — image cards */}
            <h3 style={{ margin: 0, fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Iranian Attack Systems</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {attackSystems.map((w, i) => (
                <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", borderTop: `3px solid ${w.color}` }}>
                  <div style={{ height: 160, overflow: "hidden", position: "relative" }}>
                    <img src={w.img} alt={w.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 16px 12px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: w.color, fontFamily: "Georgia, serif" }}>{w.name}</div>
                      <div style={{ fontSize: 9, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 1 }}>{w.sub}</div>
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px 16px" }}>
                    <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 10 }}>{w.desc}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 10 }}>Types: {w.types}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, textAlign: "center" }}>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.speedLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>SPEED</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.altLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>FLIGHT ALTITUDE</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.rangeLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>RANGE</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 6, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.costLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>COST/UNIT</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ATTACK COMPARISON CHART */}
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Attack Systems — Comparison</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Relative capability across speed, range, warhead, and cost (normalised to highest)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v.toFixed(1)}%`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ballistic" name="Ballistic" fill="#4DA6FF" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cruise" name="Cruise" fill="#E74C3C" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="drone" name="Drone" fill={UAE_GOLD} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* DEFENCE SYSTEMS — image cards */}
            <h3 style={{ margin: "8px 0 0", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>UAE / Allied Defence Systems</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
              {defenceSystems.map((s, i) => (
                <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", borderTop: `3px solid ${s.color}` }}>
                  <div style={{ height: 120, overflow: "hidden", position: "relative" }}>
                    <img src={s.img} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.65)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 12px 8px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: "Georgia, serif" }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: SUBTEXT }}>{s.maker}</div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px 14px" }}>
                    <div style={{ fontSize: 10, color: UAE_GOLD, fontWeight: 600, marginBottom: 6 }}>{s.target}</div>
                    <div style={{ fontSize: 10, color: TEXT, lineHeight: 1.4, marginBottom: 8 }}>{s.desc}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, textAlign: "center" }}>
                      <div style={{ background: "#0A0F1E", borderRadius: 5, padding: "6px 4px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.altitude}km</div>
                        <div style={{ fontSize: 7, color: SUBTEXT }}>ALTITUDE</div>
                      </div>
                      <div style={{ background: "#0A0F1E", borderRadius: 5, padding: "6px 4px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: IMPACTED }}>{s.costLabel}</div>
                        <div style={{ fontSize: 7, color: SUBTEXT }}>PER SHOT</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DEFENCE COMPARISON CHARTS */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>Intercept Altitude (km)</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Maximum engagement altitude per system</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={defenceCompData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}km`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}km`, "Altitude"]} />
                    <Bar dataKey="altitude" name="Max Altitude" radius={[0, 4, 4, 0]}>
                      {defenceCompData.map((_, j) => <Cell key={j} fill={defenceSystems[j].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Interceptor Cost ($M)</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Cost per single interceptor missile</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={defenceCompData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, "Cost"]} />
                    <Bar dataKey="cost" name="Interceptor Cost" radius={[0, 4, 4, 0]}>
                      {defenceCompData.map((_, j) => <Cell key={j} fill={IMPACTED} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* COST ASYMMETRY */}
            {(() => {
              const AVG_BALLISTIC_COST = 2.75;
              const AVG_CRUISE_COST = 0.75;
              const AVG_DRONE_COST = 0.035;
              const AVG_BALLISTIC_INTERCEPT = 8;
              const AVG_CRUISE_INTERCEPT = 2.5;
              const AVG_DRONE_INTERCEPT = 2.5;
              const daily = rawData.daily || [];
              let cumAtk = 0, cumDef = 0;
              const costTimeline = daily.map(d => {
                const atkDay = n(d.ballisticDetected) * AVG_BALLISTIC_COST + n(d.cruiseDetected) * AVG_CRUISE_COST + n(d.dronesDetected) * AVG_DRONE_COST;
                const defDay = n(d.ballisticIntercepted) * AVG_BALLISTIC_INTERCEPT + n(d.cruiseIntercepted) * AVG_CRUISE_INTERCEPT + n(d.dronesIntercepted) * AVG_DRONE_INTERCEPT;
                cumAtk += atkDay;
                cumDef += defDay;
                return { day: d.label, atkDay: Math.round(atkDay), defDay: Math.round(defDay), cumAtk: Math.round(cumAtk), cumDef: Math.round(cumDef) };
              });
              const perUnitData = [
                { name: "Ballistic\nMissile", attack: AVG_BALLISTIC_COST, defence: AVG_BALLISTIC_INTERCEPT },
                { name: "Cruise\nMissile", attack: AVG_CRUISE_COST, defence: AVG_CRUISE_INTERCEPT },
                { name: "Drone", attack: AVG_DRONE_COST, defence: AVG_DRONE_INTERCEPT },
              ];
              return (
              <>
              <h3 style={{ margin: "8px 0 0", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cost Asymmetry</h3>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[
                  { label: "Drones", atk: "$20K–$50K", atkC: UAE_GOLD, def: "$1M–$4M", ratio: "20:1 — 200:1" },
                  { label: "Ballistic", atk: "$0.5M–$5M", atkC: "#4DA6FF", def: "$4M–$12M", ratio: "4:1 — 12:1" },
                  { label: "Total (5 days)", atk: `~$${costTimeline[costTimeline.length-1]?.cumAtk}M`, atkC: UAE_GOLD, def: `~$${(costTimeline[costTimeline.length-1]?.cumDef/1000).toFixed(1)}B`, ratio: "~$1B/day" },
                ].map((c, i) => (
                  <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, textAlign: "center", padding: 16 }}>
                    <div style={{ fontSize: 10, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>Attack: <span style={{ color: c.atkC, fontWeight: 700 }}>{c.atk}</span></div>
                    <div style={{ fontSize: 11, color: TEXT, marginBottom: 8 }}>Defence: <span style={{ color: IMPACTED, fontWeight: 700 }}>{c.def}</span></div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: IMPACTED, fontFamily: "Georgia, serif" }}>{c.ratio}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT }}>{i < 2 ? "cost disadvantage for defenders" : "estimated UAE daily defence cost"}</div>
                  </div>
                ))}
              </div>

              {/* Per-unit cost comparison */}
              <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cost per Unit: Attack vs Defence ($M)</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Average cost to launch one projectile vs cost to intercept it</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={perUnitData} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                    <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="attack" name="Iran (Attack)" fill={UAE_GOLD} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="defence" name="UAE (Defence)" fill={IMPACTED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Daily cost comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Daily Cost: Attack vs Defence ($M)</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Estimated spend per day by each side</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={costTimeline} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                      <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="atkDay" name="Iran (Attack)" fill={UAE_GOLD} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="defDay" name="UAE (Defence)" fill={IMPACTED} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>Cumulative Cost Over Time ($M)</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>Running total — the widening gap between attack and defence spending</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={costTimeline}>
                      <defs>
                        <linearGradient id="gradAtk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={UAE_GOLD} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={UAE_GOLD} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradDef" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={IMPACTED} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={IMPACTED} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(1)}B` : `$${v}M`} />
                      <Tooltip content={<CustomTooltip />} formatter={(v) => [v >= 1000 ? `$${(v/1000).toFixed(2)}B` : `$${v}M`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="cumAtk" name="Iran (Cumulative)" stroke={UAE_GOLD} fill="url(#gradAtk)" strokeWidth={2} dot={{ fill: UAE_GOLD, r: 4 }} />
                      <Area type="monotone" dataKey="cumDef" name="UAE (Cumulative)" stroke={IMPACTED} fill="url(#gradDef)" strokeWidth={2} dot={{ fill: IMPACTED, r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              </>
              );
            })()}

          </div>
          );
        })()}
      </div>

      <div style={{ textAlign: "center", marginTop: 32, fontSize: 10, color: "#3A4A60" }}>
        Data sourced from official GCC Ministry of Defence statements • Feb 28, 2026 –
        <br />
        <a href="https://github.com/takahser/uae-dashboard" target="_blank" rel="noopener noreferrer"
          style={{ color: "#3A4A60", textDecoration: "none", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          GitHub
        </a>
      </div>
    </div>
  );
}
