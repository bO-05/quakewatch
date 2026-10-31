export const EARTHQUAKE_LIMIT = 100;
const DAY = 86400000;
const ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const MAX_RESPONSE_BYTES = 1024 * 1024;

function utcDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose valid UTC dates.');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Choose valid UTC dates.');
  return time;
}

export function buildEarthquakeUrl({ days = 7, minMagnitude = 5, startDate, endDate } = {}, now = Date.now()) {
  if (!Number.isFinite(minMagnitude) || minMagnitude < 0 || minMagnitude > 10) throw new Error('Choose a magnitude between 0 and 10.');
  let start;
  let end;
  if (startDate !== undefined || endDate !== undefined) {
    start = utcDate(startDate);
    end = utcDate(endDate) + DAY - 1;
    if (start > end || end - start >= 366 * DAY || start > now) throw new Error('Choose an ordered date range of at most 366 UTC days.');
    end = Math.min(end, now);
  } else {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Choose between 1 and 365 days.');
    end = now;
    start = end - days * DAY;
  }
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    format: 'geojson', starttime: new Date(start).toISOString(), endtime: new Date(end).toISOString(),
    minmagnitude: String(minMagnitude), orderby: 'magnitude', limit: String(EARTHQUAKE_LIMIT),
  });
  return url;
}

export function safeEventUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'earthquake.usgs.gov' && !url.port && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function normaliseEarthquakes(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('The data service returned an invalid collection.');
  const seen = new Set();
  return data.features.slice(0, EARTHQUAKE_LIMIT).flatMap((feature) => {
    const p = feature?.properties;
    const c = feature?.geometry?.coordinates;
    if (feature?.type !== 'Feature' || feature.geometry?.type !== 'Point' || !Array.isArray(c) ||
      !Number.isFinite(c[0]) || Math.abs(c[0]) > 180 || !Number.isFinite(c[1]) || Math.abs(c[1]) > 90 ||
      !Number.isFinite(p?.mag) || Math.abs(p.mag) > 10 || !Number.isFinite(p?.time) || Math.abs(p.time) > 8640000000000000 ||
      (typeof feature.id !== 'string' && typeof feature.id !== 'number')) return [];
    const id = String(feature.id).trim().slice(0, 191);
    if (!id || (typeof feature.id === 'number' && !Number.isFinite(feature.id)) || seen.has(id)) return [];
    seen.add(id);
    return [{
      type: 'Feature', id,
      geometry: { type: 'Point', coordinates: [c[0], c[1], Number.isFinite(c[2]) ? c[2] : null] },
      properties: {
        mag: p.mag, time: p.time, place: typeof p.place === 'string' ? p.place.slice(0, 500) : 'Location unavailable',
        url: safeEventUrl(p.url),
      },
    }];
  });
}

export async function fetchRecentEarthquakes(options = {}, { signal, timeoutMs = 15000 } = {}) {
  const url = buildEarthquakeUrl(options);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/geo+json, application/json' } });
    if (!response.ok) { await response.body?.cancel(); throw new Error('The USGS data service is unavailable.'); }
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new Error('The data response is too large.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The data response is empty.');
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('The data response is too large.'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return normaliseEarthquakes(JSON.parse(new TextDecoder().decode(bytes)));
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
