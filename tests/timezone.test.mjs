/**
 * tests/timezone.test.mjs
 *
 * Unit tests for timezone window helpers in morning-briefing.mjs.
 * Run: node tests/timezone.test.mjs
 */

import { overnightWindow, withinWindow, toLocalMidnightUTC, localParts, truncate } from
  '../scripts/morning-briefing.mjs';

let passed = 0;
let failed = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function assertEq(a, b, name) {
  assert(a === b, name, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertApprox(a, b, toleranceMs, name) {
  assert(Math.abs(a - b) <= toleranceMs, name,
    `expected ~${new Date(b).toISOString()}, got ${new Date(a).toISOString()} (diff ${a-b}ms)`);
}

// ─── toLocalMidnightUTC ───────────────────────────────────────────────────────

console.log('\n── toLocalMidnightUTC ──');

{
  // Dubai (UTC+4): local midnight Apr 7 = UTC Apr 6 20:00
  const result = toLocalMidnightUTC('2026-04-07', 'Asia/Dubai');
  const expected = new Date('2026-04-06T20:00:00.000Z');
  assertApprox(result.getTime(), expected.getTime(), 0,
    'Dubai local midnight 2026-04-07 = UTC 2026-04-06T20:00:00Z');
}

{
  // Bangkok (UTC+7): local midnight Apr 7 = UTC Apr 6 17:00
  const result = toLocalMidnightUTC('2026-04-07', 'Asia/Bangkok');
  const expected = new Date('2026-04-06T17:00:00.000Z');
  assertApprox(result.getTime(), expected.getTime(), 0,
    'Bangkok local midnight 2026-04-07 = UTC 2026-04-06T17:00:00Z');
}

{
  // Zurich winter (UTC+1): local midnight Jan 15 = UTC Jan 14 23:00
  const result = toLocalMidnightUTC('2026-01-15', 'Europe/Zurich');
  const expected = new Date('2026-01-14T23:00:00.000Z');
  assertApprox(result.getTime(), expected.getTime(), 0,
    'Zurich winter (UTC+1) local midnight 2026-01-15 = UTC 2026-01-14T23:00:00Z');
}

{
  // Zurich summer (UTC+2): local midnight Jul 15 = UTC Jul 14 22:00
  const result = toLocalMidnightUTC('2026-07-15', 'Europe/Zurich');
  const expected = new Date('2026-07-14T22:00:00.000Z');
  assertApprox(result.getTime(), expected.getTime(), 0,
    'Zurich summer (UTC+2) local midnight 2026-07-15 = UTC 2026-07-14T22:00:00Z');
}

// ─── overnightWindow ─────────────────────────────────────────────────────────

console.log('\n── overnightWindow ──');

{
  // Dubai: run at 08:00 local on Apr 7 (= UTC 04:00 Apr 7)
  // overnight = [Apr 6 00:00 local, Apr 7 08:00 local)
  //           = [Apr 5 20:00 UTC, Apr 7 04:00 UTC)
  const now = new Date('2026-04-07T04:00:00.000Z'); // 08:00 Dubai
  const [start, end] = overnightWindow('Asia/Dubai', now);
  assertEq(start.toISOString(), '2026-04-05T20:00:00.000Z',
    'Dubai overnight start = UTC 2026-04-05T20:00:00Z');
  assertEq(end.toISOString(), '2026-04-07T04:00:00.000Z',
    'Dubai overnight end = UTC 2026-04-07T04:00:00Z');
}

{
  // Bangkok: run at 08:00 local on Apr 7 (= UTC 01:00 Apr 7)
  // overnight = [Apr 6 00:00 local, Apr 7 08:00 local)
  //           = [Apr 5 17:00 UTC, Apr 7 01:00 UTC)
  const now = new Date('2026-04-07T01:00:00.000Z'); // 08:00 Bangkok
  const [start, end] = overnightWindow('Asia/Bangkok', now);
  assertEq(start.toISOString(), '2026-04-05T17:00:00.000Z',
    'Bangkok overnight start = UTC 2026-04-05T17:00:00Z');
  assertEq(end.toISOString(), '2026-04-07T01:00:00.000Z',
    'Bangkok overnight end = UTC 2026-04-07T01:00:00Z');
}

{
  // Zurich winter: run at 08:00 local Jan 15 (= UTC 07:00 Jan 15)
  // overnight = [Jan 14 00:00 local, Jan 15 08:00 local)
  //           = [Jan 13 23:00 UTC, Jan 15 07:00 UTC)
  const now = new Date('2026-01-15T07:00:00.000Z'); // 08:00 CET
  const [start, end] = overnightWindow('Europe/Zurich', now);
  assertEq(start.toISOString(), '2026-01-13T23:00:00.000Z',
    'Zurich winter overnight start = UTC 2026-01-13T23:00:00Z');
  assertEq(end.toISOString(), '2026-01-15T07:00:00.000Z',
    'Zurich winter overnight end = UTC 2026-01-15T07:00:00Z');
}

{
  // Zurich summer: run at 08:00 local Jul 15 (= UTC 06:00 Jul 15)
  // overnight = [Jul 14 00:00 local, Jul 15 08:00 local)
  //           = [Jul 13 22:00 UTC, Jul 15 06:00 UTC)
  const now = new Date('2026-07-15T06:00:00.000Z'); // 08:00 CEST
  const [start, end] = overnightWindow('Europe/Zurich', now);
  assertEq(start.toISOString(), '2026-07-13T22:00:00.000Z',
    'Zurich summer overnight start = UTC 2026-07-13T22:00:00Z');
  assertEq(end.toISOString(), '2026-07-15T06:00:00.000Z',
    'Zurich summer overnight end = UTC 2026-07-15T06:00:00Z');
}

// ─── withinWindow ─────────────────────────────────────────────────────────────

console.log('\n── withinWindow ──');

{
  const window = [new Date('2026-04-05T20:00:00Z'), new Date('2026-04-07T04:00:00Z')];
  assert(withinWindow('2026-04-05T20:00:00.000Z', window), 'inclusive start');
  assert(!withinWindow('2026-04-07T04:00:00.000Z', window), 'exclusive end');
  assert(withinWindow('2026-04-06T12:00:00.000Z', window), 'midpoint inside');
  assert(!withinWindow('2026-04-05T19:59:59.999Z', window), 'just before start');
  assert(!withinWindow('2026-04-07T04:00:00.001Z', window), 'just after end');
  assert(!withinWindow('2026-04-04T00:00:00Z', window), 'well before window');
  assert(!withinWindow('2026-04-08T00:00:00Z', window), 'well after window');
}

// ─── truncate ─────────────────────────────────────────────────────────────────

console.log('\n── truncate ──');

{
  const short = 'hello world';
  assertEq(truncate(short, 100), short, 'short text unchanged');
}

{
  // 601-word text — should truncate and append …
  const long = Array(601).fill('word').join(' ');
  const result = truncate(long, 600);
  assert(result.endsWith('…'), 'over-budget text gets … appended');
  assert(result.split(/\s+/).length <= 601, 'truncated length is within budget');
}

{
  // Text with cluster spikes section — spikes should be dropped first
  const withSpikes = '☀️ Header\n\n📈 KB topics spiking\n   • Topic A — 10 new tweets\n   • Topic B — 5 new tweets\n\n✈️ Flights\n   DXB: 1,000';
  const words = Array(601).fill('word').join(' ');
  const longWithSpikes = withSpikes + '\n\n' + words;
  const result = truncate(longWithSpikes, 600);
  assert(!result.includes('📈 KB topics spiking'), 'cluster spikes section dropped when over budget');
  assert(result.includes('✈️ Flights'), 'flights section preserved after spike drop');
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
