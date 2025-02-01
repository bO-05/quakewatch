import { useState, useCallback, useEffect } from 'react';

export default function EarthquakeFilters({ onFilterChange }) {
  const [minMagnitude, setMinMagnitude] = useState(5.0);
  const [selectedTimeRange, setSelectedTimeRange] = useState({ label: '7 Days', days: 7 });
  const [customDays, setCustomDays] = useState(7);
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });

  // Use debounced filter change for magnitude slider
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedTimeRange.days === null) {
        // If custom date range is selected, calculate days between dates
        if (customDateRange.start && customDateRange.end) {
          const diffTime = Math.abs(customDateRange.end - customDateRange.start);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          onFilterChange({ minMagnitude, days: diffDays });
        } else {
          onFilterChange({ minMagnitude, days: customDays });
        }
      } else {
        onFilterChange({ minMagnitude, days: selectedTimeRange.days });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [minMagnitude, selectedTimeRange, customDays, customDateRange, onFilterChange]);

  const handleTimeRangeChange = (range) => {
    setSelectedTimeRange(range);
    if (range.days !== null) {
      onFilterChange({ minMagnitude, days: range.days });
    }
  };

  const handleCustomDateChange = (type, value) => {
    setCustomDateRange(prev => ({
      ...prev,
      [type]: value
    }));
  };

  return (
    <div 
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        width: isCollapsed ? 'auto' : '250px',
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
        if (e.clientX === 0 && e.clientY === 0) return;
        setPosition({
          x: e.clientX - 125,
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
          Earthquake Filters
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
        <div style={{ padding: '12px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label 
              htmlFor="magnitude-slider" 
              style={{ 
                display: 'block', 
                marginBottom: '6px',
                fontSize: '12px',
                color: '#666'
              }}
            >
              Minimum Magnitude: {minMagnitude}
            </label>
            <input
              id="magnitude-slider"
              type="range"
              min="4.0"
              max="9.0"
              step="0.1"
              value={minMagnitude}
              onChange={(e) => setMinMagnitude(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px',
              fontSize: '12px',
              color: '#666'
            }}>
              Time Range
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[
                { label: '24 Hours', days: 1 },
                { label: '7 Days', days: 7 },
                { label: '30 Days', days: 30 },
                { label: 'Custom Range', days: null }
              ].map((range) => (
                <button
                  key={range.label}
                  onClick={() => handleTimeRangeChange(range)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    background: selectedTimeRange.label === range.label ? '#0078d4' : 'white',
                    color: selectedTimeRange.label === range.label ? 'white' : 'black',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {selectedTimeRange.days === null && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ 
                    display: 'block',
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '4px'
                  }}>
                    Start Date:
                  </label>
                  <input
                    type="date"
                    value={customDateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => handleCustomDateChange('start', new Date(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ 
                    display: 'block',
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '4px'
                  }}>
                    End Date:
                  </label>
                  <input
                    type="date"
                    value={customDateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => handleCustomDateChange('end', new Date(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '4px'
                  }}>
                    Or enter number of days:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={customDays}
                    onChange={(e) => {
                      const days = parseInt(e.target.value, 10);
                      setCustomDays(days);
                      // Update end date to today and start date based on days
                      const end = new Date();
                      const start = new Date(end - days * 24 * 60 * 60 * 1000);
                      setCustomDateRange({ start, end });
                    }}
                    style={{
                      width: '100%',
                      padding: '6px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}
                    placeholder="Enter number of days"
                  />
                  <span style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#666',
                    marginTop: '4px'
                  }}>
                    Days from today (max: 365)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
