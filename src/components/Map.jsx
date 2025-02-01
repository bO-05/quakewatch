import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getRecentEarthquakes } from '../services/earthquakeService';
import EarthquakeFilters from './EarthquakeFilters';
import EarthquakeList from './EarthquakeList';
import { 
  createClusterMarkers, 
  createMarkerElement, 
  createPopupContent, 
  createLegend 
} from '../utils/mapUtils';

mapboxgl.accessToken = "pk.eyJ1IjoiYmxlc3NlZGJ5aG9wZSIsImEiOiJjbTY2ZTN2cHcwMG0yMmxzOTNhaWF0Z3B5In0.aob78sdxiznzatk3FhQAUw";

export default function Map() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const legendRef = useRef(null);
  const updateTimeoutRef = useRef(null);
  const [earthquakes, setEarthquakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Clear existing markers
  const clearMarkers = useCallback(() => {
    if (markersRef.current) {
      markersRef.current.forEach(marker => {
        if (marker && typeof marker.remove === 'function') {
          marker.remove();
        }
      });
      markersRef.current = [];
    }
  }, []);

  // Update markers based on current view
  const updateMarkers = useCallback(() => {
    if (!mapRef.current || !earthquakes.length) return;

    const map = mapRef.current;
    if (!map.loaded()) return;

    try {
      clearMarkers();
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      const markers = createClusterMarkers(earthquakes, bounds, zoom);
      if (!markers || !markers.length) return;

      markersRef.current = markers.map(marker => {
        if (!marker || !marker.coordinates) return null;

        const el = createMarkerElement(
          marker.type,
          marker.type === 'single' ? marker.earthquake : marker
        );

        if (!el) return null;

        // Create popup
        const popup = new mapboxgl.Popup({ 
          offset: marker.type === 'single' ? marker.magnitude * 5 : 30,
          closeButton: true,
          closeOnClick: false,
          maxWidth: '300px'
        }).setHTML(createPopupContent(marker.type, marker.type === 'single' ? marker.earthquake : marker));

        // Add marker to map
        const mapMarker = new mapboxgl.Marker({
          element: el,
          anchor: 'center'
        })
          .setLngLat(marker.coordinates)
          .setPopup(popup)
          .addTo(map);

        // Add click handler for clusters
        if (marker.type === 'cluster') {
          el.addEventListener('click', () => {
            map.flyTo({
              center: marker.coordinates,
              zoom: Math.min(map.getZoom() + 2, 16),
              duration: 1000
            });
          });
        }

        return mapMarker;
      }).filter(Boolean);
    } catch (err) {
      console.error('Error updating markers:', err);
      setError('Error displaying earthquake data');
    }
  }, [earthquakes, clearMarkers]);

  // Load earthquake data
  const loadEarthquakes = useCallback(async (days = 7, minMagnitude = 4.5) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecentEarthquakes({ days, minMagnitude });
      if (!Array.isArray(data)) {
        throw new Error('Invalid earthquake data received');
      }
      setEarthquakes(data);
    } catch (err) {
      console.error('Error loading earthquakes:', err);
      setError('Failed to load earthquake data');
      setEarthquakes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback(({ minMagnitude, days }) => {
    loadEarthquakes(days, minMagnitude);
  }, [loadEarthquakes]);

  // Handle earthquake selection
  const handleEarthquakeSelect = useCallback((earthquake) => {
    if (!mapRef.current || !earthquake?.coordinates) return;

    const map = mapRef.current;
    
    try {
      // Remove existing popups
      const existingPopups = document.getElementsByClassName('mapboxgl-popup');
      Array.from(existingPopups).forEach(popup => popup.remove());
      
      // Fly to the earthquake location
      map.flyTo({
        center: [earthquake.coordinates[0], earthquake.coordinates[1]],
        zoom: 8,
        duration: 2000,
        essential: true // This ensures the animation runs smoothly
      });

      // Create a popup for the selected earthquake
      new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px',
        className: 'earthquake-popup'
      })
        .setLngLat([earthquake.coordinates[0], earthquake.coordinates[1]])
        .setHTML(createPopupContent('single', { earthquake }))
        .addTo(map);
    } catch (error) {
      console.error('Error handling earthquake selection:', error);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [150, 0],
      zoom: 2
    });

    mapRef.current = map;

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add legend
    const legend = createLegend();
    if (legend) {
      legendRef.current = legend;
      mapContainerRef.current.appendChild(legend);
    }

    // Load initial data once map is ready
    map.once('load', () => {
      loadEarthquakes();
    });

    // Cleanup function
    return () => {
      clearMarkers();
      if (legendRef.current && legendRef.current.parentNode) {
        legendRef.current.parentNode.removeChild(legendRef.current);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [clearMarkers, loadEarthquakes]);

  // Set up map event handlers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapUpdate = () => {
      if (!map.loaded()) return;

      // Clear any pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Schedule new update
      updateTimeoutRef.current = setTimeout(() => {
        updateMarkers();
        updateTimeoutRef.current = null;
      }, 100);
    };

    map.on('moveend', handleMapUpdate);
    map.on('zoomend', handleMapUpdate);

    return () => {
      map.off('moveend', handleMapUpdate);
      map.off('zoomend', handleMapUpdate);
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [updateMarkers]);

  // Update markers when earthquake data changes
  useEffect(() => {
    if (mapRef.current?.loaded() && earthquakes.length > 0) {
      updateMarkers();
    }
  }, [earthquakes, updateMarkers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Filters */}
      <EarthquakeFilters onFilterChange={handleFilterChange} />
      
      {/* Earthquake List */}
      <EarthquakeList 
        earthquakes={earthquakes}
        loading={loading}
        error={error}
        onEarthquakeSelect={handleEarthquakeSelect}
      />

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          Loading earthquakes...
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#f44336',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '4px',
          zIndex: 1000
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
