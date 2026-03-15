import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, ReferenceLine,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { createT } from "./i18n";

const UAE_GREEN = "#00732F";
const UAE_GOLD = "#F59E0B";

// Glassmorphism design tokens
const GLASS_BG = "rgba(255,255,255,0.03)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.07)";
const GLASS_BLUR = "blur(40px)";
const GLASS_RADIUS = 16;
const DM_SANS = "'DM Sans', -apple-system, sans-serif";

const COUNTRY_CONFIG = [
  { code: "uae", name: "UAE", flag: "\u{1F1E6}\u{1F1EA}", file: "data-uae.json", color: "#00732F", accent: "#F59E0B", source: "@modgovae" },
  { code: "qatar", name: "Qatar", flag: "\u{1F1F6}\u{1F1E6}", file: "data-qatar.json", color: "#8A1538", accent: "#FFFFFF", source: "@MOD_Qatar" },
  { code: "kuwait", name: "Kuwait", flag: "\u{1F1F0}\u{1F1FC}", file: "data-kuwait.json", color: "#007A3D", accent: "#CE1126", source: "@MOD_KW" },
  { code: "bahrain", name: "Bahrain", flag: "\u{1F1E7}\u{1F1ED}", file: "data-bahrain.json", color: "#CE1126", accent: "#FFFFFF", source: "@BDF_Bahrain" },
  { code: "oman", name: "Oman", flag: "\u{1F1F4}\u{1F1F2}", file: "data-oman.json", color: "#DB161B", accent: "#008000", source: "@MOD_Oman" },
  { code: "saudi", name: "Saudi Arabia", flag: "\u{1F1F8}\u{1F1E6}", file: "data-saudi.json", color: "#006C35", accent: "#FFFFFF", source: "@SPA_English" },
  { code: "israel", name: "Israel", flag: "\u{1F1EE}\u{1F1F1}", file: "data-israel.json", color: "#003F87", accent: "#FFFFFF", source: "OSINT", airports: ["TLV"] },
];
const IRAN_CONFIG = { code: "iran", name: "Iran", flag: "\u{1F1EE}\u{1F1F7}", file: "data-iran.json", color: "#EF4444", accent: "#FFFFFF", source: "OSINT" };

const COUNTRY_MAP_DATA = {
  uae: {
    center: [24.0, 54.0], zoom: 7,
    cities: [
      { pos: [24.47, 54.37], name: "Abu Dhabi", type: "capital" },
      { pos: [25.20, 55.27], name: "Dubai", type: "city" },
      { pos: [25.34, 56.36], name: "Khor Fakkan", type: "port" },
      { pos: [25.13, 56.36], name: "Fujairah", type: "port" },
      { pos: [24.98, 55.07], name: "Jebel Ali Port", type: "port" },
    ],
    attacks: [
      { pos: [24.43, 54.65], label: "Ballistic missile intercept — Ruwais industrial zone" },
      { pos: [24.47, 54.37], label: "Drone intercept over Abu Dhabi" },
      { pos: [25.20, 55.27], label: "Cruise missile intercept — Dubai airspace" },
    ],
  },
  israel: {
    center: [31.5, 34.8], zoom: 7,
    cities: [
      { pos: [31.77, 35.21], name: "Jerusalem", type: "capital" },
      { pos: [32.08, 34.78], name: "Tel Aviv", type: "city" },
      { pos: [32.81, 34.98], name: "Haifa", type: "city" },
      { pos: [29.55, 34.95], name: "Eilat", type: "city" },
    ],
    attacks: [
      { pos: [32.0, 34.88], label: "Ben Gurion — repeated drone threats" },
      { pos: [31.77, 35.21], label: "Jerusalem — rocket intercepts" },
      { pos: [32.81, 34.98], label: "Haifa — drone intercepts" },
    ],
  },
  saudi: {
    center: [24.0, 45.0], zoom: 5,
    cities: [
      { pos: [24.68, 46.72], name: "Riyadh", type: "capital" },
      { pos: [21.49, 39.19], name: "Jeddah", type: "city" },
      { pos: [26.43, 50.10], name: "Dammam", type: "city" },
      { pos: [26.28, 50.20], name: "Aramco Abqaiq", type: "port" },
    ],
    attacks: [
      { pos: [26.28, 50.20], label: "Aramco Abqaiq — previous major attack site" },
      { pos: [24.68, 46.72], label: "Riyadh — ballistic missile intercepts" },
    ],
  },
  kuwait: {
    center: [29.5, 47.8], zoom: 8,
    cities: [
      { pos: [29.37, 47.97], name: "Kuwait City", type: "capital" },
    ],
    attacks: [],
  },
  qatar: {
    center: [25.2, 51.2], zoom: 8,
    cities: [
      { pos: [25.28, 51.53], name: "Doha", type: "capital" },
      { pos: [25.11, 51.33], name: "Al Udeid Air Base", type: "military" },
    ],
    attacks: [],
  },
  bahrain: {
    center: [26.0, 50.5], zoom: 9,
    cities: [
      { pos: [26.21, 50.59], name: "Manama", type: "capital" },
      { pos: [26.04, 50.55], name: "NSA Bahrain (US 5th Fleet)", type: "military" },
    ],
    attacks: [],
  },
};

function CountryMapModal({ countryCode, countryName, flag, onClose }) {
  const data = COUNTRY_MAP_DATA[countryCode];
  if (!data) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,11,26,0.92)", backdropFilter: "blur(12px)", zIndex: 9999, display: "flex", flexDirection: "column" }}>
      <div style={{ background: CARD_BG, borderBottom: GLASS_BORDER, backdropFilter: GLASS_BLUR, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, color: TEXT, fontSize: 20, fontFamily: DM_SANS }}>{flag} {countryName} — Threat Map</h2>
        <button onClick={onClose} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, color: TEXT, padding: "6px 14px", borderRadius: GLASS_RADIUS, cursor: "pointer", fontSize: 14, fontFamily: DM_SANS }}>✕ Close</button>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={data.center} zoom={data.zoom} style={{ height: "100%", width: "100%" }} zoomControl={true}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="© CartoDB" />
          {data.cities.map((c, i) => (
            <CircleMarker key={i} center={c.pos} radius={c.type === "capital" ? 9 : c.type === "military" ? 7 : 6}
              pathOptions={{ color: c.type === "capital" ? "#F59E0B" : c.type === "military" ? "#F59E0B" : c.type === "port" ? "#3B82F6" : "#E8E8ED44", fillOpacity: 0.85 }}>
              <LTooltip permanent direction="top" offset={[0, -8]} opacity={0.9}>
                <span style={{ fontSize: 11 }}>{c.name}</span>
              </LTooltip>
            </CircleMarker>
          ))}
          {data.attacks.map((a, i) => (
            <CircleMarker key={i} center={a.pos} radius={8}
              pathOptions={{ color: "#F87171", fillColor: "#F87171", fillOpacity: 0.7 }}>
              <Popup><span style={{ fontSize: 12 }}>⚠️ {a.label}</span></Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <div style={{ position: "absolute", bottom: 20, right: 20, background: "#0D1B2Aee", border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: "10px 14px", zIndex: 1000, fontSize: 12, color: SUBTEXT, lineHeight: "1.8", backdropFilter: GLASS_BLUR }}>
          🟡 Capital &nbsp; 🟠 Military &nbsp; 🔵 Port<br/>🔴 Attack/Intercept site
        </div>
      </div>
    </div>
  );
}

const INTERCEPTED = "#34D399";
const IMPACTED = "#F87171";
const SEA = "#3B82F6";
const BG = "#050B1A";
const CARD_BG = "#FFFFFF08";
const BORDER = "#FFFFFF11";
const TEXT = "#E8E8ED";
const SUBTEXT = "#E8E8ED88";

// Live Intel map constants
const MAP_BG = "#050B1A";
const MAP_LAND = "#FFFFFF06";
const MAP_BORDER_COLOR = "#FFFFFF15";
const MAP_GRID = "#FFFFFF08";
const DRONE_HIT = "#F87171";
const DEBRIS_HIT = "#F59E0B";

const STRATEGIC_BLUE = "#3B82F6";
const DESAL_CYAN = "#22D3EE";

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
      { id: 10, name: "23 Marina Tower (Dubai Marina)", type: "drone_hit", date: "7 Mar", casualties: "1 killed", lat: 25.0920, lng: 55.1380, region: "Dubai" },
      { id: 11, name: "Al Dhafra Air Base", type: "drone_hit", date: "7 Mar", casualties: "None", lat: 24.2482, lng: 54.5477, region: "Abu Dhabi" },
      { id: 12, name: "Barsha area (debris on vehicle)", type: "debris", date: "7 Mar", casualties: "1 killed", lat: 25.1050, lng: 55.2000, region: "Dubai" },
      { id: 13, name: "Al Minhad Air Base", type: "drone_hit", date: "28 Feb", casualties: "None", lat: 25.0267, lng: 55.3696, region: "Dubai" },
      { id: 14, name: "Corniche / Bateen area", type: "debris", date: "28 Feb", casualties: "None", lat: 24.4650, lng: 54.3300, region: "Abu Dhabi" },
    ],
    strategicSites: [
      { id: "s1", name: "Al Dhafra Air Base", type: "US/UAE Air Base", lat: 24.2482, lng: 54.5477 },
      { id: "s3", name: "US Embassy Abu Dhabi", type: "US Embassy", lat: 24.4539, lng: 54.3773 },
      { id: "s4", name: "US Consulate Dubai", type: "US Consulate", lat: 25.2601, lng: 55.3091 },
      { id: "s7", name: "Fujairah Naval Facility", type: "US Navy", lat: 25.1612, lng: 56.3658 },
      { id: "d1", name: "Jebel Ali Desal", type: "Desalination", siteType: "desal", lat: 25.0597, lng: 55.1172 },
      { id: "d2", name: "Taweelah Desal", type: "Desalination", siteType: "desal", lat: 24.7680, lng: 54.6873 },
      { id: "d3", name: "Fujairah Desal (Qidfa)", type: "Desalination", siteType: "desal", lat: 25.3141, lng: 56.3728 },
      { id: "d4", name: "Umm Al Nar Desal", type: "Desalination", siteType: "desal", lat: 24.4348, lng: 54.4876 },
      { id: "d5", name: "Shuweihat Desal", type: "Desalination", siteType: "desal", lat: 24.1650, lng: 52.5680 },
      { id: "d6", name: "Al Mirfa Desal", type: "Desalination", siteType: "desal", lat: 24.1210, lng: 53.4470 },
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
      { id: 1, name: "Al Udeid Air Base (direct hit)", type: "drone_hit", date: "28 Feb", casualties: "None", lat: 25.1173, lng: 51.3150, region: "Al Rayyan" },
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
      { id: "d1", name: "Ras Abu Fontas Desal", type: "Desalination", siteType: "desal", lat: 25.2058, lng: 51.6174 },
      { id: "d2", name: "Umm Al Houl Desal", type: "Desalination", siteType: "desal", lat: 25.1146, lng: 51.6115 },
      { id: "d3", name: "Ras Laffan Desal", type: "Desalination", siteType: "desal", lat: 25.8545, lng: 51.5367 },
    ],
  },
  kuwait: {
    bounds: { latMin: 28.5, latMax: 30.2, lngMin: 46.5, lngMax: 48.6 },
    title: "LIVE INTEL — KUWAIT IMPACT MAP",
    subtitle: "CONFIRMED STRIKE LOCATIONS",
    regions: [
      { name: "KUWAIT", labelLat: 29.3, labelLng: 47.5, pts: [[30.10,47.70],[30.00,48.00],[29.86,48.05],[29.36,48.40],[29.10,48.42],[29.00,48.15],[28.75,48.40],[28.55,48.05],[28.55,47.70],[28.55,47.43],[28.67,47.45],[29.10,47.00],[29.35,47.00],[29.35,47.15],[29.57,47.45],[29.80,47.70],[30.10,47.70]] },
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
      { id: "d1", name: "Az-Zour South Desal", type: "Desalination", siteType: "desal", lat: 28.7088, lng: 48.3656 },
      { id: "d2", name: "Doha East Desal", type: "Desalination", siteType: "desal", lat: 29.3682, lng: 47.7963 },
      { id: "d3", name: "Shuwaikh Desal", type: "Desalination", siteType: "desal", lat: 29.3515, lng: 47.9402 },
      { id: "d4", name: "Sabiya Desal", type: "Desalination", siteType: "desal", lat: 29.5670, lng: 48.1710 },
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
      { id: 6, name: "Mina Salman Port (MT Stena Imperative)", type: "drone_hit", date: "2 Mar", casualties: "2 injured", lat: 26.2100, lng: 50.6000, region: "Manama" },
      { id: 7, name: "Ma'ameer Industrial Area", type: "drone_hit", date: "5 Mar", casualties: "None", lat: 26.0400, lng: 50.5200, region: "Ma'ameer" },
      { id: 8, name: "Water desalination plant", type: "drone_hit", date: "8 Mar", casualties: "None", lat: 26.1000, lng: 50.5600, region: "Sitra" },
    ],
    strategicSites: [
      { id: "s1", name: "NSA Bahrain (US 5th Fleet)", type: "US Naval Base", lat: 26.2400, lng: 50.6100 },
      { id: "s2", name: "Isa Air Base", type: "Bahrain/US Air Base", lat: 25.9182, lng: 50.5906 },
      { id: "s3", name: "US Embassy Manama", type: "US Embassy", lat: 26.2280, lng: 50.5830 },
      { id: "d1", name: "Al Hidd Desal", type: "Desalination", siteType: "desal", lat: 26.2223, lng: 50.6621 },
      { id: "d2", name: "Al Dur Desal", type: "Desalination", siteType: "desal", lat: 25.9714, lng: 50.6076 },
    ],
  },
  israel: {
    bounds: { latMin: 29.3, latMax: 33.5, lngMin: 34.1, lngMax: 36.1 },
    title: "LIVE INTEL — ISRAEL IMPACT MAP",
    subtitle: "CONFIRMED STRIKE LOCATIONS",
    regions: [
      { name: "ISRAEL", labelLat: 31.5, labelLng: 34.9,
        pts: [
          // North — Lebanon border (Rosh HaNikra to Mt Hermon area)
          [33.08,35.10],[33.10,35.20],[33.25,35.57],[33.36,35.63],[33.28,35.78],
          // Golan Heights east border
          [33.10,35.85],[32.72,35.78],[32.40,35.77],[32.10,35.55],
          // Jordan River valley / Jordan border
          [31.90,35.47],[31.50,35.55],[31.10,35.48],[30.90,35.35],
          // Negev / Eilat south tip
          [29.56,34.92],[29.50,34.97],
          // Egypt border (Sinai) going north
          [30.00,34.27],[30.60,34.28],[31.00,34.35],
          // Mediterranean coast north
          [31.50,34.48],[31.80,34.60],[32.08,34.76],[32.40,34.85],[32.80,34.96],[33.08,35.10],
        ]
      },
    ],
    impacts: [
      { id: 1, name: "Tel Aviv city center", type: "debris", date: "Ongoing", casualties: "Multiple", lat: 32.0853, lng: 34.7818, region: "Tel Aviv" },
      { id: 2, name: "Ben Gurion Airport", type: "drone_hit", date: "Ongoing", casualties: "Diverted flights", lat: 32.0055, lng: 34.8854, region: "Tel Aviv" },
      { id: 3, name: "Haifa", type: "drone_hit", date: "Ongoing", casualties: "Multiple", lat: 32.7940, lng: 34.9896, region: "Haifa" },
      { id: 4, name: "Jerusalem", type: "debris", date: "Ongoing", casualties: "Intercept debris", lat: 31.7683, lng: 35.2137, region: "Jerusalem" },
    ],
    strategicSites: [
      { id: "s1", name: "Ben Gurion Airport", type: "International Airport", lat: 32.0055, lng: 34.8854 },
      { id: "s2", name: "Nevatim Air Base", type: "IAF Air Base", lat: 31.2083, lng: 34.9383 },
      { id: "s3", name: "Ramat David Air Base", type: "IAF Air Base", lat: 32.6651, lng: 35.1796 },
      { id: "s4", name: "US Embassy Jerusalem", type: "US Embassy", lat: 31.7720, lng: 35.2290 },
      { id: "d1", name: "Sorek Desal", type: "Desalination", siteType: "desal", lat: 31.8770, lng: 34.6890 },
      { id: "d2", name: "Hadera Desal", type: "Desalination", siteType: "desal", lat: 32.4580, lng: 34.8650 },
      { id: "d3", name: "Ashkelon Desal", type: "Desalination", siteType: "desal", lat: 31.6290, lng: 34.5370 },
    ],
  },
};

