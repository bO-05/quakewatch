import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClusterMarkers, createPopupContent, formatDate, formatDepth } from '../src/utils/mapUtils.js';
const bounds = { getWest: () => -180, getSouth: () => -85, getEast: () => 180, getNorth: () => 85 };
const point = (i, depth = i) => ({
  type: 'Feature', id: `fixture-${i}`,
  geometry: { type: 'Point', coordinates: [140 + i / 1000, 35, depth] },
  properties: { mag: 4 + i / 100, time: i * 1000, place: `Fictional record ${i}`, url: null },
});
test('popup text cannot inject tags, attributes, or non-USGS links', () => {
  const html = createPopupContent('single', {
    magnitude: 5, depth: 0, location: '<img src=x onerror="alert(1)">', time: '<script>bad()</script>', url: 'javascript:alert(1)',
  });
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&quot;'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href='));
  assert.ok(html.includes('0.0 km'));
});
test('official event links remain safe and open with opener protection', () => {
  const html = createPopupContent('single', { magnitude: 4, depth: null, url: 'https://earthquake.usgs.gov/?a=1&b=2' });
  assert.ok(html.includes('a=1&amp;b=2'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  assert.ok(html.includes('Unavailable'));
});
test('cluster popup text is escaped too', () => {
  const html = createPopupContent('cluster', { count: 2, avgMagnitude: 5, avgDepth: null, points: [{ magnitude: 5, location: '<iframe>', time: '<svg onload=bad()>' }] });
  assert.ok(!html.includes('<iframe>'));
  assert.ok(!html.includes('<svg'));
});
test('cluster arithmetic covers every point, not only popup sample leaves', () => {
  const markers = createClusterMarkers(Array.from({ length: 20 }, (_, i) => point(i)), bounds, 0);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].count, 20);
  assert.ok(Math.abs(markers[0].avgMagnitude - 4.095) < 1e-10);
  assert.equal(markers[0].avgDepth, 9.5);
  assert.equal(markers[0].points.length, 5);
});
test('missing depth does not corrupt the mean and zero depth is retained', () => {
  const [cluster] = createClusterMarkers([point(0, 0), point(1, null)], bounds, 0);
  assert.equal(cluster.avgDepth, 0);
  assert.equal(cluster.count, 2);
});
test('single markers preserve source identity, depth, and UTC time', () => {
  const [marker] = createClusterMarkers([point(0)], bounds, 16);
  assert.equal(marker.type, 'single');
  assert.equal(marker.earthquake.id, 'fixture-0');
  assert.equal(marker.earthquake.depth, 0);
  assert.ok(marker.earthquake.time.endsWith(' UTC'));
});
test('empty data creates no markers', () => assert.deepEqual(createClusterMarkers([], bounds, 0), []));
test('date and depth formatting distinguish unknown from zero', () => {
  assert.equal(formatDate(NaN), 'Time unavailable');
  assert.ok(formatDate(0).includes('1970'));
  assert.equal(formatDepth(null), 'Unavailable');
  assert.equal(formatDepth(0), '0.0 km');
});
