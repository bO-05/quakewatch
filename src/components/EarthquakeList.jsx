import { useState } from 'react';
import PropTypes from 'prop-types';
import { formatDate, formatDepth } from '../utils/mapUtils';

export default function EarthquakeList({ earthquakes = [], loading, error, selectedId, onEarthquakeSelect, onRetry }) {
  const [collapsed, setCollapsed] = useState(false);
  const events = [...earthquakes].sort((a, b) => b.properties.mag - a.properties.mag).map(feature => ({
    id: feature.id, magnitude: feature.properties.mag, location: feature.properties.place,
    coordinates: feature.geometry.coordinates, depth: feature.geometry.coordinates[2],
    time: formatDate(feature.properties.time), url: feature.properties.url,
  }));
  return (
    <section className="quake-panel events-panel" aria-labelledby="events-title">
      <div className="panel-heading">
        <h2 id="events-title">Matching events <span>({events.length})</span></h2>
        <button type="button" aria-label={collapsed ? 'Expand event list' : 'Collapse event list'}
          aria-expanded={!collapsed} aria-controls="event-list" onClick={() => setCollapsed(value => !value)}>
          {collapsed ? '+' : '−'}
        </button>
      </div>
      <div id="event-list" hidden={collapsed} className="event-list" aria-busy={loading}>
        <div className="list-toolbar">
          <p role="status">{loading ? 'Loading earthquake records…' : `${events.length} matching records shown`}</p>
          <button type="button" onClick={onRetry} disabled={loading}>Refresh data</button>
        </div>
        {error ? <div className="data-error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Retry data request</button></div>
          : !loading && events.length === 0 ? <p className="empty-state">No valid records match these filters. This does not mean there is no seismic activity.</p>
            : !loading && <ol className="event-records">{events.map(event => (
              <li key={event.id}>
                <button type="button" className="event-select" aria-pressed={selectedId === event.id}
                  onClick={() => onEarthquakeSelect(event)}>
                  <strong>Magnitude {event.magnitude.toFixed(1)}</strong>
                  <span>{event.location}</span><time>{event.time}</time>
                  <span className="event-depth">Depth: {formatDepth(event.depth)}</span>
                </button>
                {event.url && <a href={event.url} target="_blank" rel="noopener noreferrer">USGS event details</a>}
              </li>
            ))}</ol>}
      </div>
    </section>
  );
}

EarthquakeList.propTypes = {
  earthquakes: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    properties: PropTypes.shape({ mag: PropTypes.number, place: PropTypes.string, time: PropTypes.number, url: PropTypes.string }),
    geometry: PropTypes.shape({ coordinates: PropTypes.arrayOf(PropTypes.number) }),
  })),
  loading: PropTypes.bool, error: PropTypes.string, selectedId: PropTypes.string,
  onEarthquakeSelect: PropTypes.func.isRequired, onRetry: PropTypes.func.isRequired,
};