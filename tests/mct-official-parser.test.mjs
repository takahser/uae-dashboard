/**
 * Unit tests for MCT official flight data parser.
 * Uses Node.js built-in test runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { gunzipSync } from "zlib";
import { parseArrivals, parseDepartures } from "../scripts/lib/mct-official-parser.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load fixture file, handling gzip if needed
 */
function loadFixture(filename) {
  const plainPath = join(__dirname, "fixtures", filename);
  const gzippedPath = plainPath + ".gz";
  
  // Prefer plain file if it exists and is under 200KB
  if (existsSync(plainPath)) {
    const stats = readFileSync(plainPath);
    if (stats.length <= 200 * 1024) {
      return stats.toString("utf8");
    }
  }
  
  // Fall back to gzipped version
  if (existsSync(gzippedPath)) {
    const gzipped = readFileSync(gzippedPath);
    return gunzipSync(gzipped).toString("utf8");
  }
  
  throw new Error(`Fixture not found: ${filename} (or ${filename}.gz)`);
}

// Load fixtures
const arrivalsHtml = loadFixture("mct-arrivals-sample.html");
const departuresHtml = loadFixture("mct-departures-sample.html");

describe("MCT Official Parser", () => {
  describe("parseArrivals", () => {
    it("should parse arrivals fixture and return flights", () => {
      const flights = parseArrivals(arrivalsHtml);
      
      // Should have a reasonable number of flights
      assert.ok(flights.length > 0, "Expected at least some arrival flights");
      console.log(`  Parsed ${flights.length} arrival flights`);
      
      // Each flight should have required fields
      const firstFlight = flights[0];
      assert.ok(firstFlight.flightNo, "Flight should have flight number");
      assert.ok(firstFlight.airline, "Flight should have airline");
      assert.ok(firstFlight.originCity, "Flight should have origin city");
      assert.ok(firstFlight.scheduledTime, "Flight should have scheduled time");
      assert.ok(firstFlight.status !== undefined, "Flight should have status");
    });

    it("should parse specific flight details correctly", () => {
      const flights = parseArrivals(arrivalsHtml);
      
      // Find a flight with expected properties
      const flight = flights.find(f => f.flightNo === "OV 286" || f.flightNo === "WY 910");
      
      if (flight) {
        assert.ok(flight.airline, "Flight should have airline name");
        assert.ok(flight.originCity, "Flight should have origin city");
        assert.ok(flight.scheduledTime, "Flight should have scheduled time");
        assert.ok(flight.scheduledTime.includes("T"), "Scheduled time should be ISO format");
      } else {
        console.log("  Note: Specific test flights not found in fixture, skipping detail check");
      }
    });

    it("should filter out cancelled flights", () => {
      // This test verifies the filter logic works
      // If the fixture has no cancelled flights, this just verifies the filter doesn't break
      const flights = parseArrivals(arrivalsHtml);
      const cancelledFlights = flights.filter(f => 
        f.status?.toLowerCase().includes("cancelled") ||
        f.status?.toLowerCase().includes("canceled")
      );
      assert.strictEqual(cancelledFlights.length, 0, "Cancelled flights should be filtered out");
    });

    it("should deduplicate code-share flights", () => {
      const flights = parseArrivals(arrivalsHtml);
      
      // Check for duplicate time+city combinations
      const seen = new Set();
      const duplicates = [];
      
      for (const f of flights) {
        const key = `${f.scheduledTimeKey}|${f.originCity}`;
        if (seen.has(key)) {
          duplicates.push(key);
        }
        seen.add(key);
      }
      
      assert.strictEqual(duplicates.length, 0, `Found duplicate flights: ${duplicates.join(", ")}`);
    });

    it("should return empty array for valid HTML with no flights", () => {
      // Create HTML with table structure but no flight rows
      const emptyHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <table>
            <tbody class="milestone"></tbody>
          </table>
        </body>
        </html>
      `;
      
      const flights = parseArrivals(emptyHtml);
      assert.deepStrictEqual(flights, []);
    });

    it("should throw error when table structure is missing", () => {
      const badHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div>No table here</div>
        </body>
        </html>
      `;
      
      assert.throws(() => {
        parseArrivals(badHtml);
      }, /No table found/);
    });
  });

  describe("parseDepartures", () => {
    it("should parse departures fixture and return flights", () => {
      const flights = parseDepartures(departuresHtml);
      
      // Should have a reasonable number of flights
      assert.ok(flights.length > 0, "Expected at least some departure flights");
      console.log(`  Parsed ${flights.length} departure flights`);
      
      // Each flight should have required fields
      const firstFlight = flights[0];
      assert.ok(firstFlight.flightNo, "Flight should have flight number");
      assert.ok(firstFlight.airline, "Flight should have airline");
      assert.ok(firstFlight.destCity, "Flight should have destination city");
      assert.ok(firstFlight.scheduledTime, "Flight should have scheduled time");
      assert.ok(firstFlight.status !== undefined, "Flight should have status");
    });

    it("should parse destination cities correctly", () => {
      const flights = parseDepartures(departuresHtml);
      
      // Find a flight with expected destination
      const flight = flights.find(f => 
        f.destCity === "Delhi" || 
        f.destCity === "Cairo" || 
        f.destCity === "Kuala Lumpur"
      );
      
      if (flight) {
        assert.ok(flight.destIata || flight.destIata === null, "Flight should have destIata (or null if not mapped)");
        assert.ok(flight.destIcao || flight.destIcao === null, "Flight should have destIcao (or null if not mapped)");
      } else {
        console.log("  Note: Specific test destinations not found in fixture");
      }
    });

    it("should filter out cancelled flights", () => {
      const flights = parseDepartures(departuresHtml);
      const cancelledFlights = flights.filter(f => 
        f.status?.toLowerCase().includes("cancelled") ||
        f.status?.toLowerCase().includes("canceled")
      );
      assert.strictEqual(cancelledFlights.length, 0, "Cancelled flights should be filtered out");
    });

    it("should deduplicate code-share flights", () => {
      const flights = parseDepartures(departuresHtml);
      
      // Check for duplicate time+city combinations
      const seen = new Set();
      const duplicates = [];
      
      for (const f of flights) {
        const key = `${f.scheduledTimeKey}|${f.destCity}`;
        if (seen.has(key)) {
          duplicates.push(key);
        }
        seen.add(key);
      }
      
      assert.strictEqual(duplicates.length, 0, `Found duplicate flights: ${duplicates.join(", ")}`);
    });
  });

  describe("IATA/ICAO mapping", () => {
    it("should map known cities to IATA codes", () => {
      const depFlights = parseDepartures(departuresHtml);
      const arrFlights = parseArrivals(arrivalsHtml);
      
      // Check that at least some flights have IATA codes mapped
      const depsWithIata = depFlights.filter(f => f.destIata);
      const arrsWithIata = arrFlights.filter(f => f.originIata);
      
      console.log(`  Departures with IATA mapping: ${depsWithIata.length}/${depFlights.length}`);
      console.log(`  Arrivals with IATA mapping: ${arrsWithIata.length}/${arrFlights.length}`);
      
      // At least some flights should be mapped
      assert.ok(depsWithIata.length > 0 || depFlights.length === 0, 
        "Some departure flights should have IATA mapping");
      assert.ok(arrsWithIata.length > 0 || arrFlights.length === 0, 
        "Some arrival flights should have IATA mapping");
    });
  });

  describe("Time parsing", () => {
    it("should convert times to ISO format with timezone", () => {
      const flights = parseArrivals(arrivalsHtml);
      
      if (flights.length > 0) {
        const time = flights[0].scheduledTime;
        assert.ok(time.includes("T"), "Time should be ISO format");
        assert.ok(time.endsWith("Z"), "Time should be in UTC (ends with Z)");
      }
    });
  });
});

console.log("Running MCT Official Parser tests...");
