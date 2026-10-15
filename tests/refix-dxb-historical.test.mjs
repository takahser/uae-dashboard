/**
 * tests/refix-dxb-historical.test.mjs
 *
 * Unit tests for the DXB historical codeshare refix script.
 * Uses Node.js built-in test runner; no network access required.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));

import {
  parseArgs,
  getDatesInRange,
  countsEqual,
  computeRegions,
  processDate,
  buildPatchedEntry,
  recomputeAggregates,
  readAudit,
  writeAuditEntryNoPrune,
  main,
} from "../scripts/refix-dxb-historical.mjs";

// Committed fixture for aggregate derivation — not mutated by the script
const FIXTURE_DATA = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "dxb-preconflict.json"), "utf8")
);

function makeFlight(icao) {
  return { movement: { airport: { icao } } };
}

function makeEntry(overrides = {}) {
  return {
    date: "2026-02-18",
    departures: 10,
    arrivals: 12,
    total: 22,
    regions: { Europe: 22 },
    source: "aerodatabox",
    ...overrides,
  };
}

describe("parseArgs", () => {
  it("uses defaults when no flags are passed", () => {
    const args = parseArgs([]);
    assert.strictEqual(args.dryRun, false);
    assert.strictEqual(args.airport, "DXB");
    assert.strictEqual(args.from, "2026-02-18");
    assert.strictEqual(args.to, "2026-04-01");
  });

  it("parses --dry-run, --from, --to and --airport", () => {
    const args = parseArgs([
      "--dry-run",
      "--from",
      "2026-03-01",
      "--to",
      "2026-03-05",
      "--airport",
      "dxb",
    ]);
    assert.strictEqual(args.dryRun, true);
    assert.strictEqual(args.airport, "DXB");
    assert.strictEqual(args.from, "2026-03-01");
    assert.strictEqual(args.to, "2026-03-05");
  });
});

describe("getDatesInRange", () => {
  it("returns inclusive date range", () => {
    const dates = getDatesInRange("2026-02-18", "2026-02-20");
    assert.deepStrictEqual(dates, ["2026-02-18", "2026-02-19", "2026-02-20"]);
  });
});

describe("computeRegions", () => {
  it("classifies flights by destination/origin ICAO", () => {
    const departures = [makeFlight("EGLL"), makeFlight("OMDB")];
    const arrivals = [makeFlight("VABB"), makeFlight("KJFK")];
    const regions = computeRegions(departures, arrivals);
    assert.strictEqual(regions.Europe, 1);
    assert.strictEqual(regions["Middle East"], 1);
    assert.strictEqual(regions["South Asia"], 1);
    assert.strictEqual(regions.Americas, 1);
  });
});

describe("processDate", () => {
  it("skips when stored and fetched counts match", () => {
    const oldEntry = makeEntry();
    const fetched = { departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 } };
    const result = processDate(oldEntry, fetched);
    assert.strictEqual(result.action, "skip");
  });

  it("patches when counts differ and adds note/corrected flags", () => {
    const oldEntry = makeEntry();
    const fetched = {
      departures: 11,
      arrivals: 13,
      total: 24,
      regions: { Europe: 20, "Middle East": 4 },
    };
    const result = processDate(oldEntry, fetched);
    assert.strictEqual(result.action, "patch");
    assert.strictEqual(result.entry.departures, 11);
    assert.strictEqual(result.entry.arrivals, 13);
    assert.strictEqual(result.entry.total, 24);
    assert.deepStrictEqual(result.entry.regions, { Europe: 20, "Middle East": 4 });
    assert.strictEqual(result.entry.corrected, true);
    assert.strictEqual(result.entry.note, "Fixed: withCodeshared=false (operating flights only)");
    assert.ok(result.entry.correctedAt);
    assert.strictEqual(result.entry.source, "aerodatabox");
  });

  it("preserves cancelled and source fields when patching", () => {
    const oldEntry = makeEntry({ cancelled: 5, source: "custom" });
    const fetched = { departures: 11, arrivals: 13, total: 24, regions: {} };
    const result = processDate(oldEntry, fetched);
    assert.strictEqual(result.action, "patch");
    assert.strictEqual(result.entry.cancelled, 5);
    assert.strictEqual(result.entry.source, "custom");
  });

  it("does not omit corrected/note when entry was already corrected before", () => {
    const oldEntry = makeEntry({ corrected: true, correctedAt: "2026-01-01T00:00:00.000Z" });
    const fetched = { departures: 11, arrivals: 13, total: 24, regions: {} };
    const result = processDate(oldEntry, fetched);
    assert.strictEqual(result.action, "patch");
    assert.strictEqual(result.entry.corrected, true);
    assert.notStrictEqual(result.entry.correctedAt, "2026-01-01T00:00:00.000Z");
  });

  it("triggers zero-return guard when fetched total is 0 but stored total > 0", () => {
    const oldEntry = makeEntry();
    const fetched = { departures: 0, arrivals: 0, total: 0, regions: {} };
    const result = processDate(oldEntry, fetched);
    assert.strictEqual(result.action, "zero-guard");
  });

  it("does not trigger zero-return guard when stored total is also 0", () => {
    const oldEntry = makeEntry({ departures: 0, arrivals: 0, total: 0 });
    const fetched = { departures: 0, arrivals: 0, total: 0, regions: {} };
    const result = processDate(oldEntry, fetched);
    assert.strictEqual(result.action, "skip");
  });
});

describe("recomputeAggregates", () => {
  it("recomputes preConflictAvg and baselineDailyAvg from a committed fixture", () => {
    const { preConflictAvg, baselineDailyAvg } = recomputeAggregates(
      FIXTURE_DATA.daily,
      "2026-02-18",
      "2026-02-27"
    );
    assert.strictEqual(preConflictAvg, 1210);
    assert.strictEqual(baselineDailyAvg.total, 1210);
    assert.strictEqual(baselineDailyAvg.departures, 600);
    assert.strictEqual(baselineDailyAvg.arrivals, 610);
    assert.strictEqual(baselineDailyAvg.regions.Europe, 300);
    assert.strictEqual(baselineDailyAvg.regions["South Asia"], 250);
    assert.strictEqual(baselineDailyAvg.regions["Middle East"], 200);
    assert.strictEqual(baselineDailyAvg.regions.Americas, 150);
    assert.strictEqual(baselineDailyAvg.regions["East Asia"], 150);
    assert.strictEqual(baselineDailyAvg.regions.Africa, 100);
    assert.strictEqual(baselineDailyAvg.regions["Southeast Asia"], 59);
  });

  it("rounds means to integers", () => {
    const daily = [
      { date: "2026-02-18", departures: 1, arrivals: 2, total: 3, regions: { A: 1 } },
      { date: "2026-02-19", departures: 2, arrivals: 3, total: 4, regions: { A: 2 } },
      { date: "2026-02-20", departures: 3, arrivals: 4, total: 5, regions: { A: 3 } },
    ];
    const { preConflictAvg, baselineDailyAvg } = recomputeAggregates(
      daily,
      "2026-02-18",
      "2026-02-20"
    );
    assert.strictEqual(preConflictAvg, 4);
    assert.strictEqual(baselineDailyAvg.total, 4);
    assert.strictEqual(baselineDailyAvg.departures, 2);
    assert.strictEqual(baselineDailyAvg.arrivals, 3);
    assert.strictEqual(baselineDailyAvg.regions.A, 2);
  });
});

describe("writeAuditEntryNoPrune", () => {
  let tmpDir;
  let auditFile;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "refix-audit-"));
    auditFile = join(tmpDir, "audit.json");
    writeFileSync(auditFile, JSON.stringify({ corrections: [] }, null, 2) + "\n");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends a correction with reason codeshare-refix", () => {
    writeAuditEntryNoPrune(
      {
        iata: "DXB",
        date: "2026-02-18",
        old: { departures: 10, arrivals: 12, total: 22 },
        new: { departures: 11, arrivals: 13, total: 24 },
        correctedAt: "2026-04-01T00:00:00.000Z",
        reason: "codeshare-refix",
      },
      auditFile
    );
    const audit = readAudit(auditFile);
    assert.strictEqual(audit.corrections.length, 1);
    assert.strictEqual(audit.corrections[0].reason, "codeshare-refix");
    assert.strictEqual(audit.corrections[0].delta.total, 2);
  });

  it("deduplicates on iata+date", () => {
    const base = {
      iata: "DXB",
      date: "2026-02-18",
      old: { departures: 10, arrivals: 12, total: 22 },
      new: { departures: 11, arrivals: 13, total: 24 },
      correctedAt: "2026-04-01T00:00:00.000Z",
      reason: "codeshare-refix",
    };
    writeAuditEntryNoPrune(base, auditFile);
    writeAuditEntryNoPrune(
      { ...base, new: { departures: 12, arrivals: 14, total: 26 }, correctedAt: "2026-04-02T00:00:00.000Z" },
      auditFile
    );
    const audit = readAudit(auditFile);
    assert.strictEqual(audit.corrections.length, 1);
    assert.strictEqual(audit.corrections[0].new.total, 26);
    assert.strictEqual(audit.corrections[0].correctedAt, "2026-04-02T00:00:00.000Z");
  });

  it("keeps February rows and does not prune old corrections", () => {
    // Seed an old correction that a 90-day prune would remove
    const old = {
      corrections: [
        {
          iata: "DXB",
          date: "2025-01-01",
          old: { departures: 1, arrivals: 1, total: 2 },
          new: { departures: 2, arrivals: 2, total: 4 },
          delta: { departures: 1, arrivals: 1, total: 2 },
          correctedAt: "2025-01-02T00:00:00.000Z",
          reason: "day-before-correction",
        },
      ],
    };
    writeFileSync(auditFile, JSON.stringify(old, null, 2) + "\n");

    writeAuditEntryNoPrune(
      {
        iata: "DXB",
        date: "2026-02-18",
        old: { departures: 10, arrivals: 12, total: 22 },
        new: { departures: 11, arrivals: 13, total: 24 },
        correctedAt: "2026-04-01T00:00:00.000Z",
        reason: "codeshare-refix",
      },
      auditFile
    );

    const audit = readAudit(auditFile);
    assert.strictEqual(audit.corrections.length, 2);
    assert.ok(audit.corrections.some((c) => c.date === "2025-01-01"));
    assert.ok(audit.corrections.some((c) => c.date === "2026-02-18"));
    assert.strictEqual(audit.lastPruned, undefined);
  });
});

describe("main orchestration", () => {
  let tmpDir;
  let dataFile;
  let auditFile;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "refix-main-"));
    dataFile = join(tmpDir, "data-flights-dxb.json");
    auditFile = join(tmpDir, "data-flights-audit.json");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeData(daily) {
    writeFileSync(
      dataFile,
      JSON.stringify(
        {
          airport: "OMDB",
          daily,
          preConflictAvg: 0,
          baselineDailyAvg: { total: 0, departures: 0, arrivals: 0, regions: {} },
        },
        null,
        2
      ) + "\n"
    );
    writeFileSync(auditFile, JSON.stringify({ corrections: [] }, null, 2) + "\n");
  }

  it("patches differing days and recomputes aggregates", async () => {
    writeData([
      { date: "2026-02-18", departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 }, source: "aerodatabox" },
      { date: "2026-02-19", departures: 11, arrivals: 13, total: 24, regions: { Europe: 24 }, source: "aerodatabox" },
      { date: "2026-02-20", departures: 5, arrivals: 5, total: 10, regions: { Europe: 10 }, source: "aerodatabox" },
    ]);

    const fetched = {
      "2026-02-18": { departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 } },
      "2026-02-19": { departures: 12, arrivals: 14, total: 26, regions: { Europe: 26 } },
      "2026-02-20": { departures: 5, arrivals: 5, total: 10, regions: { Europe: 10 } },
    };

    const deps = {
      fetchDayCounts: (_icao, date) => Promise.resolve(fetched[date]),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: (path, data, dry) => {
        if (!dry) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      },
      writeAuditEntryNoPrune: (entry, file, dry) => {
        if (!dry) writeAuditEntryNoPrune(entry, file);
      },
      auditFile,
      onDateDelay: () => Promise.resolve(),
    };

    const result = await main(
      ["--from", "2026-02-18", "--to", "2026-02-20"],
      { RAPIDAPI_KEY: "test-key" },
      deps
    );

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.patchedDates.length, 1);
    assert.strictEqual(result.patchedDates[0].date, "2026-02-19");
    assert.strictEqual(result.preConflictAvg, 19); // round((22+26+10)/3) = 19

    const written = JSON.parse(readFileSync(dataFile, "utf8"));
    const feb19 = written.daily.find((d) => d.date === "2026-02-19");
    assert.strictEqual(feb19.total, 26);
    assert.strictEqual(feb19.corrected, true);
    assert.strictEqual(feb19.note, "Fixed: withCodeshared=false (operating flights only)");

    const audit = readAudit(auditFile);
    assert.strictEqual(audit.corrections.length, 1);
    assert.strictEqual(audit.corrections[0].reason, "codeshare-refix");
    assert.strictEqual(audit.corrections[0].date, "2026-02-19");
  });

  it("skips equal days and still recomputes aggregates", async () => {
    writeData([
      { date: "2026-02-18", departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 }, source: "aerodatabox" },
      { date: "2026-02-19", departures: 11, arrivals: 13, total: 24, regions: { Europe: 24 }, source: "aerodatabox" },
    ]);

    const fetched = {
      "2026-02-18": { departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 } },
      "2026-02-19": { departures: 11, arrivals: 13, total: 24, regions: { Europe: 24 } },
    };

    const deps = {
      fetchDayCounts: (_icao, date) => Promise.resolve(fetched[date]),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: (path, data, dry) => {
        if (!dry) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      },
      writeAuditEntryNoPrune: (entry, file, dry) => {
        if (!dry) writeAuditEntryNoPrune(entry, file);
      },
      auditFile,
      onDateDelay: () => Promise.resolve(),
    };

    const result = await main(
      ["--from", "2026-02-18", "--to", "2026-02-19"],
      { RAPIDAPI_KEY: "test-key" },
      deps
    );

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.patchedDates.length, 0);
    assert.strictEqual(result.preConflictAvg, 23);

    const audit = readAudit(auditFile);
    assert.strictEqual(audit.corrections.length, 0);
  });

  it("treats zero-return as a failure and exits non-zero", async () => {
    writeData([
      { date: "2026-02-18", departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 }, source: "aerodatabox" },
    ]);

    const deps = {
      fetchDayCounts: () => Promise.resolve({ departures: 0, arrivals: 0, total: 0, regions: {} }),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: () => {},
      writeAuditEntryNoPrune: () => {},
      onDateDelay: () => Promise.resolve(),
    };

    const result = await main(
      ["--from", "2026-02-18", "--to", "2026-02-18"],
      { RAPIDAPI_KEY: "test-key" },
      deps
    );

    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.failedDates.length, 1);
    assert.ok(result.failedDates[0].reason.includes("0 flights"));
  });

  it("aborts before writing on 401/403 for the first date", async () => {
    writeData([
      { date: "2026-02-18", departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 }, source: "aerodatabox" },
    ]);

    const error = new Error("HTTP 403 — forbidden");
    error.status = 403;

    let wroteData = false;
    const deps = {
      fetchDayCounts: () => Promise.reject(error),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: () => {
        wroteData = true;
      },
      writeAuditEntryNoPrune: () => {},
      onDateDelay: () => Promise.resolve(),
    };

    const result = await main(
      ["--from", "2026-02-18", "--to", "2026-02-18"],
      { RAPIDAPI_KEY: "test-key" },
      deps
    );

    assert.strictEqual(result.aborted, true);
    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(wroteData, false);
  });

  it("repairs 2026-04-02 regions even when counts are unchanged", async () => {
    writeData([
      { date: "2026-04-01", departures: 225, arrivals: 220, total: 445, regions: { Europe: 445 }, source: "aerodatabox" },
      {
        date: "2026-04-02",
        departures: 228,
        arrivals: 224,
        total: 452,
        regions: { Europe: 300, Unknown: 152 },
        source: "aerodatabox",
      },
    ]);

    const fetched = {
      "2026-04-01": { departures: 225, arrivals: 220, total: 445, regions: { Europe: 445 } },
      "2026-04-02": { departures: 228, arrivals: 224, total: 452, regions: { Europe: 452 } },
    };

    const deps = {
      fetchDayCounts: (_icao, date) => Promise.resolve(fetched[date]),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: (path, data, dry) => {
        if (!dry) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      },
      writeAuditEntryNoPrune: (entry, file, dry) => {
        if (!dry) writeAuditEntryNoPrune(entry, file);
      },
      auditFile,
      onDateDelay: () => Promise.resolve(),
    };

    const result = await main(
      ["--from", "2026-04-01", "--to", "2026-04-01"],
      { RAPIDAPI_KEY: "test-key" },
      deps
    );

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.patchedDates.length, 1);
    assert.strictEqual(result.patchedDates[0].date, "2026-04-02");

    const written = JSON.parse(readFileSync(dataFile, "utf8"));
    const apr2 = written.daily.find((d) => d.date === "2026-04-02");
    assert.strictEqual(apr2.total, 452);
    assert.strictEqual(apr2.regions.Europe, 452);
    assert.strictEqual(apr2.regions.Unknown, undefined);
  });

  it("applies zero-return guard during 2026-04-02 region repair", async () => {
    writeData([
      { date: "2026-04-01", departures: 225, arrivals: 220, total: 445, regions: { Europe: 445 }, source: "aerodatabox" },
      {
        date: "2026-04-02",
        departures: 228,
        arrivals: 224,
        total: 452,
        regions: { Europe: 300, Unknown: 152 },
        source: "aerodatabox",
      },
    ]);

    const fetched = {
      "2026-04-01": { departures: 225, arrivals: 220, total: 445, regions: { Europe: 445 } },
      "2026-04-02": { departures: 0, arrivals: 0, total: 0, regions: {} },
    };

    const deps = {
      fetchDayCounts: (_icao, date) => Promise.resolve(fetched[date]),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: (path, data, dry) => {
        if (!dry) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      },
      writeAuditEntryNoPrune: (entry, file, dry) => {
        if (!dry) writeAuditEntryNoPrune(entry, file);
      },
      auditFile,
      onDateDelay: () => Promise.resolve(),
    };

    const result = await main(
      ["--from", "2026-04-01", "--to", "2026-04-01"],
      { RAPIDAPI_KEY: "test-key" },
      deps
    );

    assert.strictEqual(result.exitCode, 1);
    assert.strictEqual(result.patchedDates.length, 0);
    assert.strictEqual(result.failedDates.length, 1);
    assert.strictEqual(result.failedDates[0].date, "2026-04-02");
    assert.ok(result.failedDates[0].reason.includes("0 flights"));

    const written = JSON.parse(readFileSync(dataFile, "utf8"));
    const apr2 = written.daily.find((d) => d.date === "2026-04-02");
    assert.strictEqual(apr2.total, 452);
    assert.strictEqual(apr2.regions.Unknown, 152);
  });

  it("produces byte-identical output on a second unchanged run", async () => {
    writeData([
      { date: "2026-02-18", departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 }, source: "aerodatabox" },
      { date: "2026-02-19", departures: 11, arrivals: 13, total: 24, regions: { Europe: 24 }, source: "aerodatabox" },
      {
        date: "2026-04-02",
        departures: 228,
        arrivals: 224,
        total: 452,
        regions: { Europe: 452 },
        source: "aerodatabox",
      },
    ]);

    const fetched = {
      "2026-02-18": { departures: 10, arrivals: 12, total: 22, regions: { Europe: 22 } },
      "2026-02-19": { departures: 11, arrivals: 13, total: 24, regions: { Europe: 24 } },
      "2026-04-02": { departures: 228, arrivals: 224, total: 452, regions: { Europe: 452 } },
    };

    const deps = {
      fetchDayCounts: (_icao, date) => Promise.resolve(fetched[date]),
      readDataFile: () => ({
        dataFile,
        data: JSON.parse(readFileSync(dataFile, "utf8")),
      }),
      writeDataFile: (path, data, dry) => {
        if (!dry) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      },
      writeAuditEntryNoPrune: (entry, file, dry) => {
        if (!dry) writeAuditEntryNoPrune(entry, file);
      },
      auditFile,
      onDateDelay: () => Promise.resolve(),
    };

    await main(["--from", "2026-02-18", "--to", "2026-02-19"], { RAPIDAPI_KEY: "test-key" }, deps);
    const afterFirst = readFileSync(dataFile, "utf8");

    await main(["--from", "2026-02-18", "--to", "2026-02-19"], { RAPIDAPI_KEY: "test-key" }, deps);
    const afterSecond = readFileSync(dataFile, "utf8");

    assert.strictEqual(afterSecond, afterFirst);

    const audit = readAudit(auditFile);
    assert.strictEqual(audit.corrections.length, 0);
  });
});
