import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getRecentEarthquakes } from '../services/earthquakeService';
import EarthquakeFilters from './EarthquakeFilters';
import EarthquakeList from './EarthquakeList';
import { createClusterMarkers, createMarkerElement, createPopupContent, createLegend } from '../utils/mapUtils';

const mapToken = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim();
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Map() {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(mapToken ? null : 'Map tiles are not configured on this deployment. The event list and filters still work.');
  const [query, setQuery] = useState({ days: 7, minMagnitude: 5 });
  const [refresh, setRefresh] = useState(0);
  const [earthquakes, setEarthquakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const retry = useCallback(() => setRefresh(value => value + 1), []);
  const clearMarkers = useCallback(() => {
    markers.current.forEach(marker => marker.remove());
    markers.current = [];
  }, []);

  // Data access does not depend on a map token, WebGL, or the map's load event.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setEarthquakes([]);
      setSelectedId(null);
      try {
        const data = await getRecentEarthquakes(query, { signal: controller.signal });
        if (!active) return;
        setEarthquakes(data);
        setUpdatedAt(Date.now());
      } catch {
        if (active && !controller.signal.aborted) setError('Unable to load USGS records. Try again. This is not an emergency alert service.');
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query, refresh]);

  useEffect(() => {
    if (!mapToken || !container.current) return;
    let map;
    let legend;
    let timeout;
    try {
      mapboxgl.accessToken = mapToken;
      map = new mapboxgl.Map({
        container: container.current, style: 'mapbox://styles/mapbox/streets-v12',
        center: [150, 0], zoom: 2,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      legend = createLegend();
      container.current.appendChild(legend);
      timeout = setTimeout(() => {
        if (!map.loaded()) setMapError('Map tiles did not load. The event list and filters are independent of the map.');
      }, 15000);
      map.once('load', () => { clearTimeout(timeout); setMapReady(true); setMapError(null); });
      map.on('error', () => setMapError('Map tiles are unavailable. You can still read and filter the USGS event list.'));
    } catch {
      setMapError('This browser could not initialize the map. The event list and filters still work.');
    }
    return () => {
      clearTimeout(timeout);
      clearMarkers();
      legend?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, [clearMarkers]);

  const updateMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    clearMarkers();
    try {
      markers.current = createClusterMarkers(earthquakes, map.getBounds(), map.getZoom()).map(marker => {
        const data = marker.type === 'single' ? marker.earthquake : marker;
        const element = createMarkerElement(marker.type, data);
        const popup = new mapboxgl.Popup({ offset: 24, closeOnClick: false, maxWidth: '300px' })
          .setHTML(createPopupContent(marker.type, data));
        if (marker.type === 'cluster') element.addEventListener('click', () => map.flyTo({
          center: marker.coordinates, zoom: Math.min(map.getZoom() + 2, 16), animate: !reducedMotion(),
        }));
        return new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat(marker.coordinates).setPopup(popup).addTo(map);
      });
    } catch {
      setMapError('Some map markers could not be displayed. The validated event list is still available.');
    }
  }, [earthquakes, clearMarkers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    let timer;
    const update = () => { clearTimeout(timer); timer = setTimeout(updateMarkers, 100); };
    updateMarkers();
    map.on('moveend', update);
    map.on('zoomend', update);
    return () => {
      clearTimeout(timer);
      map.off('moveend', update);
      map.off('zoomend', update);
      clearMarkers();
    };
  }, [updateMarkers, clearMarkers, mapReady]);

  const selectEvent = useCallback(earthquake => {
    setSelectedId(earthquake.id);
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.getContainer().querySelectorAll('.mapboxgl-popup').forEach(popup => popup.remove());
    map.flyTo({ center: earthquake.coordinates.slice(0, 2), zoom: 8, animate: !reducedMotion() });
    new mapboxgl.Popup({ maxWidth: '300px' })
      .setLngLat(earthquake.coordinates.slice(0, 2)).setHTML(createPopupContent('single', earthquake)).addTo(map);
  }, [mapReady]);

  return (
    <main className="quakewatch">
      <header className="app-heading">
        <div><p className="eyebrow">USGS data explorer / prototype</p><h1>QuakeWatch</h1></div>
        <p>Explore reported events, not predictions.<br /><strong>Not an emergency alert or safety service.</strong></p>
      </header>
      <div className="explorer-body">
        <section className="map-surface" aria-label="Earthquake map">
          <div ref={container} className="map-canvas" />
          {mapError && <p className="map-notice" role="status">{mapError}</p>}
        </section>
        <EarthquakeFilters value={query} onFilterChange={setQuery} />
        <EarthquakeList earthquakes={earthquakes} loading={loading} error={error}
          selectedId={selectedId} onEarthquakeSelect={selectEvent} onRetry={retry} />
      </div>
      <footer className="app-footer">
        <p>Up to 100 matching valid point records, highest magnitude first. Times and selected dates use UTC. Reports can be revised.</p>
        <p>Fetched on load, filter change, or refresh, not continuously monitored.
          {updatedAt && <> Last successful fetch: {new Date(updatedAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC.</>}
          {' '}<a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener noreferrer">Source: USGS</a>
        </p>
      </footer>
    </main>
  );
}