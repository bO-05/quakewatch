import Supercluster from 'supercluster';
import { normaliseEarthquakes, safeEventUrl } from '../services/earthquakeData.js';

export function getMagnitudeColor(magnitude) {
  if (magnitude >= 7) return '#d32f2f';
  if (magnitude >= 6) return '#f57c00';
  if (magnitude >= 5) return '#ffa000';
  if (magnitude >= 4) return '#fbc02d';
  return '#7cb342';
}

export function formatDate(timestamp) {
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8640000000000000) return 'Time unavailable';
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  }) + ' UTC';
}

export function formatDepth(depth) { return Number.isFinite(depth) ? `${depth.toFixed(1)} km` : 'Unavailable'; }

function toEvent(feature) {
  return {
    id: feature.id, magnitude: feature.properties.mag, location: feature.properties.place,
    coordinates: feature.geometry.coordinates, depth: feature.geometry.coordinates[2],
    time: formatDate(feature.properties.time), timestamp: feature.properties.time, url: feature.properties.url,
  };
}

export function createClusterMarkers(earthquakes, bounds, zoom) {
  const features = normaliseEarthquakes({ type: 'FeatureCollection', features: earthquakes }).map(feature => ({
    ...feature, properties: { ...feature.properties, id: feature.id, depth: feature.geometry.coordinates[2] },
  }));
  if (!features.length) return [];
  const index = new Supercluster({
    radius: 60, maxZoom: 16,
    map: props => ({ count: 1, magnitudeSum: props.mag, depthSum: props.depth ?? 0, depthCount: props.depth === null ? 0 : 1 }),
    reduce: (acc, props) => {
      acc.count += props.count; acc.magnitudeSum += props.magnitudeSum;
      acc.depthSum += props.depthSum; acc.depthCount += props.depthCount;
    },
  });
  index.load(features);
  const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
  return index.getClusters(bbox, Math.max(0, Math.min(16, Math.floor(zoom)))).map(cluster => {
    if (!cluster.properties.cluster) {
      const earthquake = toEvent({ ...cluster, id: cluster.properties.id });
      return { type: 'single', earthquake, coordinates: cluster.geometry.coordinates, magnitude: earthquake.magnitude };
    }
    const p = cluster.properties;
    return {
      type: 'cluster', coordinates: cluster.geometry.coordinates, count: p.point_count,
      avgMagnitude: p.magnitudeSum / p.count, avgDepth: p.depthCount ? p.depthSum / p.depthCount : null,
      points: index.getLeaves(p.cluster_id, 5).map(leaf => toEvent({ ...leaf, id: leaf.properties.id })),
    };
  });
}

export function createMarkerElement(type, data) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = type === 'single' ? 'earthquake-marker' : 'cluster-marker';
  const magnitude = type === 'single' ? data.magnitude : data.avgMagnitude;
  const size = type === 'single' ? Math.max(24, magnitude * 5) : Math.min(Math.max(32, data.count), 60);
  element.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${getMagnitudeColor(magnitude)};border:2px solid white;box-shadow:0 0 5px #0005;cursor:pointer;color:#171b23;font-weight:bold;`;
  element.setAttribute('aria-label', type === 'single' ? `Magnitude ${magnitude.toFixed(1)} earthquake` : `${data.count} earthquakes in cluster`);
  if (type !== 'single') element.textContent = String(data.count);
  return element;
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const magnitudeText = value => Number.isFinite(value) ? value.toFixed(1) : 'Unavailable';

// All service-provided strings are escaped before insertion into Mapbox's HTML popup.
export function createPopupContent(type, data) {
  if (type === 'single') {
    const quake = data.earthquake || data;
    const url = safeEventUrl(quake.url);
    return `<div class="earthquake-popup">
      <h3>M${magnitudeText(quake.magnitude)}</h3>
      <p>${escapeHtml(quake.location || 'Location unavailable')}</p>
      <p>Depth: ${formatDepth(quake.depth)}</p>
      <p>${escapeHtml(quake.time || 'Time unavailable')}</p>
      ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">USGS event details</a>` : ''}
    </div>`;
  }
  const points = (data.points || []).slice(0, 5);
  return `<div class="cluster-popup">
    <h3>Earthquake cluster</h3>
    <p>${Number.isFinite(data.count) ? data.count : 'Unknown'} events</p>
    <p>Mean reported magnitude: ${magnitudeText(data.avgMagnitude)}</p>
    <p>Mean reported depth: ${formatDepth(data.avgDepth)}</p>
    <h4>Events sampled from this cluster</h4>
    ${points.map(point => `<p><strong>M${magnitudeText(point.magnitude)}</strong> ${escapeHtml(point.location)}<br>${escapeHtml(point.time)}</p>`).join('')}
  </div>`;
}

export function createLegend() {
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  const title = document.createElement('strong');
  title.textContent = 'Reported magnitude';
  legend.append(title);
  for (const [value, label] of [[7, '7.0+'], [6, '6.0–6.9'], [5, '5.0–5.9'], [4, '4.0–4.9'], [3, 'Below 4.0']]) {
    const row = document.createElement('div');
    const dot = document.createElement('span');
    dot.style.backgroundColor = getMagnitudeColor(value);
    row.append(dot, document.createTextNode(label));
    legend.append(row);
  }
  return legend;
}