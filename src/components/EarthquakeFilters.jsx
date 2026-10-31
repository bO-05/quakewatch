import { useState } from 'react';
import PropTypes from 'prop-types';
import { buildEarthquakeUrl } from '../services/earthquakeData';

export default function EarthquakeFilters({ value, onFilterChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const [custom, setCustom] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState('7');
  const [error, setError] = useState(null);
  function apply(next) {
    try { buildEarthquakeUrl(next); setError(null); onFilterChange(next); }
    catch (error) { setError(error.message); }
  }
  return (
    <section className="quake-panel filters-panel" aria-labelledby="filters-title">
      <div className="panel-heading"><h2 id="filters-title">Explore records</h2>
        <button type="button" aria-label={collapsed ? 'Expand filters' : 'Collapse filters'} aria-expanded={!collapsed}
          aria-controls="filter-controls" onClick={() => setCollapsed(value => !value)}>{collapsed ? '+' : '−'}</button>
      </div>
      <div id="filter-controls" hidden={collapsed} className="filter-controls">
        <label htmlFor="magnitude-slider">Minimum magnitude: <strong>{value.minMagnitude.toFixed(1)}</strong></label>
        <input id="magnitude-slider" type="range" min="4" max="9" step="0.1" value={value.minMagnitude}
          onChange={event => apply({ ...value, minMagnitude: Number(event.target.value) })} />
        <fieldset><legend>Time range</legend><div className="range-options">
          {[[1, '24 hours'], [7, '7 days'], [30, '30 days']].map(([days, label]) => (
            <button key={days} type="button" aria-pressed={!custom && !value.startDate && value.days === days}
              onClick={() => { setCustom(false); apply({ days, minMagnitude: value.minMagnitude }); }}>{label}</button>
          ))}
          <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}>Custom range</button>
        </div></fieldset>
        {custom && <div className="custom-range">
          <label htmlFor="range-start">Start date (UTC)</label>
          <input id="range-start" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          <label htmlFor="range-end">End date (UTC)</label>
          <input id="range-end" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          <button type="button" onClick={() => apply({ startDate, endDate, minMagnitude: value.minMagnitude })}>Apply dates</button>
          <label htmlFor="custom-days">Or look back 1–365 days</label>
          <input id="custom-days" type="number" min="1" max="365" value={days} onChange={event => setDays(event.target.value)} />
          <button type="button" onClick={() => apply({ days: Number(days), minMagnitude: value.minMagnitude })}>Apply day count</button>
        </div>}
        {error && <p className="filter-error" role="alert">{error}</p>}
        <p className="filter-note">USGS query, capped at 100 records. No predictions, alert delivery, or completeness guarantee.</p>
      </div>
    </section>
  );
}

EarthquakeFilters.propTypes = {
  value: PropTypes.shape({
    days: PropTypes.number, minMagnitude: PropTypes.number.isRequired,
    startDate: PropTypes.string, endDate: PropTypes.string,
  }).isRequired,
  onFilterChange: PropTypes.func.isRequired,
};