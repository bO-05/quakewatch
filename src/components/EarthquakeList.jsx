import { useState } from 'react';
import { formatDate } from '../utils/mapUtils';

export default function EarthquakeList({ earthquakes = [], loading, error, onEarthquakeSelect }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: 20 });

  // Transform and sort earthquakes by magnitude
  const sortedEarthquakes = [...earthquakes]
    .map(feature => ({
      id: feature.id,
      magnitude: feature.properties.mag,
      location: feature.properties.place,
      coordinates: feature.geometry.coordinates,
      depth: feature.geometry.coordinates[2],
      time: formatDate(feature.properties.time),
      timestamp: feature.properties.time,
      url: feature.properties.url
    }))
    .sort((a, b) => b.magnitude - a.magnitude);

  if (error) {
    return (
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
    );
  }

  return (
    <div 
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        width: isCollapsed ? 'auto' : '300px',
        maxHeight: '80vh',
        zIndex: 1000,
        transition: 'width 0.3s ease',
        cursor: 'move'
      }}
      draggable
      onDragStart={(e) => {
        const rect = e.target.getBoundingClientRect();
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.setDragImage(e.target, rect.width / 2, 10);
      }}
      onDrag={(e) => {
        if (e.clientX === 0 && e.clientY === 0) return; // Ignore invalid positions
        setPosition({
          x: e.clientX - 150, // Half of width
          y: e.clientY - 10
        });
      }}
    >
      {/* Header/Handle */}
      <div style={{
        padding: '8px 12px',
        borderBottom: isCollapsed ? 'none' : '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: '8px 8px 0 0',
        background: '#f8f8f8'
      }}>
        <span style={{ fontWeight: '500', fontSize: '14px' }}>
          Recent Earthquakes ({sortedEarthquakes.length})
        </span>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px'
          }}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div style={{ 
          overflowY: 'auto',
          maxHeight: 'calc(80vh - 40px)',
          padding: loading ? '12px' : '0'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#666' }}>
              Loading earthquakes...
            </div>
          ) : sortedEarthquakes.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
              No earthquakes found
            </div>
          ) : (
            sortedEarthquakes.map((earthquake) => (
              <div
                key={earthquake.id}
                onClick={() => onEarthquakeSelect?.(earthquake)}
                style={{
                  padding: '12px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  ':hover': {
                    backgroundColor: '#f5f5f5'
                  }
                }}
              >
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  <span style={{ 
                    fontWeight: '500',
                    color: earthquake.magnitude >= 6.0 ? '#d32f2f' : 
                           earthquake.magnitude >= 5.0 ? '#f57c00' : '#2e7d32'
                  }}>
                    Magnitude {earthquake.magnitude.toFixed(1)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {earthquake.time}
                  </span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  {earthquake.location}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Depth: {earthquake.depth.toFixed(1)}km
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