// Simplified geography for the All GCC theatre map (Arabian Peninsula + Iran)
// Coordinates are [lat, lng] pairs forming simplified country outlines
const GCC_GEOGRAPHY = {
  // Sea background: the entire SVG is water-colored; land polygons are drawn on top
  saudiArabia: {
    name: "SAUDI ARABIA", color: "#FFFFFF06", labelLat: 24.5, labelLng: 45.0,
    strategicSites: [
      { id: "sa-s1", name: "Prince Sultan Air Base", type: "US Air Base", lat: 24.0625, lng: 47.5806 },
      { id: "sa-s3", name: "US Embassy Riyadh", type: "US Embassy", lat: 24.7468, lng: 46.6527 },
      { id: "sa-s4", name: "US Consulate Jeddah", type: "US Consulate", lat: 21.5433, lng: 39.1728 },
      { id: "sa-s6", name: "Eskan Village", type: "US Military Housing", lat: 24.5953, lng: 46.7116 },
      { id: "sa-s7", name: "THAAD Battery (Yanbu)", type: "US THAAD", lat: 24.0890, lng: 38.0634 },
      { id: "sa-s8", name: "Israeli Embassy Riyadh", type: "IL Embassy", lat: 24.7300, lng: 46.6700 },
      { id: "sa-d1", name: "Jubail Desal (SWCC)", type: "Desalination", siteType: "desal", lat: 27.0110, lng: 49.6580 },
      { id: "sa-d2", name: "Ras Al-Khair Desal", type: "Desalination", siteType: "desal", lat: 27.4800, lng: 49.2300 },
      { id: "sa-d3", name: "Shoaiba Desal", type: "Desalination", siteType: "desal", lat: 21.4200, lng: 39.2500 },
      { id: "sa-d4", name: "Yanbu Desal", type: "Desalination", siteType: "desal", lat: 24.0890, lng: 38.0650 },
      { id: "sa-d5", name: "Al Khobar Desal", type: "Desalination", siteType: "desal", lat: 26.2800, lng: 50.2100 },
    ],
    pts: [
      // Red Sea coast (north to south)
      [29.5,34.8],[28.0,35.2],[27.0,36.7],[25.5,37.2],[24.5,37.5],[23.5,38.5],[22.0,39.0],[20.5,39.5],[19.0,40.0],[17.5,41.0],[16.5,42.5],
      // Yemen border (west to east)
      [16.0,43.0],[16.5,43.5],[17.0,44.5],[17.5,46.0],[18.0,48.5],[19.0,48.0],[19.5,49.5],[20.0,50.5],[19.5,51.5],[19.5,52.0],[19.0,55.0],
      // Oman border (south to tripoint)
      [20.5,55.0],[21.5,55.0],[22.0,55.0],[22.50,55.01],
      // Saudi-UAE border (tripoint northwest through Rub al Khali to Qatar)
      [23.00,52.00],[23.98,51.57],[24.36,51.58],
      // Persian Gulf coast (south to north — includes Dammam/Jubail bulge)
      [24.70,50.80],[25.00,50.70],[25.30,50.55],[25.70,50.40],[26.10,50.30],[26.50,50.15],[27.00,49.95],[27.40,49.30],[27.80,48.80],[28.20,48.55],[28.50,48.50],
      // Kuwait border area
      [28.55,47.70],[28.55,47.43],[28.67,47.45],[29.10,47.00],[29.35,47.00],
      // Iraq/Jordan border north
      [30.00,47.00],[30.5,47.7],[30.50,46.50],[31.00,46.0],[31.50,44.0],[31.80,42.0],[32.0,39.0],
      // Jordan border
      [31.5,37.0],[29.5,34.8]
    ],
  },
  oman: {
    name: "OMAN", color: "#FFFFFF06", labelLat: 21.5, labelLng: 57.5,
    strategicSites: [
      { id: "om-s1", name: "Thumrait Air Base", type: "US/Oman Air Base", lat: 17.6660, lng: 54.0246 },
      { id: "om-s2", name: "Al Musannah Air Base", type: "US/Oman Air Base", lat: 23.6406, lng: 57.4936 },
      { id: "om-s3", name: "Masirah Island Air Base", type: "US/Oman Air Base", lat: 20.6754, lng: 58.8905 },
      { id: "om-s5", name: "US Embassy Muscat", type: "US Embassy", lat: 23.6133, lng: 58.5915 },
      { id: "om-d1", name: "Barka Desal", type: "Desalination", siteType: "desal", lat: 23.7074, lng: 57.9845 },
      { id: "om-d2", name: "Sohar Desal", type: "Desalination", siteType: "desal", lat: 24.4724, lng: 56.6334 },
      { id: "om-d3", name: "Sur Desal", type: "Desalination", siteType: "desal", lat: 22.5667, lng: 59.5289 },
      { id: "om-d4", name: "Ghubrah Desal (Muscat)", type: "Desalination", siteType: "desal", lat: 23.6031, lng: 58.4164 },
    ],
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
    name: "IRAN", color: "#FFFFFF08", labelLat: 33.0, labelLng: 53.0,
    strategicSites: [
      { id: "ir-d1", name: "Bandar Abbas Desal", type: "Desalination", siteType: "desal", lat: 27.1837, lng: 56.2774 },
      { id: "ir-d2", name: "Bushehr Desal", type: "Desalination", siteType: "desal", lat: 28.9684, lng: 50.8385 },
      { id: "ir-d3", name: "Kish Island Desal", type: "Desalination", siteType: "desal", lat: 26.5320, lng: 53.9660 },
      { id: "ir-d4", name: "Qeshm Island Desal", type: "Desalination", siteType: "desal", lat: 26.8330, lng: 56.0000 },
      { id: "ir-d5", name: "Chabahar Desal", type: "Desalination", siteType: "desal", lat: 25.4500, lng: 60.3833 },
    ],
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
    name: "IRAQ", color: "#FFFFFF06", labelLat: 33.5, labelLng: 44.0,
    pts: [
      // Persian Gulf coast to Iran border
      [30.5,48.0],[30.0,48.8],
      // Iran border north
      [31.0,47.5],[31.5,47.0],[32.0,46.0],[32.5,45.5],[33.0,45.5],[33.5,45.5],[34.0,45.5],[34.5,46.0],[35.0,46.5],[35.5,46.0],[36.0,45.5],[36.5,45.5],
      // Turkey border (shared points)
      [37.0,45.5],[37.5,45.0],[37.5,44.5],[37.5,43.5],[37.5,42.5],
      // Syria border
      [37.0,42.0],[36.5,42.0],[36.0,41.5],[35.5,41.0],[35.0,41.0],[34.5,41.0],[34.0,41.0],[33.5,41.0],
      // Jordan/Saudi border south
      [33.0,39.0],[32.5,39.0],[32.0,39.0],[31.0,39.0],
      // Saudi border
      [30.5,39.0],[30.0,40.0],[29.5,44.0],[29.5,46.5],[29.5,47.0],[30.0,47.0],[30.5,47.7],[30.5,48.0]
    ],
  },
  yemen: {
    name: "YEMEN", color: "#FFFFFF06", labelLat: 15.5, labelLng: 47.0,
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
    name: "JORDAN", color: "#FFFFFF06", labelLat: 31.2, labelLng: 36.5,
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
    name: "SYRIA", color: "#FFFFFF06", labelLat: 35.0, labelLng: 38.0,
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
    name: "", color: "#FFFFFF06",
    pts: [
      [34.7,36.2],[34.5,36.0],[34.0,36.0],[33.3,35.6],[33.8,35.1],[34.0,35.5],[34.7,35.8],[34.7,36.2]
    ],
  },
  israel: {
    name: "", color: "#FFFFFF06",
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
    name: "TURKEY", color: "#FFFFFF06", labelLat: 39.5, labelLng: 37.0,
    pts: [
      // Syria border (Mediterranean to Iraq)
      [37.0,36.5],[36.5,36.2],[36.2,36.0],[36.0,35.8],[35.8,35.8],[34.7,35.8],[34.7,34.0],
      // Off-map north (extends well above map edge)
      [42.0,34.0],[42.0,36.0],[42.0,38.0],[42.0,40.0],[42.0,42.0],[42.0,44.0],[42.0,46.0],[42.0,48.0],
      // Iran/Armenia border
      [39.5,48.0],[39.5,47.0],[39.0,46.0],[38.5,45.5],[38.0,44.5],
      // Iraq border (shared points, reverse of Iraq's Turkey border)
      [37.5,45.0],[37.5,44.5],[37.5,43.5],[37.5,42.5],
      // Syria border
      [37.0,42.0],[37.5,42.0],[37.5,41.0],[37.5,40.0],[37.5,39.0],[37.5,38.0],[37.5,37.0],[37.0,36.5]
    ],
  },
  egypt: {
    name: "EGYPT", color: "#FFFFFF06", labelLat: 28.0, labelLng: 34.0,
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
    name: "SUDAN", color: "#FFFFFF06",
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
    name: "", color: "#FFFFFF06",
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
    name: "SOMALIA", color: "#FFFFFF06",
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
    name: "", color: "#FFFFFF06",
    pts: [[12.5,43.5],[12.0,43.3],[11.5,43.0],[11.5,42.5],[12.0,42.0],[13.0,42.0],[12.5,43.0],[12.5,43.5]],
  },
  eritrea: {
    name: "", color: "#FFFFFF06",
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
    const pts = [
      // NW coast (Deira)
      [25.27,55.28],
      // Northern/Eastern borders
      [25.23,55.35],[25.19,55.33],[25.22,55.36],[25.28,55.30],[25.31,55.45],
      [25.19,55.62],[25.05,55.66],[24.98,55.62],[24.90,55.66],[24.72,55.68],
      [24.61,55.46],[24.60,55.16],
      // SW border to coast (Abu Dhabi border)
      [24.98,55.01],
      // Palm Jebel Ali
      [24.98,54.98],[25.00,54.96],[25.02,54.97],[25.02,55.00],
      // Coast to Dubai Marina
      [25.04,55.04],[25.07,55.08],[25.09,55.11],
      // Palm Jumeirah (crescent shape)
      [25.10,55.10],[25.10,55.07],[25.12,55.06],[25.14,55.07],[25.15,55.10],
      // Coast to Deira
      [25.16,55.14],[25.19,55.18],[25.22,55.22],[25.25,55.25],
      [25.27,55.28],
    ];
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

function buildDerivedData(raw, t) {
  const { cumulative, daily } = raw;
  const c = cumulative;

  const hasDailyData = daily && daily.length > 0;

  const dailyData = hasDailyData ? daily.map((d, i) => {
    const bDet = n(d.ballisticDetected), bInt = n(d.ballisticIntercepted);
    const dDet = n(d.dronesDetected), dInt = n(d.dronesIntercepted);
    const totalDet = bDet + dDet + n(d.cruiseDetected);
    const totalInt = bInt + dInt + n(d.cruiseIntercepted);
    return {
      day: d.label, label: `Day ${i + 1}`,
      ballistic: bDet, drones: dDet, cruise: n(d.cruiseDetected),
      ballisticIntercepted: bInt, droneIntercepted: dInt,
      droneImpact: n(d.dronesImpacted), ballisticSea: n(d.ballisticSea),
      ballisticRate: bDet > 0 ? +((bInt / bDet) * 100).toFixed(1) : null,
      droneRate: dDet > 0 ? +((dInt / dDet) * 100).toFixed(1) : null,
      overallRate: totalDet > 0 ? +((totalInt / totalDet) * 100).toFixed(1) : null,
    };
  }) : [];

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

  const _t = t || (k => k);
  const finalTotals = [
    { name: _t("chart.ballisticMissiles"), detected: n(c.ballisticDetected), intercepted: n(c.ballisticIntercepted), sea: n(c.ballisticSea), impacted: n(c.ballisticImpacted) },
    { name: _t("chart.cruiseMissiles"),    detected: n(c.cruiseDetected),    intercepted: n(c.cruiseIntercepted),    sea: 0, impacted: n(c.cruiseImpacted) },
    { name: _t("chart.drones"),            detected: n(c.dronesDetected),    intercepted: n(c.dronesIntercepted),    sea: 0, impacted: n(c.dronesImpacted) },
  ];
  if (missilesIntercepted > 0) {
    finalTotals.unshift({ name: _t("chart.missilesUnspec"), detected: missilesIntercepted, intercepted: missilesIntercepted, sea: 0, impacted: 0 });
  }

  const pieData = [
    { name: _t("chart.intercepted"), value: totalIntercepted,  color: INTERCEPTED },
    { name: _t("chart.sea"),         value: n(c.ballisticSea), color: SEA },
    { name: _t("chart.impacted"),    value: totalImpacted,     color: IMPACTED },
  ].filter(d => d.value > 0);

  const ballisticRate = n(c.ballisticDetected) > 0 ? +((n(c.ballisticIntercepted) / n(c.ballisticDetected)) * 100).toFixed(1) : null;
  const cruiseRate    = n(c.cruiseDetected) > 0 ? +((n(c.cruiseIntercepted) / n(c.cruiseDetected)) * 100).toFixed(1) : null;
  const droneRate     = n(c.dronesDetected) > 0 ? +((n(c.dronesIntercepted) / n(c.dronesDetected)) * 100).toFixed(1) : null;
  const overallRate   = totalDetected > 0 ? +((totalIntercepted / totalDetected) * 100).toFixed(1) : null;

  const rateData = [
    ballisticRate !== null && { category: _t("chart.ballisticMissiles"), rate: ballisticRate },
    cruiseRate !== null && { category: _t("chart.cruiseMissiles"),    rate: cruiseRate },
    droneRate !== null && { category: _t("chart.drones"),              rate: droneRate },
    overallRate !== null && { category: _t("chart.overall"),             rate: overallRate },
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
           cumulative: c, totalDetected, totalIntercepted, totalImpacted, overallRate, hasDailyData,
           totalStrikes: c.totalStrikes || null };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#0D1B2Aee", border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: "10px 14px", fontSize: 12, backdropFilter: GLASS_BLUR, fontFamily: DM_SANS }}>
        <p style={{ color: UAE_GOLD, fontWeight: 700, marginBottom: 6, fontFamily: DM_SANS }}>{label}</p>
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
    background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS,
    padding: "16px 20px", flex: 1, minWidth: 130,
    position: "relative", overflow: "hidden"
  }}>
    <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 1, background: `linear-gradient(90deg, transparent, ${color}44, transparent)` }} />
    <div style={{ fontSize: 32, fontWeight: 700, color, fontFamily: DM_SANS, letterSpacing: -1 }}>{value}</div>
    <div style={{ fontSize: 11, color: "#E8E8ED66", fontWeight: 500, marginTop: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
    {sub && <div style={{ fontSize: 10, color: SUBTEXT, marginTop: 2 }}>{sub}</div>}
  </div>
);

function Dashboard({ initialTab, initialCountry, onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab || "intel");
  const [hoveredImpact, setHoveredImpact] = useState(null);
  const [selectedImpact, setSelectedImpact] = useState(null);
  const [allData, setAllData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(initialCountry || "all");
  const [error, setError] = useState(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [expandedTimelineIdx, setExpandedTimelineIdx] = useState(null);
  const [showStrategicSites, setShowStrategicSites] = useState(true);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedSite, setSelectedSite] = useState(null);
  const [lang, setLang] = useState("en");
  const [mapModalCountry, setMapModalCountry] = useState(null);
  const [flightData, setFlightData] = useState(null);
  const [flightDataDwc, setFlightDataDwc] = useState(null);
  const [flightDataAuh, setFlightDataAuh] = useState(null);
  const [flightDataMct, setFlightDataMct] = useState(null);
  const [flightDataDoh, setFlightDataDoh] = useState(null);
  const [selectedAirport, setSelectedAirport] = useState("DXB");
  const t = createT(lang);
  const isRTL = lang === "ar";

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const allFiles = [
      ...COUNTRY_CONFIG.map(c => ({ code: c.code, file: c.file })),
      { code: "iran", file: IRAN_CONFIG.file },
    ];
    Promise.all(
      allFiles.map(c =>
        fetch(base + c.file).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    ).then(results => {
      const data = {};
      allFiles.forEach((c, i) => { if (results[i]) data[c.code] = results[i]; });
      if (Object.keys(data).length === 0) { setError("Failed to load data files"); return; }
      setAllData(data);
    });
    // Load flight data for all airports
    fetch(base + "data-flights-dxb.json").then(r => r.ok ? r.json() : null).then(d => setFlightData(d)).catch(() => {});
    fetch(base + "data-flights-dwc.json").then(r => r.ok ? r.json() : null).then(d => setFlightDataDwc(d)).catch(() => {});
    fetch(base + "data-flights-auh.json").then(r => r.ok ? r.json() : null).then(d => setFlightDataAuh(d)).catch(() => {});
    fetch(base + "data-flights-mct.json").then(r => r.ok ? r.json() : null).then(d => setFlightDataMct(d)).catch(() => {});
    fetch(base + "data-flights-doh.json").then(r => r.ok ? r.json() : null).then(d => setFlightDataDoh(d)).catch(() => {});
  }, []);

  if (error) return <div style={{ background: BG, color: IMPACTED, padding: 40, fontFamily: DM_SANS }}>{error}</div>;
  if (!allData) return <div style={{ background: BG, color: SUBTEXT, padding: 40, fontFamily: DM_SANS, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: "24px 40px", textAlign: "center" }}><div style={{ color: "#F59E0B", fontSize: 24, marginBottom: 8 }}>W</div><div>Loading...</div></div></div>;

  const isAllGCC = selectedCountry === "all";
  const isIran = selectedCountry === "iran";
  const countryConf = isIran ? IRAN_CONFIG : (COUNTRY_CONFIG.find(c => c.code === selectedCountry) || COUNTRY_CONFIG[0]);
  const rawData = isIran ? (allData.iran || allData.uae) : (isAllGCC ? allData.uae : (allData[selectedCountry] || allData.uae));
  const themeColor = isAllGCC ? UAE_GREEN : countryConf.color;
  const themeAccent = isAllGCC ? UAE_GOLD : countryConf.accent;

  // Iran view — completely different data structure
  if (isIran && allData.iran) {
    const iranData = allData.iran;
    const c = iranData.cumulative;
    const daily = iranData.daily || [];
    const targets = iranData.keyTargets || [];
    const lastUpdated = new Date(iranData.lastUpdated).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai"
    });

    // Chart data
    const strikeChartData = daily.map(d => ({
      day: d.label, strikes: d.strikes, killed: d.killed,
    }));
    const cumulativeChartData = daily.reduce((acc, d, i) => {
      const prev = i > 0 ? acc[i - 1] : { cumStrikes: 0, cumKilled: 0 };
      acc.push({ day: d.label, cumStrikes: prev.cumStrikes + d.strikes, cumKilled: prev.cumKilled + d.killed });
      return acc;
    }, []);

    // Target type breakdown
    const targetTypes = {};
    targets.forEach(t => { targetTypes[t.type] = (targetTypes[t.type] || 0) + 1; });
    const targetTypeData = Object.entries(targetTypes).map(([type, count]) => ({ name: type, value: count }));
    const TARGET_COLORS = { leadership: "#F87171", military: "#3B82F6", nuclear: "#F59E0B", naval: "#60A5FA", government: "#A78BFA", oil: "#FB923C", civilian: "#94A3B8" };

    // Iran map config
    const iranGeo = GCC_GEOGRAPHY.iran;
    const iranBounds = { latMin: 25.0, latMax: 40.0, lngMin: 44.0, lngMax: 63.0 };
    const iranToSVG = makeToSVG(iranBounds);

    return (
      <div dir={isRTL ? "rtl" : "ltr"} style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: DM_SANS, padding: "0 0 40px", overflowX: "hidden", position: "relative" }}>
        {/* Background gradient orbs */}
        <div style={{ position: "fixed", top: -200, right: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #F59E0B11 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: -200, left: -100, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #3B82F611 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        {/* Header */}
        <div style={{ background: "#FFFFFF05", borderBottom: "1px solid #FFFFFF0A", padding: "16px 28px", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)" }}>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #F59E0B, #D97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#050B1A" }}>W</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: TEXT }}>ww3live<span style={{ color: "#F59E0B" }}>.xyz</span></span>
                  <span style={{ fontSize: 16 }}>🇮🇷</span>
                </div>
                <h1 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#E8E8ED44", fontFamily: DM_SANS, textTransform: "uppercase", letterSpacing: 2 }}>
                  {t("iran.title")}
                </h1>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 11, color: "#E8E8ED44", marginTop: 8 }}>
              <span style={{ color: "#EF4444" }}>{t("header.updated")} {lastUpdated} GST</span>
              <span>{t("iran.source")}</span>
            </div>
          </div>
        </div>

        {/* Country selector */}
        <div style={{ display: "flex", gap: 6, padding: "16px 28px 0", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
          {[{ code: "all", name: t("country.allGcc"), flag: "🌐" }, ...COUNTRY_CONFIG.map(c => ({ ...c, name: t(`country.${c.code}`) })), { code: "_sep" }, { ...IRAN_CONFIG, name: t("country.iran") }].map(c => (
            c.code === "_sep" ? <div key="_sep" style={{ width: 1, background: BORDER, margin: "4px 4px" }} /> :
            <span key={c.code} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button onClick={() => { setSelectedCountry(c.code); setHoveredImpact(null); setSelectedImpact(null); setSelectedSite(null); window.location.hash = "/threat/" + c.code + (activeTab && activeTab !== "overview" && activeTab !== "intel" ? "/" + activeTab : ""); }}
                style={{
                  background: selectedCountry === c.code ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#FFFFFF0A",
                  backdropFilter: selectedCountry !== c.code ? "blur(10px)" : "none",
                  color: selectedCountry === c.code ? "#050B1A" : "#E8E8ED88",
                  border: selectedCountry === c.code ? "none" : "1px solid #FFFFFF11",
                  borderRadius: 100, padding: "6px 16px", cursor: "pointer",
                  fontSize: 12, fontWeight: selectedCountry === c.code ? 600 : 400,
                  fontFamily: DM_SANS, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6
                }}>
                <span>{c.flag}</span> {c.name}
              </button>
            </span>
          ))}
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 12, padding: "20px 28px", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
          <StatCard label={t("iran.totalStrikes")} value={n(c.totalStrikes).toLocaleString()} sub={t("iran.usIsrael")} color="#EF4444" />
          <StatCard label={t("iran.sorties")} value={n(c.sorties).toLocaleString()} sub={t("iran.sortiesSub")} color="#F59E0B" />
          <StatCard label={t("iran.killed")} value={n(c.killed).toLocaleString()} sub={`${t("iran.civilian")}: ~${n(c.civilianKilled).toLocaleString()}`} color="#F87171" />
          <StatCard label={t("iran.injured")} value={n(c.injured).toLocaleString()} sub="" color="#FB923C" />
          <StatCard label={t("iran.launchersDisabled")} value={n(c.launchersDisabled).toLocaleString()} sub={t("iran.launchersSub")} color="#3B82F6" />
        </div>

        <div dir="ltr" style={{ padding: "0 28px", position: "relative", zIndex: 2 }}>
          {/* Daily strikes chart */}
          <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#EF4444" }}>{t("iran.dailyStrikes")}</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={strikeChartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                <YAxis yAxisId="left" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: "#F87171", fontSize: 10 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="strikes" name={t("iran.strikes")} fill="#EF4444" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line yAxisId="right" type="monotone" dataKey="killed" name={t("iran.killed")} stroke="#F87171" strokeWidth={2} dot={{ fill: "#F87171", r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative chart */}
          <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#EF4444" }}>{t("iran.cumulativeTitle")}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cumulativeChartData}>
                <defs>
                  <linearGradient id="gradIranStrikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradIranKilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F87171" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="cumStrikes" name={t("iran.cumStrikes")} stroke="#EF4444" fill="url(#gradIranStrikes)" strokeWidth={2} dot={{ fill: "#EF4444", r: 3 }} />
                <Area type="monotone" dataKey="cumKilled" name={t("iran.cumKilled")} stroke="#F87171" fill="url(#gradIranKilled)" strokeWidth={2} dot={{ fill: "#F87171", r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Target type breakdown + map side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
            {/* Target type pie */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#F59E0B" }}>{t("iran.targetBreakdown")}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={targetTypeData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}
                    label={({ cx, cy, midAngle, outerRadius: or, name, value }) => { const RADIAN = Math.PI / 180; const r = or + 20; const x = cx + r * Math.cos(-midAngle * RADIAN); const y = cy + r * Math.sin(-midAngle * RADIAN); return <text x={x} y={y} fill={TEXT} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10}>{`${name} (${value})`}</text>; }}
                    labelLine={{ stroke: SUBTEXT, strokeWidth: 1 }}>
                    {targetTypeData.map((entry, i) => <Cell key={i} fill={TARGET_COLORS[entry.name] || SUBTEXT} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Strike map */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#EF4444" }}>{t("iran.strikeMap")}</h3>
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", background: MAP_BG, borderRadius: 8 }}>
                {/* Iran outline */}
                {iranGeo && <polygon points={iranGeo.pts.map(([lat, lng]) => { const p = iranToSVG(lat, lng); return `${p.x},${p.y}`; }).join(" ")} fill={MAP_LAND} stroke={MAP_BORDER_COLOR} strokeWidth={1} />}
                {/* Strike markers */}
                {targets.map((tgt, i) => {
                  const p = iranToSVG(tgt.lat, tgt.lng);
                  const color = TARGET_COLORS[tgt.type] || "#F87171";
                  return (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={5} fill={color} opacity={0.7} stroke={color} strokeWidth={1} />
                      <circle cx={p.x} cy={p.y} r={8} fill="none" stroke={color} strokeWidth={0.5} opacity={0.4} />
                      {tgt.city === "Tehran" ? null : <text x={p.x + 10} y={p.y + 3} fill={TEXT} fontSize={7} opacity={0.7}>{tgt.city}</text>}
                    </g>
                  );
                })}
                {/* Tehran label (cluster) */}
                {(() => { const tp = iranToSVG(35.7, 51.42); return <text x={tp.x + 20} y={tp.y - 15} fill="#F87171" fontSize={9} fontWeight={700}>Tehran</text>; })()}
                {/* Legend */}
                {Object.entries(TARGET_COLORS).map(([type, color], i) => (
                  <g key={type} transform={`translate(10, ${SVG_H - 20 - (Object.keys(TARGET_COLORS).length - 1 - i) * 14})`}>
                    <circle cx={4} cy={-3} r={3} fill={color} />
                    <text x={12} y={0} fill={TEXT} fontSize={7} opacity={0.7}>{type}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Daily event timeline */}
          <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: "#F59E0B" }}>{t("iran.timeline")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {daily.map((d, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", borderLeft: "2px solid #EF4444", paddingLeft: 16 }}>
                  <div style={{ minWidth: 60 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>{d.label}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT }}>{d.strikes} {t("iran.strikes")}</div>
                    <div style={{ fontSize: 10, color: "#F87171" }}>{d.killed} {t("iran.killedLabel")}</div>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5 }}>{d.events}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "#E8E8ED55", fontFamily: DM_SANS }}>
          {t("footer.text")}
          <br />
          <a href="https://github.com/takahser/uae-dashboard" target="_blank" rel="noopener noreferrer"
            style={{ color: "#E8E8ED33", textDecoration: "none", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub
          </a>
        </div>
      </div>
    );
  }

  // When All GCC, aggregate stats across all countries
  const derived = isAllGCC ? (() => {
    const perCountry = COUNTRY_CONFIG.map(c => allData[c.code]).filter(Boolean).map(d => buildDerivedData(d, t));
    const aggDetected = perCountry.reduce((s, d) => s + d.totalDetected, 0);
    const aggIntercepted = perCountry.reduce((s, d) => s + d.totalIntercepted, 0);
    const aggImpacted = perCountry.reduce((s, d) => s + d.totalImpacted, 0);
    const aggRate = aggDetected > 0 ? +((aggIntercepted / aggDetected) * 100).toFixed(1) : null;
    const aggSea = perCountry.reduce((s, d) => s + n(d.cumulative.ballisticSea), 0);
    const aggKilled = perCountry.reduce((s, d) => s + n(d.cumulative.killed), 0);
    const aggInjured = perCountry.reduce((s, d) => s + n(d.cumulative.injured), 0);
    return {
      ...buildDerivedData(rawData, t),
      totalDetected: aggDetected, totalIntercepted: aggIntercepted, totalImpacted: aggImpacted,
      overallRate: aggRate,
      cumulative: { ...rawData.cumulative, ballisticSea: aggSea, killed: aggKilled, injured: aggInjured },
    };
  })() : buildDerivedData(rawData, t);

  const { dailyData, cumulativeData, finalTotals, pieData, rateData, trendData, interceptorData,
          cumulative, totalDetected, totalIntercepted, totalImpacted, overallRate, hasDailyData, totalStrikes } = derived;

  const lastUpdated = new Date(rawData.lastUpdated).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai"
  });
  const dayCount = rawData.daily.length;

  const allTabs = [
    { id: "intel",       label: t("tab.intel") },
    { id: "overview",    label: t("tab.overview") },
    { id: "trends",      label: t("tab.trends"),         needsDaily: true },
    { id: "daily",       label: t("tab.daily"),           needsDaily: true },
    { id: "cumulative",  label: t("tab.cumulative"),      needsDaily: true },
    { id: "rates",       label: t("tab.rates") },
    { id: "arsenal",     label: t("tab.arsenal") },
    { id: "flights",    label: t("tab.flights") },
  ];
  const tabs = isAllGCC ? [{ id: "intel", label: t("tab.intel") }, { id: "comparison", label: t("tab.comparison") }] : allTabs.filter(t => {
    if (t.needsUAE && selectedCountry !== "uae") return false;
    if (t.needsDaily && !hasDailyData) return false;
    return true;
  });

  // Reset tab if current tab is not available
  if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
    const validTab = tabs[0].id;
    if (activeTab !== validTab) setTimeout(() => setActiveTab(validTab), 0);
  }

  return (
    <div dir={isRTL ? "rtl" : "ltr"} style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: DM_SANS, padding: "0 0 40px", overflowX: "hidden", position: "relative" }}>
      {/* Background gradient orbs */}
      <div style={{ position: "fixed", top: -200, right: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #F59E0B11 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -200, left: -100, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #3B82F611 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {onBack && (
        <button
          onClick={onBack}
          style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, color: "#F59E0B", cursor: "pointer", fontSize: "0.95rem", padding: "8px 16px", borderRadius: GLASS_RADIUS, position: "relative", zIndex: 2, fontFamily: DM_SANS }}
        >
          ← Back
        </button>
      )}
      {/* Header */}
      <div style={{
        background: "#FFFFFF05",
        borderBottom: "1px solid #FFFFFF0A", padding: "16px 28px",
        position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(20px)"
      }}>
        <div style={{ display: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 0, [isRTL ? "left" : "right"]: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setLang(lang === "en" ? "ar" : "en")}
              style={{ background: "#FFFFFF0A", backdropFilter: "blur(10px)", border: "1px solid #FFFFFF11", color: "#E8E8ED88", borderRadius: 100, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 500, letterSpacing: 0.5, fontFamily: DM_SANS }}>
              {t("lang.switch")}
            </button>
            <a href="https://github.com/takahser/uae-dashboard" target="_blank" rel="noopener noreferrer"
              style={{ color: SUBTEXT, fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #F59E0B, #D97706)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "#050B1A", flexShrink: 0
            }}>W</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, color: TEXT }}>ww3live<span style={{ color: "#F59E0B" }}>.xyz</span></span>
                <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", animation: "pulse-live 1.5s ease-in-out infinite" }} />
                  LIVE
                </span>
                <span style={{ fontSize: 16, marginLeft: 4 }}>{isAllGCC ? "🌐" : countryConf.flag}</span>
              </div>
              <div style={{ fontSize: 11, color: "#E8E8ED44", textTransform: "uppercase", letterSpacing: 3, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                {isAllGCC ? t("header.coalition") : t("header.mod", { country: countryConf.name })}
                <span
                  onClick={() => setShowDisclaimer(!showDisclaimer)}
                  style={{ cursor: "pointer", fontSize: 10, color: SUBTEXT, border: GLASS_BORDER, borderRadius: "50%", width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}
                  title={t("header.disclaimer")}
                >(i)</span>
                {showDisclaimer && (
                  <div style={{ position: "absolute", top: "100%", [isRTL ? "right" : "left"]: 50, zIndex: 100, marginTop: 4, background: "#0D1B2Aee", border: GLASS_BORDER, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: SUBTEXT, maxWidth: 360, lineHeight: 1.5, fontWeight: 400, textTransform: "none", letterSpacing: 0, boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
                    {t("header.disclaimerText")}
                  </div>
                )}
              </div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT, fontFamily: DM_SANS, letterSpacing: -0.5 }}>
                {t("header.title")}
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 11, color: "#E8E8ED44" }}>
            <span>{(() => { const now = new Date(); const conflictStart = new Date("2026-02-28T00:00:00+04:00"); const dayNum = Math.floor((now - conflictStart) / 86400000) + 1; const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }); return `${dateStr}${dayNum > 0 ? ` — ${t("header.day", { count: dayNum })}` : ""}`; })()}</span>
            <span>{t("header.source")} {isAllGCC ? t("header.multiSource") : `${countryConf.source} ${t("header.officialStatements")}`}</span>
            <span style={{ color: "#F59E0B" }}>{t("header.updated")} {lastUpdated} GST</span>
          </div>
        </div>
      </div>

      {/* Country selector */}
      <div style={{ display: "flex", gap: 6, padding: "16px 28px 0", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
        {[{ code: "all", name: t("country.allGcc"), flag: "🌐" }, ...COUNTRY_CONFIG.map(c => ({ ...c, name: t(`country.${c.code}`) })), { code: "_sep" }, { ...IRAN_CONFIG, name: t("country.iran") }].map(c => (
          c.code === "_sep" ? <div key="_sep" style={{ width: 1, background: BORDER, margin: "4px 4px" }} /> :
          <span key={c.code} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <button onClick={() => { setSelectedCountry(c.code); setHoveredImpact(null); setSelectedImpact(null); setSelectedSite(null); window.location.hash = "/threat/" + c.code + (activeTab && activeTab !== "overview" && activeTab !== "intel" ? "/" + activeTab : ""); }}
              style={{
                background: selectedCountry === c.code ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#FFFFFF0A",
                backdropFilter: selectedCountry !== c.code ? "blur(10px)" : "none",
                color: selectedCountry === c.code ? "#050B1A" : "#E8E8ED88",
                border: selectedCountry === c.code ? "none" : "1px solid #FFFFFF11",
                borderRadius: 100, padding: "6px 16px", cursor: "pointer",
                fontSize: 12, fontWeight: selectedCountry === c.code ? 600 : 400,
                fontFamily: DM_SANS, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6
              }}>
              <span>{c.flag}</span> {c.name}
            </button>
          </span>
        ))}
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, padding: "20px 28px", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
        {totalStrikes && totalDetected === 0 ? (
          <>
            <StatCard label={t("stat.totalStrikes") || "Total Strikes"} value={totalStrikes.toLocaleString()} sub={t("stat.totalStrikesSub") || "Combined ballistic + drone"} color={themeAccent || UAE_GOLD} />
            <StatCard label={t("stat.intercepted")} value="—" sub={t("stat.breakdownNA") || "No breakdown available"} color={INTERCEPTED} />
          </>
        ) : (
          <>
            <StatCard label={t("stat.totalDetected")} value={totalDetected.toLocaleString()} sub={t("stat.totalDetectedSub")} color={themeAccent || UAE_GOLD} />
            <StatCard label={t("stat.intercepted")} value={totalIntercepted.toLocaleString()} sub={overallRate != null ? `${overallRate}% ${t("stat.successRate")}` : t("stat.rateNA")} color={INTERCEPTED} />
            <StatCard label={t("stat.impacted")} value={totalImpacted.toLocaleString()} sub={t("stat.impactedSub")} color={IMPACTED} />
          </>
        )}
        {n(cumulative.ballisticSea) > 0 && <StatCard label={t("stat.sea")} value={n(cumulative.ballisticSea).toLocaleString()} sub={t("stat.seaSub")} color={SEA} />}
        {n(cumulative.killed) > 0 && <StatCard label={t("stat.killed")} value={cumulative.killed} sub="" color="#F87171" />}
        {cumulative.injured != null && <StatCard label={t("stat.injured")} value={cumulative.injured} sub="" color="#FB923C" />}
      </div>
      {/* Country note (e.g. IDF data limitations) */}
      {rawData.note && (
        <div style={{ padding: "0 28px 12px" }}>
          <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: "10px 16px", fontSize: 11, color: SUBTEXT, lineHeight: 1.5 }}>
            <span style={{ color: themeAccent || UAE_GOLD, fontWeight: 700, marginRight: 6 }}>NOTE:</span>{rawData.note}
          </div>
        </div>
      )}
      {/* Defence systems from data */}
      {rawData.defenceSystems && rawData.defenceSystems.length > 0 && (
        <div style={{ padding: "0 28px 12px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {rawData.defenceSystems.map(sys => (
              <span key={sys} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: 16, padding: "4px 12px", fontSize: 11, color: INTERCEPTED, fontWeight: 600 }}>{sys}</span>
            ))}
          </div>
        </div>
      )}
      {/* Airport status from data */}
      {rawData.airports && rawData.airports.length > 0 && (
        <div style={{ padding: "0 28px 12px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {rawData.airports.map(apt => (
              <div key={apt.iata} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: "8px 14px", fontSize: 11 }}>
                <span style={{ color: themeAccent || UAE_GOLD, fontWeight: 700 }}>{apt.iata}</span>
                <span style={{ color: TEXT, marginLeft: 6 }}>{apt.name}</span>
                <span style={{ color: apt.status === "operational_restricted" ? "#FB923C" : INTERCEPTED, marginLeft: 8, fontWeight: 600 }}>
                  {apt.status === "operational_restricted" ? "RESTRICTED" : apt.status?.toUpperCase()}
                </span>
                {apt.notes && <span style={{ color: SUBTEXT, marginLeft: 6 }}>— {apt.notes}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, padding: "0 28px 20px", flexWrap: "wrap", borderBottom: "1px solid #FFFFFF0A" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); window.location.hash = "/threat/" + selectedCountry + (t.id !== "overview" && t.id !== "intel" ? "/" + t.id : ""); }} style={{
            background: "transparent",
            color: activeTab === t.id ? "#F59E0B" : "#E8E8ED77",
            border: "none", borderBottom: activeTab === t.id ? "2px solid #F59E0B" : "2px solid transparent",
            padding: "10px 16px", cursor: "pointer",
            fontSize: 12, fontWeight: activeTab === t.id ? 600 : 400,
            fontFamily: DM_SANS, transition: "all 0.15s"
          }}>{t.label}</button>
        ))}
      </div>

      <div dir="ltr" style={{ padding: "0 28px", position: "relative", zIndex: 2 }}>

        {/* ALL GCC COMPARISON VIEW */}
        {isAllGCC && activeTab === "comparison" && (() => {
          const countryStats = COUNTRY_CONFIG.map(cc => {
            const d = allData[cc.code];
            if (!d) return null;
            const bd = buildDerivedData(d, t);
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                {countryStats.map(cs => (
                  <div key={cs.code} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, borderTop: `3px solid ${cs.color}` }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{cs.flag}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 12 }}>{cs.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {cs.totalStrikes && cs.totalDetected === 0 ? (
                        <>
                          <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 20, fontWeight: 800, color: cs.accent || UAE_GOLD, fontFamily: DM_SANS }}>{cs.totalStrikes.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>TOTAL STRIKES</div></div>
                          <div style={{ gridColumn: "1 / -1" }}><div style={{ fontSize: 10, color: SUBTEXT }}>No intercept breakdown available</div></div>
                        </>
                      ) : (
                        <>
                          <div><div style={{ fontSize: 20, fontWeight: 800, color: cs.accent || UAE_GOLD, fontFamily: DM_SANS }}>{cs.totalDetected.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>{t("comp.detected")}</div></div>
                          <div><div style={{ fontSize: 20, fontWeight: 800, color: INTERCEPTED, fontFamily: DM_SANS }}>{cs.totalIntercepted.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>{t("comp.intercepted")}</div></div>
                          <div><div style={{ fontSize: 20, fontWeight: 800, color: IMPACTED, fontFamily: DM_SANS }}>{cs.totalImpacted.toLocaleString()}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>{t("comp.impacted")}</div></div>
                          <div><div style={{ fontSize: 20, fontWeight: 800, color: cs.overallRate != null && cs.overallRate >= 95 ? INTERCEPTED : "#FB923C", fontFamily: DM_SANS }}>{cs.overallRate != null ? `${cs.overallRate}%` : "N/A"}</div><div style={{ fontSize: 9, color: SUBTEXT, textTransform: "uppercase" }}>{t("comp.successRate")}</div></div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Grouped bar chart */}
              <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("comp.byCountryTitle")}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compData} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="detected" name={t("comp.detected")} fill="#FFFFFF15" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="intercepted" name={t("comp.intercepted")} fill={INTERCEPTED} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="impacted" name={t("comp.impacted")} fill={IMPACTED} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Interception rate comparison */}
              <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("comp.rateTitle")}</h3>
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
              <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, overflow: "auto" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("comp.tableTitle")}</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      {[t("comp.country"), t("comp.ballistic"), t("comp.cruise"), t("comp.drones"), t("comp.totalDetected"), t("comp.intercepted2"), t("comp.impacted2"), t("comp.killed"), t("comp.injured")].map(h => (
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
                        <td style={{ padding: "10px", color: themeAccent, fontWeight: 700 }}>{cs.totalStrikes && cs.totalDetected === 0 ? `${cs.totalStrikes.toLocaleString()}*` : cs.totalDetected.toLocaleString()}</td>
                        <td style={{ padding: "10px", color: INTERCEPTED, fontWeight: 700 }}>{cs.totalStrikes && cs.totalDetected === 0 ? "—" : cs.totalIntercepted.toLocaleString()}</td>
                        <td style={{ padding: "10px", color: IMPACTED, fontWeight: 700 }}>{cs.totalStrikes && cs.totalDetected === 0 ? "—" : cs.totalImpacted.toLocaleString()}</td>
                        <td style={{ padding: "10px", color: "#F87171" }}>{n(cs.cumulative.killed) || "—"}</td>
                        <td style={{ padding: "10px", color: "#FB923C" }}>{cs.cumulative.injured != null ? cs.cumulative.injured : "—"}</td>
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
            ? [
                ...Object.values(MAP_CONFIGS).flatMap((mc, ci) => (mc.impacts || []).map(imp => ({ ...imp, id: `${ci}-${imp.id}`, _country: COUNTRY_CONFIG[ci]?.flag }))),
                ...((allData.iran?.keyTargets || []).map((t, i) => ({ id: `iran-${i}`, name: t.name, type: "direct_hit", date: t.date, casualties: t.status, lat: t.lat, lng: t.lng, region: t.city, _country: IRAN_CONFIG.flag, _iran: true }))),
              ]
            : (mapConf.impacts || []);
          const sites = isAllGCC
            ? [
                ...Object.values(MAP_CONFIGS).flatMap((mc, ci) => (mc.strategicSites || []).map(s => ({ ...s, id: `${ci}-${s.id}` }))),
                ...Object.values(GCC_GEOGRAPHY).flatMap(geo => (geo.strategicSites || []))
              ]
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
            <div style={{ position: "relative", background: MAP_BG, border: `1px solid ${MAP_BORDER_COLOR}`, borderRadius: GLASS_RADIUS, overflow: "hidden" }}
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
                <button onClick={() => setMapZoom(z => Math.min(5, z + 0.5))} style={{ background: "#0D1B2Aee", border: `1px solid ${MAP_BORDER_COLOR}`, color: TEXT, width: 28, height: 28, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <button onClick={() => setMapZoom(z => Math.max(1, z - 0.5))} style={{ background: "#0D1B2Aee", border: `1px solid ${MAP_BORDER_COLOR}`, color: TEXT, width: 28, height: 28, borderRadius: 4, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>-</button>
                <button onClick={() => { setMapZoom(1); setMapPan({ x: 0, y: 0 }); }} style={{ background: "#0D1B2Aee", border: `1px solid ${MAP_BORDER_COLOR}`, color: SUBTEXT, width: 28, height: 28, borderRadius: 4, cursor: "pointer", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>RST</button>
              </div>
              {mapZoom > 1 && <div style={{ position: "absolute", bottom: 8, left: 12, zIndex: 10, fontSize: 9, color: SUBTEXT, fontFamily: "monospace" }}>{mapZoom.toFixed(1)}x — drag to pan</div>}
              <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: "100%", height: "auto", display: "block", cursor: mapZoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}>
                <defs>
                  <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={MAP_GRID} strokeWidth="0.5" opacity="0.4" />
                  </pattern>
                  <pattern id="scanLines" width="4" height="4" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="4" y2="0" stroke="#FFFFFF08" strokeWidth="0.5" opacity="0.15" />
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
                <rect width={SVG_W} height={SVG_H} fill={isAllGCC ? "#050B1A" : MAP_BG} />
                {isAllGCC && <rect width={SVG_W} height={SVG_H} fill="#050B1A" opacity="0.8" />}
                <rect width={SVG_W} height={SVG_H} fill="url(#mapGrid)" />
                <rect width={SVG_W} height={SVG_H} fill="url(#scanLines)" />

                {/* Background geography (All GCC only): surrounding countries in grey/muted */}
                {isAllGCC && Object.entries(GCC_GEOGRAPHY).map(([key, geo]) => {
                  const geoPath = "M" + geo.pts.map(([lat,lng]) => { const {x,y} = proj(lat,lng); return `${x},${y}`; }).join(" L") + " Z";
                  return <g key={key}>
                    <path d={geoPath} fill={geo.color} stroke="#FFFFFF22" strokeWidth="0.8" opacity="0.95" />
                    {geo.name && geo.labelLat && (() => {
                      const { x, y } = proj(geo.labelLat, geo.labelLng);
                      return <text x={x} y={y} fill="#E8E8ED33" fontSize={key === "iran" ? "10" : "8"} fontFamily="monospace" textAnchor="middle" fontWeight="600" letterSpacing="2">{geo.name}</text>;
                    })()}
                  </g>;
                })}

                {/* Covered country regions (GCC members) */}
                {regionPaths.map((e, i) => (
                  <path key={`${e.name}-${i}`} d={e.path} fill={isAllGCC ? "#FFFFFF0A" : MAP_LAND} stroke={isAllGCC ? "#FFFFFF22" : MAP_BORDER_COLOR} strokeWidth={isAllGCC ? "1.5" : "1.2"} opacity="0.95" />
                ))}

                {/* Region labels */}
                {regionPaths.filter(e => e.labelLat > 0).map((e, i) => {
                  const { x, y } = proj(e.labelLat, e.labelLng);
                  return <text key={`lbl-${e.name}-${i}`} x={x} y={y} fill={isAllGCC ? "#E8E8ED55" : "#E8E8ED55"} fontSize={isAllGCC ? "6" : "7"} fontFamily="monospace" textAnchor="middle" fontWeight="600" letterSpacing="1.5">{e.name}</text>;
                })}

                {/* Coordinate ticks */}
                {lngTicks.map(lng => {
                  const { x } = proj(bnd.latMin, lng);
                  return <g key={`lng-${lng}`}>
                    <line x1={x} y1={SVG_H - 12} x2={x} y2={SVG_H} stroke="#FFFFFF22" strokeWidth="0.5" />
                    <text x={x} y={SVG_H - 3} fill="#FFFFFF33" fontSize="6" fontFamily="monospace" textAnchor="middle">{lng}°E</text>
                  </g>;
                })}
                {latTicks.map(lat => {
                  const { y } = proj(lat, bnd.lngMin);
                  return <g key={`lat-${lat}`}>
                    <line x1={0} y1={y} x2={12} y2={y} stroke="#FFFFFF22" strokeWidth="0.5" />
                    <text x={14} y={y + 2} fill="#FFFFFF33" fontSize="6" fontFamily="monospace">{lat}°N</text>
                  </g>;
                })}

                {/* Impact markers */}
                {impacts.map(loc => {
                  const { x, y } = proj(loc.lat, loc.lng);
                  const color = loc._iran ? "#EF4444" : loc.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT;
                  const hasCasualties = loc.casualties !== "None";
                  const filterId = loc._iran ? "glowRed" : loc.type === "drone_hit" ? "glowRed" : "glowOrange";
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
                <text x="16" y="34" fill="#E8E8ED33" fontSize="7" fontFamily="monospace">{mapConf.subtitle} • FEB 28, 2026 –</text>

                {/* Legend */}
                <g transform={`translate(${SVG_W - 195}, 16)`}>
                  <rect x="-8" y="-8" width="190" height={showStrategicSites ? (isAllGCC ? 100 : 84) : (isAllGCC ? 66 : 50)} rx="4" fill="#050B1Aee" fillOpacity="0.85" stroke={MAP_BORDER_COLOR} strokeWidth="0.5" />
                  <circle cx="6" cy="6" r="4" fill={DRONE_HIT} />
                  <text x="16" y="9" fill="#E8E8ED66" fontSize="7" fontFamily="monospace">{t("intel.directHit")}</text>
                  <circle cx="6" cy="22" r="4" fill={DEBRIS_HIT} />
                  <text x="16" y="25" fill="#E8E8ED66" fontSize="7" fontFamily="monospace">{t("intel.debris")}</text>
                  <circle cx="6" cy="38" r="3" fill="none" stroke={DRONE_HIT} strokeWidth="1" className="pulse-ring-fast" />
                  <circle cx="6" cy="38" r="2" fill={DRONE_HIT} />
                  <text x="16" y="41" fill="#E8E8ED66" fontSize="7" fontFamily="monospace">{t("intel.casualties")}</text>
                  {isAllGCC && <>
                    <circle cx="6" cy="54" r="4" fill="#EF4444" />
                    <text x="16" y="57" fill="#E8E8ED66" fontSize="7" fontFamily="monospace">IRAN STRIKE (US/IL)</text>
                  </>}
                  {showStrategicSites && <>
                    <polygon points={isAllGCC ? "6,66 10,70 6,74 2,70" : "6,50 10,54 6,58 2,54"} fill={STRATEGIC_BLUE} />
                    <text x="16" y={isAllGCC ? 73 : 57} fill="#E8E8ED66" fontSize="7" fontFamily="monospace">{t("intel.strategic")}</text>
                    <circle cx="6" cy={isAllGCC ? 86 : 70} r="4" fill="none" stroke={DESAL_CYAN} strokeWidth="1.5" />
                    <circle cx="6" cy={isAllGCC ? 86 : 70} r="1.5" fill={DESAL_CYAN} />
                    <text x="16" y={isAllGCC ? 89 : 73} fill="#E8E8ED66" fontSize="7" fontFamily="monospace">{t("intel.desalination")}</text>
                  </>}
                </g>

                {/* Strategic sites */}
                {showStrategicSites && sites.map(site => {
                  const { x, y } = proj(site.lat, site.lng);
                  const isSelected = selectedSite?.id === site.id;
                  const isDesal = site.siteType === "desal";
                  const siteColor = isDesal ? DESAL_CYAN : STRATEGIC_BLUE;
                  return (
                    <g key={site.id}
                      onClick={() => setSelectedSite(isSelected ? null : site)}
                      style={{ cursor: "pointer" }}
                    >
                      {isDesal ? <>
                        <circle cx={x} cy={y} r={isSelected ? 5 : 4} fill="none" stroke={isSelected ? "#fff" : siteColor} strokeWidth="1.5" opacity={isSelected ? 1 : 0.85} />
                        <circle cx={x} cy={y} r="1.5" fill={isSelected ? "#fff" : siteColor} opacity={isSelected ? 1 : 0.85} />
                      </> : <>
                        <polygon points={`${x},${y-6} ${x+5},${y} ${x},${y+6} ${x-5},${y}`} fill={isSelected ? "#fff" : siteColor} opacity={isSelected ? 1 : 0.85} />
                        <polygon points={`${x},${y-6} ${x+5},${y} ${x},${y+6} ${x-5},${y}`} fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.5" />
                      </>}
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
                const color = hoveredImpact._iran ? "#EF4444" : hoveredImpact.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT;
                return (
                  <div style={{
                    position: "absolute", left: `${pctX}%`, top: `${pctY}%`,
                    transform: `translate(${pctX > 70 ? "-110%" : "10%"}, -50%)`,
                    background: "#0D1B2Aee", border: `1px solid ${color}`, borderRadius: 6,
                    padding: "10px 14px", pointerEvents: "none", zIndex: 10,
                    minWidth: 180, boxShadow: `0 0 20px ${color}33`
                  }}>
                    <div style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                      {hoveredImpact.name}
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: SUBTEXT, lineHeight: 1.6 }}>
                      <div>{t("intel.type")} {hoveredImpact._iran ? "IRAN STRIKE (US/IL)" : hoveredImpact.type === "drone_hit" ? t("intel.directHitLabel") : t("intel.debrisLabel")}</div>
                      <div>{t("intel.date")} {hoveredImpact.date.toUpperCase()}</div>
                      <div>{t("intel.region")} {(hoveredImpact.region || hoveredImpact.emirate || "").toUpperCase()}</div>
                      <div style={{ color: hoveredImpact.casualties !== "None" ? "#F87171" : "#E8E8ED44" }}>
                        {t("intel.casualtiesLabel")} {hoveredImpact.casualties.toUpperCase()}
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
                const sColor = selectedSite.siteType === "desal" ? DESAL_CYAN : STRATEGIC_BLUE;
                return (
                  <div style={{
                    position: "absolute", left: `${pctX}%`, top: `${pctY}%`,
                    transform: `translate(${pctX > 60 ? "-110%" : "10%"}, -50%)`,
                    background: "#0D1B2Aee", border: `1px solid ${sColor}`, borderRadius: 6,
                    padding: "10px 14px", zIndex: 10,
                    minWidth: 200, boxShadow: `0 0 20px ${sColor}33`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: sColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                        {selectedSite.name}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedSite(null); }} style={{ background: "none", border: GLASS_BORDER, color: SUBTEXT, borderRadius: 4, padding: "1px 6px", cursor: "pointer", fontSize: 8 }}>X</button>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: SUBTEXT, lineHeight: 1.6 }}>
                      <div>{t("intel.type")} {selectedSite.type.toUpperCase()}</div>
                      <div>{t("intel.coords")} {selectedSite.lat.toFixed(4)}°N, {selectedSite.lng.toFixed(4)}°E</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Selected impact detail panel */}
            {selectedImpact && (
              <div style={{
                marginTop: 12, background: "#0D1B2Aee", border: `1px solid ${selectedImpact.type === "drone_hit" ? DRONE_HIT : DEBRIS_HIT}`,
                borderRadius: GLASS_RADIUS, padding: "14px 20px", fontFamily: "monospace"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: themeAccent, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>{t("intel.briefing", { id: selectedImpact.id })}</span>
                  <button onClick={() => setSelectedImpact(null)} style={{ background: "none", border: GLASS_BORDER, color: SUBTEXT, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 9 }}>{t("intel.close")}</button>
                </div>
                <div style={{ fontSize: 13, color: "#34D399", fontWeight: 700, marginBottom: 6 }}>{selectedImpact.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, fontSize: 9, color: SUBTEXT }}>
                  <div><div style={{ color: "#E8E8ED44", marginBottom: 2 }}>{t("intel.weapon")}</div><div style={{ color: TEXT }}>{selectedImpact.type === "drone_hit" ? t("intel.weaponDirect") : t("intel.weaponDebris")}</div></div>
                  <div><div style={{ color: "#E8E8ED44", marginBottom: 2 }}>{t("intel.date")}</div><div style={{ color: TEXT }}>{selectedImpact.date}</div></div>
                  <div><div style={{ color: "#E8E8ED44", marginBottom: 2 }}>{t("intel.region")}</div><div style={{ color: TEXT }}>{selectedImpact.region || selectedImpact.emirate}</div></div>
                  <div><div style={{ color: "#E8E8ED44", marginBottom: 2 }}>{t("intel.casualtiesLabel")}</div><div style={{ color: selectedImpact.casualties !== "None" ? "#F87171" : TEXT }}>{selectedImpact.casualties}</div></div>
                </div>
                <div style={{ fontSize: 9, color: "#E8E8ED44", marginTop: 8 }}>
                  COORDS: {selectedImpact.lat.toFixed(4)}°N, {selectedImpact.lng.toFixed(4)}°E
                </div>
              </div>
            )}

            {/* Strategic sites toggle */}
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: SUBTEXT, fontFamily: "monospace" }}>
                <input type="checkbox" checked={showStrategicSites} onChange={(e) => setShowStrategicSites(e.target.checked)}
                  style={{ accentColor: STRATEGIC_BLUE }} />
                {t("intel.showSites")}
              </label>
            </div>

            {/* Info strip */}
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <StatCard label={t("intel.impactSites")} value={impacts.length} sub={t("intel.confirmedLocations")} color={DRONE_HIT} />
              <StatCard label={t("intel.regionsHit")} value={uniqueRegions.length} sub={uniqueRegions.slice(0, 3).join(", ")} color={DEBRIS_HIT} />
              <StatCard label={t("intel.directHits")} value={directHits} sub={t("intel.directHitDesc")} color={DRONE_HIT} />
              <StatCard label={t("intel.debrisImpacts")} value={debrisHits} sub={t("intel.debrisDesc")} color={DEBRIS_HIT} />
              {totalKIA > 0 && <StatCard label={t("intel.kia")} value={totalKIA} sub="" color="#F87171" />}
              {totalWIA > 0 && <StatCard label={t("intel.wia")} value={totalWIA} sub="" color="#FB923C" />}
            </div>
          </div>
        ); })()}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>

            {/* Pie chart */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("overview.pieTitle")}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" paddingAngle={3}
                    label={({ cx, cy, midAngle, outerRadius: or, name, percent }) => { const RADIAN = Math.PI / 180; const r = or + 25; const x = cx + r * Math.cos(-midAngle * RADIAN); const y = cy + r * Math.sin(-midAngle * RADIAN); return <text x={x} y={y} fill={TEXT} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10}>{`${name} ${(percent * 100).toFixed(1)}%`}</text>; }}
                    labelLine={{ stroke: SUBTEXT, strokeWidth: 1 }} fontSize={11} fill={TEXT}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Category breakdown bar */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("overview.categoryTitle")}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={finalTotals} layout="vertical" barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                  <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={isRTL ? 100 : 80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="detected" name={t("chart.detected")} fill="#FFFFFF15" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="intercepted" name={t("chart.intercepted")} fill={INTERCEPTED} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="impacted" name={t("chart.impacted")} fill={IMPACTED} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Interception rates */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("overview.rateTitle")}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rateData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="category" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} interval={0} height={50} />
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
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 24 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("trends.title")}</h3>
              <p style={{ margin: "0 0 24px", fontSize: 11, color: SUBTEXT }}>{t("trends.subtitle")}</p>
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
                    type="monotone" dataKey="total" name={t("trends.totalAll")}
                    stroke="#FFFFFF" strokeWidth={3} strokeDasharray="6 3"
                    dot={{ fill: "#FFFFFF", r: 6, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 8, fill: "#FFFFFF" }}
                  />
                  {/* Drones */}
                  <Line
                    type="monotone" dataKey="drones" name={t("trends.dronesUAV")}
                    stroke={UAE_GOLD} strokeWidth={2}
                    dot={{ fill: UAE_GOLD, r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Ballistic */}
                  <Line
                    type="monotone" dataKey="ballistic" name={t("trends.ballisticMissiles")}
                    stroke="#3B82F6" strokeWidth={2}
                    dot={{ fill: "#3B82F6", r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Cruise */}
                  <Line
                    type="monotone" dataKey="cruise" name={t("trends.cruiseMissiles")}
                    stroke="#F87171" strokeWidth={2}
                    dot={{ fill: "#F87171", r: 5, strokeWidth: 2, stroke: BG }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Annotation cards below */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {(() => {
                const totals = trendData.map(d => d.total);
                const peakIdx = totals.indexOf(Math.max(...totals));
                const lowestIdx = totals.indexOf(Math.min(...totals));
                return trendData.map((d, i) => (
                <div key={i} style={{
                  background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS,
                  padding: "14px 16px",
                  borderTop: `3px solid ${i === peakIdx ? IMPACTED : i === lowestIdx ? INTERCEPTED : BORDER}`
                }}>
                  <div style={{ fontSize: 11, color: UAE_GOLD, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{d.day}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: TEXT, fontFamily: DM_SANS }}>{d.total}</div>
                  <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 8 }}>{t("trends.totalIncoming")}</div>
                  <div style={{ fontSize: 10, color: "#3B82F6" }}>🚀 {d.ballistic} {t("trends.ballistic")}</div>
                  <div style={{ fontSize: 10, color: UAE_GOLD }}>🚁 {d.drones} {t("trends.drones")}</div>
                  {d.cruise > 0 && <div style={{ fontSize: 10, color: "#F87171" }}>✈️ {d.cruise} {t("trends.cruise")}</div>}
                  {i === peakIdx && <div style={{ fontSize: 9, color: IMPACTED, marginTop: 6, fontWeight: 600 }}>⚠️ {t("trends.peakDay")}</div>}
                  {i === lowestIdx && <div style={{ fontSize: 9, color: INTERCEPTED, marginTop: 6, fontWeight: 600 }}>↓ {t("trends.lowestDay")}</div>}
                </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* DAILY TAB */}
        {activeTab === "daily" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("daily.ballisticTitle")}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>{t("daily.ballisticSub")}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ballisticIntercepted" name={t("chart.intercepted")} fill={INTERCEPTED} radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="ballisticSea" name={t("chart.sea")} fill={SEA} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("daily.dronesTitle")}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>{t("daily.dronesSub")}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="droneIntercepted" name={t("chart.intercepted")} fill={INTERCEPTED} radius={[3, 3, 0, 0]} stackId="a" />
                  <Bar dataKey="droneImpact" name={t("chart.impacted")} fill={IMPACTED} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("daily.totalTitle")}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>{t("daily.totalSub")}</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorBallistic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="ballistic" name={t("trends.ballisticMissiles")} stroke="#3B82F6" fill="url(#colorBallistic)" strokeWidth={2} />
                  <Area type="monotone" dataKey="drones" name={t("trends.drones")} stroke={UAE_GOLD} fill="url(#colorDrones)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>Daily Interception Rate (%)</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>Percentage of detected threats successfully intercepted each day</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} formatter={(value) => [`${value}%`]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="overallRate" name="Overall %" stroke={INTERCEPTED} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  <Line type="monotone" dataKey="ballisticRate" name="Ballistic %" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2.5 }} connectNulls strokeDasharray="5 3" />
                  <Line type="monotone" dataKey="droneRate" name="Drone %" stroke={UAE_GOLD} strokeWidth={2} dot={{ r: 2.5 }} connectNulls strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* CUMULATIVE TAB */}
        {activeTab === "cumulative" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("cumul.title")}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>{t("cumul.subtitle")}</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="gradDetected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="totalDetected" name={t("cumul.detected")} stroke="#3B82F6" fill="url(#gradDetected)" strokeWidth={2} dot={{ fill: "#3B82F6", r: 4 }} />
                  <Area type="monotone" dataKey="totalIntercepted" name={t("cumul.intercepted")} stroke={INTERCEPTED} fill="url(#gradIntercepted)" strokeWidth={2} dot={{ fill: INTERCEPTED, r: 4 }} />
                  <Area type="monotone" dataKey="impacted" name={t("cumul.impacted")} stroke={IMPACTED} fill="none" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: IMPACTED, r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("cumul.impactedTitle")}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>{t("cumul.impactedSub")}</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={cumulativeData} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="impacted" name="Cumulative Impacted" radius={[4, 4, 0, 0]}>
                    {cumulativeData.map((_, i) => (
                      <Cell key={i} fill={`rgba(248, 113, 113, ${0.4 + i * 0.13})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* RATES TAB */}
        {activeTab === "rates" && !isAllGCC && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {[
              n(cumulative.ballisticDetected) > 0 && { label: t("chart.ballisticMissiles"), intercepted: n(cumulative.ballisticIntercepted), total: n(cumulative.ballisticDetected), rate: +((n(cumulative.ballisticIntercepted) / n(cumulative.ballisticDetected)) * 100).toFixed(1), color: "#3B82F6" },
              n(cumulative.cruiseDetected) > 0 && { label: t("chart.cruiseMissiles"), intercepted: n(cumulative.cruiseIntercepted), total: n(cumulative.cruiseDetected), rate: +((n(cumulative.cruiseIntercepted) / n(cumulative.cruiseDetected)) * 100).toFixed(1), color: UAE_GOLD },
              n(cumulative.dronesDetected) > 0 && { label: t("chart.drones"), intercepted: n(cumulative.dronesIntercepted), total: n(cumulative.dronesDetected), rate: +((n(cumulative.dronesIntercepted) / n(cumulative.dronesDetected)) * 100).toFixed(1), color: INTERCEPTED },
              { label: t("chart.overall"), intercepted: totalIntercepted, total: totalDetected, rate: overallRate, color: "#A78BFA" },
            ].filter(Boolean).map((item, i) => (
              <div key={i} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 24 }}>
                <div style={{ fontSize: 12, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: item.color, fontFamily: DM_SANS, lineHeight: 1 }}>{item.rate != null ? `${item.rate}%` : "N/A"}</div>
                <div style={{ fontSize: 11, color: SUBTEXT, marginTop: 6 }}>{t("rates.interceptionRate")}</div>
                <div style={{ marginTop: 16, background: "#FFFFFF06", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${item.rate || 0}%`, background: item.color, borderRadius: 6, transition: "width 0.8s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: SUBTEXT }}>
                  <span>✅ {t("rates.intercepted", { count: item.intercepted.toLocaleString() })}</span>
                  <span>📡 {t("rates.detected", { count: item.total.toLocaleString() })}</span>
                </div>
              </div>
            ))}

            {/* Interceptors Used Per Day */}
            <div style={{ gridColumn: "1 / -1", background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 24 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("rates.interceptorsTitle")}</h3>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: SUBTEXT }}>{t("rates.interceptorsSub")}</p>
              <p style={{ margin: "0 0 16px", fontSize: 10, color: "#E8E8ED44", fontStyle: "italic" }}>{t("rates.interceptorsNote")}</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={interceptorData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="intercepted" name={t("rates.targetsIntercepted")} fill={INTERCEPTED} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="estimatedUsed" name={t("rates.estInterceptors")} fill="#A78BFA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: "#E8E8ED44", marginTop: 8 }}>
                {t("rates.sourceNote")}
              </div>
            </div>
          </div>
        )}

        {/* ARSENAL & DEFENCE TAB */}
        {activeTab === "arsenal" && (() => {
          const attackSystems = [
            {
              name: "Ballistic Missiles", sub: "MRBM", color: "#3B82F6",
              img: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Kheibar_Shekan_%281%29.jpg",
              desc: "High-speed projectiles arcing through the upper atmosphere. Iran's most destructive but costly weapon.",
              types: "Kheibar Shekan, Emad, Fattah-1/2, Ghadr, Sejjil",
              speed: 8500, range: 2500, warhead: 1500, cost: 2750, altitude: 150,
              costLabel: "$500K–$5M", speedLabel: "Mach 7–13+", rangeLabel: "1,300–2,500km", altLabel: "150–1,000km",
            },
            {
              name: "Cruise Missiles", sub: "Subsonic Strike", color: "#F87171",
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
              name: "THAAD", maker: "Lockheed Martin (US)", color: "#3B82F6",
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
              name: "Cheongung-II", maker: "LIG Nex1 (South Korea)", color: "#A78BFA",
              img: "https://upload.wikimedia.org/wikipedia/commons/d/d1/M-SAM_Block-2_battery.jpg",
              target: "Medium-range threats", altitude: 20, range: 40, cost: 2.5,
              costLabel: "$2–3M", desc: "First-ever combat use. $3.5B UAE deal — proved itself here.",
            },
            {
              name: "Barak MX", maker: "IAI (Israel)", color: "#FB923C",
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
            <h3 style={{ margin: 0, fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("arsenal.iranTitle")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              {attackSystems.map((w, i) => (
                <div key={i} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, overflow: "hidden", borderTop: `3px solid ${w.color}` }}>
                  <div style={{ height: 160, overflow: "hidden", position: "relative" }}>
                    <img src={w.img} alt={w.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.7)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 16px 12px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: w.color, fontFamily: DM_SANS }}>{w.name}</div>
                      <div style={{ fontSize: 9, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 1 }}>{w.sub}</div>
                    </div>
                  </div>
                  <div style={{ padding: "12px 16px 16px" }}>
                    <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 10 }}>{w.desc}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT, marginBottom: 10 }}>Types: {w.types}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, textAlign: "center" }}>
                      <div style={{ background: "#FFFFFF06", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.speedLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>SPEED</div>
                      </div>
                      <div style={{ background: "#FFFFFF06", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.altLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>FLIGHT ALTITUDE</div>
                      </div>
                      <div style={{ background: "#FFFFFF06", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.rangeLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>RANGE</div>
                      </div>
                      <div style={{ background: "#FFFFFF06", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: w.color }}>{w.costLabel}</div>
                        <div style={{ fontSize: 8, color: SUBTEXT, marginTop: 2 }}>COST/UNIT</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ATTACK COMPARISON CHART */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 13, color: UAE_GOLD, textTransform: "uppercase", letterSpacing: 2 }}>{t("arsenal.compTitle")}</h3>
              <p style={{ margin: "0 0 16px", fontSize: 11, color: SUBTEXT }}>{t("arsenal.compSub")}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparisonData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="metric" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v.toFixed(1)}%`, ""]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ballistic" name="Ballistic" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cruise" name="Cruise" fill="#F87171" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="drone" name="Drone" fill={UAE_GOLD} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* DEFENCE SYSTEMS — image cards */}
            <h3 style={{ margin: "8px 0 0", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("arsenal.defenceTitle")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {defenceSystems.map((s, i) => (
                <div key={i} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, overflow: "hidden", borderTop: `3px solid ${s.color}` }}>
                  <div style={{ height: 120, overflow: "hidden", position: "relative" }}>
                    <img src={s.img} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.65)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 12px 8px", background: "linear-gradient(transparent, rgba(0,0,0,0.85))" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: DM_SANS }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: SUBTEXT }}>{s.maker}</div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px 14px" }}>
                    <div style={{ fontSize: 10, color: UAE_GOLD, fontWeight: 600, marginBottom: 6 }}>{s.target}</div>
                    <div style={{ fontSize: 10, color: TEXT, lineHeight: 1.4, marginBottom: 8 }}>{s.desc}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, textAlign: "center" }}>
                      <div style={{ background: "#FFFFFF06", borderRadius: 8, padding: "6px 4px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: s.color }}>{s.altitude}km</div>
                        <div style={{ fontSize: 7, color: SUBTEXT }}>ALTITUDE</div>
                      </div>
                      <div style={{ background: "#FFFFFF06", borderRadius: 8, padding: "6px 4px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: IMPACTED }}>{s.costLabel}</div>
                        <div style={{ fontSize: 7, color: SUBTEXT }}>PER SHOT</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DEFENCE COMPARISON CHARTS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: INTERCEPTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("chart.interceptAltitude")}</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>{t("chart.altitudeSub")}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={defenceCompData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `${v}km`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}km`, "Altitude"]} />
                    <Bar dataKey="altitude" name="Max Altitude" radius={[0, 4, 4, 0]}>
                      {defenceCompData.map((_, j) => <Cell key={j} fill={defenceSystems[j].color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("chart.interceptorCost")}</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>{t("chart.costSub")}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={defenceCompData} layout="vertical" barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                    <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={100} />
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
              <h3 style={{ margin: "8px 0 0", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("cost.title")}</h3>

              {/* Summary cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
                {[
                  { label: "Drones", atk: "$20K–$50K", atkC: UAE_GOLD, def: "$1M–$4M", ratio: "20:1 — 200:1" },
                  { label: "Ballistic", atk: "$0.5M–$5M", atkC: "#3B82F6", def: "$4M–$12M", ratio: "4:1 — 12:1" },
                  { label: "Total (5 days)", atk: `~$${costTimeline[costTimeline.length-1]?.cumAtk}M`, atkC: UAE_GOLD, def: `~$${(costTimeline[costTimeline.length-1]?.cumDef/1000).toFixed(1)}B`, ratio: "~$1B/day" },
                ].map((c, i) => (
                  <div key={i} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, textAlign: "center", padding: 16 }}>
                    <div style={{ fontSize: 10, color: SUBTEXT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: TEXT, marginBottom: 4 }}>{t("cost.attack")} <span style={{ color: c.atkC, fontWeight: 700 }}>{c.atk}</span></div>
                    <div style={{ fontSize: 11, color: TEXT, marginBottom: 8 }}>{t("cost.defence")} <span style={{ color: IMPACTED, fontWeight: 700 }}>{c.def}</span></div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: IMPACTED, fontFamily: DM_SANS }}>{c.ratio}</div>
                    <div style={{ fontSize: 10, color: SUBTEXT }}>{i < 2 ? t("cost.disadvantage") : t("cost.dailyCost")}</div>
                  </div>
                ))}
              </div>

              {/* Per-unit cost comparison */}
              <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("chart.costPerUnit")}</h3>
                <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>{t("chart.costPerUnitSub")}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={perUnitData} barCategoryGap="35%">
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: TEXT, fontSize: 12 }} axisLine={false} />
                    <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="attack" name={t("cost.iranAttack")} fill={UAE_GOLD} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="defence" name={t("cost.uaeDefence")} fill={IMPACTED} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Daily cost comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("cost.dailyTitle")}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>{t("cost.dailySub")}</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={costTimeline} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} />
                      <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} tickFormatter={v => `$${v}M`} />
                      <Tooltip content={<CustomTooltip />} formatter={(v) => [`$${v}M`, ""]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="atkDay" name={t("cost.iranAttack")} fill={UAE_GOLD} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="defDay" name={t("cost.uaeDefence")} fill={IMPACTED} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, color: IMPACTED, textTransform: "uppercase", letterSpacing: 2 }}>{t("cost.cumulTitle")}</h3>
                  <p style={{ margin: "0 0 12px", fontSize: 11, color: SUBTEXT }}>{t("cost.cumulSub")}</p>
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
                      <Area type="monotone" dataKey="cumAtk" name={t("cost.iranCumul")} stroke={UAE_GOLD} fill="url(#gradAtk)" strokeWidth={2} dot={{ fill: UAE_GOLD, r: 4 }} />
                      <Area type="monotone" dataKey="cumDef" name={t("cost.uaeCumul")} stroke={IMPACTED} fill="url(#gradDef)" strokeWidth={2} dot={{ fill: IMPACTED, r: 4 }} />
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

      {activeTab === "flights" && (() => {
        const airportDataMap = { DXB: flightData, DWC: flightDataDwc, AUH: flightDataAuh, MCT: flightDataMct, DOH: flightDataDoh };
        const airportCodes = ["DXB", "DWC", "AUH", "MCT", "DOH"];
        const currentFlightData = airportDataMap[selectedAirport];

        if (!currentFlightData || !currentFlightData.daily || currentFlightData.daily.length === 0) return (
          <div style={{ padding: "0 20px" }}>
            {/* Airport sub-tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {airportCodes.map(code => {
                const airportInfo = { DXB: "Dubai Intl — UAE", DWC: "Al Maktoum Intl — UAE", AUH: "Abu Dhabi Intl — UAE", MCT: "Muscat Intl — Oman", DOH: "Hamad Intl — Qatar" };
                const isActive = selectedAirport === code;
                return (
                  <button key={code} onClick={() => setSelectedAirport(code)} style={{
                    padding: "6px 16px", borderRadius: GLASS_RADIUS, border: isActive ? "none" : GLASS_BORDER, cursor: "pointer",
                    background: isActive ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#FFFFFF0A",
                    color: isActive ? "#050B1A" : TEXT,
                    textAlign: "left",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{code}</div>
                    {isActive && <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 1 }}>{airportInfo[code]}</div>}
                  </button>
                );
              })}
            </div>
            <div style={{ padding: 40, textAlign: "center", color: SUBTEXT }}>{t("flights.noData")}</div>
          </div>
        );

        const FLIGHT_GREEN = "#34D399";
        const FLIGHT_AMBER = "#F59E0B";
        const FLIGHT_RED = "#F87171";
        const FLIGHT_BLUE = "#3B82F6";

        const baseline = currentFlightData.baselineDailyAvg || { total: 0, departures: 0, arrivals: 0, regions: {} };
        const daily = currentFlightData.daily || [];

        // Split into pre-conflict and conflict periods
        const conflictStart = "2026-02-28";
        const preConflictDays = daily.filter(d => d.date < conflictStart);
        const conflictDays = daily.filter(d => d.date >= conflictStart);

        // Chart data for main timeline
        const conflictStartLabel = new Date(conflictStart + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        const chartData = daily.map(d => ({
          date: d.date.slice(5),
          label: new Date(d.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          total: d.total,
          departures: d.departures,
          arrivals: d.arrivals,
          baseline: baseline.total,
          capacity: d.total > 0 && baseline.total > 0 ? Math.round((d.total / baseline.total) * 100) : 0,
        }));

        // Latest day stats
        const latest = conflictDays.length > 0 ? conflictDays[conflictDays.length - 1] : null;
        const latestCapacity = latest && baseline.total > 0 ? Math.round((latest.total / baseline.total) * 100) : 0;

        // Regional breakdown for latest conflict day vs baseline
        const REGION_KEYS = ["Middle East", "Europe", "South Asia", "Asia-Pacific", "Africa", "Americas"];
        const regionI18n = {
          "Middle East": t("flights.middleEast"), "Europe": t("flights.europe"),
          "South Asia": t("flights.southAsia"), "Asia-Pacific": t("flights.asiaPacific"),
          "Africa": t("flights.africa"), "Americas": t("flights.americas"),
        };
        const regionColors = {
          "Middle East": "#F59E0B", "Europe": "#3B82F6", "South Asia": "#34D399",
          "Asia-Pacific": "#A78BFA", "Africa": "#FB923C", "Americas": "#F87171",
        };

        const regionalChartData = REGION_KEYS.map(r => ({
          region: regionI18n[r] || r,
          baseline: baseline.regions[r] || 0,
          current: latest ? (latest.regions[r] || 0) : 0,
          color: regionColors[r],
        }));

        // Regional time series
        const regionalTimeSeries = REGION_KEYS.map(r => ({
          key: r,
          label: regionI18n[r] || r,
          color: regionColors[r],
          data: daily.map(d => ({
            label: new Date(d.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
            value: d.regions[r] || 0,
            baseline: baseline.regions[r] || 0,
          })),
        }));

        return (
          <div style={{ padding: "0 20px" }}>
            {/* Title */}
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT }}>{t("flights.title")}</h2>
              <div style={{ fontSize: 12, color: SUBTEXT, marginTop: 4 }}>{t("flights.subtitle")}</div>
            </div>

            {/* Airport sub-tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {airportCodes.map(code => {
                const airportInfo = { DXB: "Dubai Intl — UAE", DWC: "Al Maktoum Intl — UAE", AUH: "Abu Dhabi Intl — UAE", MCT: "Muscat Intl — Oman", DOH: "Hamad Intl — Qatar" };
                const isActive = selectedAirport === code;
                return (
                  <button key={code} onClick={() => setSelectedAirport(code)} style={{
                    padding: "6px 16px", borderRadius: GLASS_RADIUS, border: isActive ? "none" : GLASS_BORDER, cursor: "pointer",
                    background: isActive ? "linear-gradient(135deg, #F59E0B, #D97706)" : "#FFFFFF0A",
                    color: isActive ? "#050B1A" : TEXT,
                    textAlign: "left",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{code}</div>
                    {isActive && <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 1 }}>{airportInfo[code]}</div>}
                  </button>
                );
              })}
            </div>

            {/* Summary stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
              <StatCard label={t("flights.preConflict")} value={baseline.total.toLocaleString()} sub={t("flights.flightsPerDay")} color={FLIGHT_GREEN} />
              <StatCard label={t("flights.total") + (latest ? ` (${new Date(latest.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" })})` : "")} value={latest ? latest.total.toLocaleString() : "—"} sub={latest ? `${t("flights.departures")}: ${latest.departures} / ${t("flights.arrivals")}: ${latest.arrivals}` : ""} color={latestCapacity > 50 ? FLIGHT_AMBER : FLIGHT_RED} />
              <StatCard label={t("flights.currentCapacity")} value={`${latestCapacity}%`} sub={`${t("flights.baseline")}: 100%`} color={latestCapacity > 50 ? FLIGHT_AMBER : FLIGHT_RED} />
            </div>

            {/* Main chart: daily flights vs baseline */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: TEXT }}>{t("flights.total")} — {selectedAirport}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine x={conflictStartLabel} stroke={FLIGHT_RED} strokeDasharray="4 2" strokeWidth={1.5} label={{ value: "Conflict start", position: "top", fill: FLIGHT_RED, fontSize: 9 }} />
                  <Bar dataKey="departures" name={t("flights.departures")} fill={FLIGHT_BLUE} stackId="flights" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="arrivals" name={t("flights.arrivals")} fill={FLIGHT_GREEN} stackId="flights" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="baseline" name={t("flights.baseline")} stroke={FLIGHT_AMBER} strokeWidth={2} strokeDasharray="6 3" dot={false} legendType="line" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Capacity % chart */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: TEXT }}>{t("flights.capacity")} %</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradCap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={FLIGHT_AMBER} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={FLIGHT_AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: TEXT, fontSize: 10 }} axisLine={false} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} domain={[0, 110]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, ""]} />
                  <ReferenceLine x={conflictStartLabel} stroke={FLIGHT_RED} strokeDasharray="4 2" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="capacity" name={t("flights.capacity")} stroke={FLIGHT_AMBER} fill="url(#gradCap)" strokeWidth={2} dot={{ fill: FLIGHT_AMBER, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Regional comparison bar chart */}
            <div style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 20, marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: TEXT }}>{t("flights.regionalTitle")}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={regionalChartData} layout="vertical" barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                  <XAxis type="number" tick={{ fill: SUBTEXT, fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="region" tick={{ fill: TEXT, fontSize: 11 }} axisLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="baseline" name={t("flights.baseline")} fill={FLIGHT_GREEN} opacity={0.5} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="current" name={latest ? new Date(latest.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Current"} fill={FLIGHT_BLUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Regional time series - small multiples */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>
              {regionalTimeSeries.filter(r => r.data.some(d => d.value > 0 || d.baseline > 0)).map(r => (
                <div key={r.key} style={{ background: CARD_BG, backdropFilter: GLASS_BLUR, border: GLASS_BORDER, borderRadius: GLASS_RADIUS, padding: 16 }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: r.color }}>{r.label}</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <ComposedChart data={r.data} barCategoryGap="15%">
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: TEXT, fontSize: 9 }} axisLine={false} interval={2} />
                      <YAxis tick={{ fill: SUBTEXT, fontSize: 9 }} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t("flights.total")} fill={r.color} radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="baseline" name={t("flights.baseline")} stroke={FLIGHT_AMBER} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: "#E8E8ED33", textAlign: "center" }}>{t("flights.source")} / Flightradar24</div>
          </div>
        );
      })()}

      {/* Confirmed Attack Timeline — overview tab only */}
      {activeTab === "overview" && !isIran && !isAllGCC && hasDailyData && rawData.daily && rawData.daily.length > 0 && (
        <div style={{ padding: "0 20px", maxWidth: 900, margin: "32px auto 0" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: TEXT, marginBottom: 20, letterSpacing: -0.3 }}>
            Confirmed Attack Timeline
          </h2>
          <div style={{ position: "relative", paddingLeft: 20, borderLeft: `2px solid ${BORDER}` }}>
            {[...rawData.daily].reverse().map((day, i) => {
              const totalIntercepted = (day.ballisticIntercepted || 0) + (day.cruiseIntercepted || 0) + (day.dronesIntercepted || 0);
              const ballistic = day.ballisticDetected || 0;
              const cruise = day.cruiseDetected || 0;
              const drones = day.dronesDetected || 0;
              const total = ballistic + cruise + drones;
              if (total === 0) return null;
              const ballisticRatio = total > 0 ? ballistic / total : 0;
              const droneRatio = total > 0 ? drones / total : 0;
              const dotColor = ballisticRatio > 0.5 ? "#F87171" : droneRatio > 0.6 ? "#F59E0B" : "#FB923C";
              const isExpanded = expandedTimelineIdx === i;
              return (
                <div key={i} style={{ marginBottom: 16, position: "relative" }}>
                  <div style={{
                    position: "absolute", left: -27, top: 14, width: 12, height: 12,
                    borderRadius: "50%", background: dotColor, border: "2px solid #050B1A"
                  }} />
                  <div
                    onClick={() => setExpandedTimelineIdx(isExpanded ? null : i)}
                    style={{
                      background: CARD_BG, backdropFilter: GLASS_BLUR, border: `1px solid ${isExpanded ? dotColor : BORDER}`,
                      borderRadius: GLASS_RADIUS, padding: "14px 18px", cursor: "pointer",
                      transition: "border-color 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{day.label || day.date}</span>
                      <span style={{ fontSize: 11, color: SUBTEXT }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: SUBTEXT, marginBottom: 6 }}>
                      Total intercepted: <span style={{ color: INTERCEPTED, fontWeight: 700 }}>{totalIntercepted}</span> / {total}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: SUBTEXT }}>
                      {ballistic > 0 && <span>Ballistic: <span style={{ color: "#F87171" }}>{ballistic}</span></span>}
                      {cruise > 0 && <span>Cruise: <span style={{ color: "#3B82F6" }}>{cruise}</span></span>}
                      {drones > 0 && <span>Drones: <span style={{ color: "#F59E0B" }}>{drones}</span></span>}
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Sources</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: SUBTEXT }}>
                            <span style={{ fontSize: 14 }}>🐦</span>
                            <span>UAE MoD official statement — <a href="#" style={{ color: UAE_GOLD, textDecoration: "none" }}>@modgovae</a></span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: SUBTEXT }}>
                            <span style={{ fontSize: 14 }}>🐦</span>
                            <span>CENTCOM press release — <a href="#" style={{ color: UAE_GOLD, textDecoration: "none" }}>@CENTCOM</a></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: "#E8E8ED55", fontFamily: DM_SANS }}>
        {t("footer.text")}
        <br />
        <a href="https://github.com/takahser/uae-dashboard" target="_blank" rel="noopener noreferrer"
          style={{ color: "#E8E8ED33", textDecoration: "none", marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          GitHub
        </a>
      </div>
      {mapModalCountry && (
        <CountryMapModal
          countryCode={mapModalCountry.code}
          countryName={mapModalCountry.name}
          flag={mapModalCountry.flag}
          onClose={() => setMapModalCountry(null)}
        />
      )}
    </div>
  );
}

