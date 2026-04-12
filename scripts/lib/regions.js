/**
 * Region classification utilities for flight data.
 * Extracted from fetch-flights-mct-doh.js for reuse across multiple fetchers.
 */

/**
 * Classify an airport ICAO code into a geographic region.
 * @param {string} icao - The ICAO airport code
 * @returns {string} The region name
 */
export function classifyRegion(icao) {
  if (!icao) return "Unknown";
  const p = icao.slice(0, 2);
  const c = icao[0];
  if (["VA", "VE", "VI", "VO", "VT", "VG", "VC", "VN", "VQ", "OP"].includes(p))
    return "South Asia";
  if (c === "O") return "Middle East";
  if ("ELUB".includes(c)) return "Europe";
  if ("ZRWY".includes(c) || c === "V") return "Asia-Pacific";
  if ("DFGH".includes(c)) return "Africa";
  if ("KCMSTP".includes(c)) return "Americas";
  return "Other";
}
