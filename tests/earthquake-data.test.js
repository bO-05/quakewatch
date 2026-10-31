import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { buildEarthquakeUrl, fetchRecentEarthquakes, normaliseEarthquakes, safeEventUrl } from '../src/services/earthquakeData.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const feature = (overrides = {}) => ({
  type: 'Feature', id: 'fictional-fixture',
  geometry: { type: 'Point', coordinates: [140, 35, 0] },
  properties: { mag: 5, time: 0, place: 'Fictional offshore record', url: 'https://earthquake.usgs.gov/earthquakes/eventpage/fixture' },
  ...overrides,
});
const collection = features => ({ type: 'FeatureCollection', features });
const now = Date.UTC(2026, 9, 31, 12);

test('default query is bounded, magnitude ordered, and uses an exact seven-day window', () => {
  const url = buildEarthquakeUrl({}, now);
  assert.equal(url.origin, 'https://earthquake.usgs.gov');
  assert.equal(url.searchParams.get('limit'), '100');
  assert.equal(url.searchParams.get('orderby'), 'magnitude');
  assert.equal(url.searchParams.get('minmagnitude'), '5');
  assert.equal(Date.parse(url.searchParams.get('endtime')) - Date.parse(url.searchParams.get('starttime')), 7 * 86400000);
});
test('custom dates select the requested UTC interval, not days ending today', () => {
  const url = buildEarthquakeUrl({ startDate: '2011-03-11', endDate: '2011-03-12' }, now);
  assert.equal(url.searchParams.get('starttime'), '2011-03-11T00:00:00.000Z');
  assert.equal(url.searchParams.get('endtime'), '2011-03-12T23:59:59.999Z');
});
test('empty, impossible, reversed, excessive, and future ranges are rejected', () => {
  for (const options of [
    { startDate: '', endDate: '2026-01-01' },
    { startDate: '2026-02-30', endDate: '2026-03-02' },
    { startDate: '2026-02-02', endDate: '2026-02-01' },
    { startDate: '2020-01-01', endDate: '2026-01-01' },
    { startDate: '2099-01-01', endDate: '2099-01-02' },
  ]) assert.throws(() => buildEarthquakeUrl(options, now));
});
test('current UTC end date never requests a future instant', () => {
  const url = buildEarthquakeUrl({ startDate: '2026-10-31', endDate: '2026-10-31' }, now);
  assert.equal(url.searchParams.get('endtime'), new Date(now).toISOString());
});
test('invalid magnitude and day counts are refused before fetch', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No request expected'); };
  for (const options of [{ days: 0 }, { days: 366 }, { days: 1.5 }, { minMagnitude: NaN }, { minMagnitude: 11 }]) {
    await assert.rejects(fetchRecentEarthquakes(options));
  }
  assert.equal(calls, 0);
});
test('normalization rejects malformed records and preserves zero depth and epoch time', () => {
  const result = normaliseEarthquakes(collection([
    feature(), feature({ id: 'bad-location', geometry: { type: 'Point', coordinates: [181, 35, 3] } }),
    feature({ id: 'no-magnitude', properties: { mag: null, time: 1 } }), null,
  ]));
  assert.equal(result.length, 1);
  assert.equal(result[0].geometry.coordinates[2], 0);
  assert.equal(result[0].properties.time, 0);
});
test('unavailable depth is null, not an invented zero', () => {
  const result = normaliseEarthquakes(collection([feature({ geometry: { type: 'Point', coordinates: [140, 35] } })]));
  assert.equal(result[0].geometry.coordinates[2], null);
});
test('duplicate, empty, non-finite identities and impossible magnitudes are dropped', () => {
  const result = normaliseEarthquakes(collection([
    feature(), feature(), feature({ id: ' ' }), feature({ id: NaN }),
    feature({ id: 'impossible', properties: { mag: 1000, time: 0 } }),
  ]));
  assert.equal(result.length, 1);
});
test('collection processing stays capped at one hundred records', () => {
  const result = normaliseEarthquakes(collection(Array.from({ length: 120 }, (_, i) => feature({ id: String(i) }))));
  assert.equal(result.length, 100);
});
test('event links allow only credential-free HTTPS USGS URLs', () => {
  assert.ok(safeEventUrl('https://earthquake.usgs.gov/earthquakes/eventpage/fixture'));
  for (const value of ['javascript:alert(1)', 'http://earthquake.usgs.gov/', 'https://earthquake.usgs.gov.evil.example/', 'https://earthquake.usgs.gov:444/', 'https://user:pass@earthquake.usgs.gov/', undefined]) {
    assert.equal(safeEventUrl(value), null);
  }
});
test('successful fetch uses the bounded endpoint and normalizes the collection', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url.searchParams.get('limit'), '100');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(collection([feature()]));
  };
  assert.equal((await fetchRecentEarthquakes()).length, 1);
});
test('HTTP failures and invalid collections are not treated as empty success', async () => {
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(fetchRecentEarthquakes());
  globalThis.fetch = async () => Response.json({ unexpected: [] });
  await assert.rejects(fetchRecentEarthquakes());
});
test('advertised and actual oversized bodies are refused', async () => {
  globalThis.fetch = async () => new Response('{}', { headers: { 'content-length': String(1024 * 1024 + 1) } });
  await assert.rejects(fetchRecentEarthquakes(), /too large/);
  let cancelled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(fetchRecentEarthquakes(), /too large/);
  assert.equal(cancelled, true);
});
test('caller cancellation reaches fetch', async () => {
  globalThis.fetch = (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
  });
  const controller = new AbortController();
  const request = fetchRecentEarthquakes({}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});
test('an already-cancelled request never reaches fetch', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No fetch expected'); };
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchRecentEarthquakes({}, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});
test('a stalled request is aborted by its timeout', async () => {
  globalThis.fetch = (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
  });
  await assert.rejects(fetchRecentEarthquakes({}, { timeoutMs: 10 }), { name: 'AbortError' });
});