import Landing from "./Landing";
import HormuzView from "./views/HormuzView";
import DesignShowcase from "./designs/DesignShowcase";

function getViewFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);
  const view = parts[0] || null;
  if (!view) return { view: null };
  if (view === "hormuz") return { view: "hormuz" };
  if (view === "designs") return { view: "designs" };
  if (view === "flights") return { view: "threat", country: "uae", tab: "flights" };
  if (view === "threat") return { view: "threat", country: parts[1] || "all", tab: parts[2] || null };
  return { view: null };
}

function navigateTo(view, country, tab) {
  if (!view) { window.location.hash = "/"; return; }
  if (view === "hormuz") { window.location.hash = "/hormuz"; return; }
  let hash = "/threat";
  if (country && country !== "uae") hash += "/" + country;
  else if (tab) hash += "/uae";
  if (tab) hash += "/" + tab;
  window.location.hash = hash;
}

export default function App() {
  const [appState, setAppState] = useState(getViewFromHash);

  useEffect(() => {
    const onHashChange = () => setAppState(getViewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleSelect = (view) => navigateTo(view);
  const handleBack = () => navigateTo(null);

  if (appState.view === null) return <Landing onSelect={handleSelect} />;
  if (appState.view === "designs") return <DesignShowcase />;
  if (appState.view === "hormuz") return <HormuzView onBack={handleBack} />;
  return <Dashboard onBack={handleBack} initialTab={appState.tab} initialCountry={appState.country} />;
}
