import Supercluster from 'supercluster';

// Get color based on magnitude
export function getMagnitudeColor(magnitude) {
  if (magnitude >= 7.0) return '#d32f2f'; // Red
  if (magnitude >= 6.0) return '#f57c00'; // Orange
  if (magnitude >= 5.0) return '#ffa000'; // Amber
  if (magnitude >= 4.0) return '#fbc02d'; // Yellow
  return '#7cb342'; // Light Green
}

// Format date for display
export function formatDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date unavailable';
  }
}

// Create cluster markers
export function createClusterMarkers(earthquakes, bounds, zoom) {
  if (!earthquakes || !Array.isArray(earthquakes) || earthquakes.length === 0) {
    return [];
  }

  try {
    // Validate GeoJSON features
    const validFeatures = earthquakes.filter(feature => 
      feature && 
      feature.type === 'Feature' &&
      feature.geometry?.type === 'Point' &&
      Array.isArray(feature.geometry.coordinates) &&
      feature.geometry.coordinates.length === 3 &&
      feature.properties?.mag != null &&
      feature.properties?.place &&
      feature.properties?.time
    );

    if (validFeatures.length === 0) {
      console.warn('No valid earthquake features found');
      return [];
    }

    // Create supercluster instance with custom properties
    const index = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minZoom: 0,
      map: props => ({
        mag: props.mag,
        time: props.time,
        place: props.place,
        depth: props.depth || 0,
        id: props.id
      }),
      reduce: (acc, props) => {
        acc.mag = (acc.mag * acc.count + props.mag) / (acc.count + 1);
        acc.depth = (acc.depth * acc.count + (props.depth || 0)) / (acc.count + 1);
      }
    });

    // Load points - they're already in GeoJSON format
    index.load(validFeatures);

    // Get clusters
    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth()
    ];

    const clusters = index.getClusters(bbox, Math.floor(zoom));

    return clusters.map(cluster => {
      if (!cluster.properties.cluster) {
        // Single earthquake
        return {
          type: 'single',
          earthquake: {
            id: cluster.properties.id || cluster.id,
            magnitude: cluster.properties.mag,
            location: cluster.properties.place,
            coordinates: cluster.geometry.coordinates,
            depth: cluster.geometry.coordinates[2],
            time: formatDate(cluster.properties.time),
            timestamp: cluster.properties.time,
            url: cluster.properties.url
          },
          coordinates: cluster.geometry.coordinates,
          magnitude: cluster.properties.mag,
          depth: cluster.geometry.coordinates[2]
        };
      }

      // Get points in cluster
      const leaves = index.getLeaves(cluster.properties.cluster_id, 10);
      const points = leaves.map(leaf => ({
        id: leaf.properties.id,
        magnitude: leaf.properties.mag,
        location: leaf.properties.place,
        coordinates: leaf.geometry.coordinates,
        depth: leaf.geometry.coordinates[2],
        time: formatDate(leaf.properties.time),
        timestamp: leaf.properties.time,
        url: leaf.properties.url
      }));

      return {
        type: 'cluster',
        coordinates: cluster.geometry.coordinates,
        count: cluster.properties.point_count,
        avgMagnitude: cluster.properties.mag || points.reduce((sum, p) => sum + p.magnitude, 0) / points.length,
        avgDepth: cluster.properties.depth || points.reduce((sum, p) => sum + p.depth, 0) / points.length,
        points
      };
    }).filter(Boolean); // Remove any null results
  } catch (error) {
    console.error('Error creating cluster markers:', error);
    return [];
  }
}

// Create HTML element for markers
export function createMarkerElement(type, data) {
  const el = document.createElement('div');
  
  if (type === 'single') {
    el.className = 'earthquake-marker';
    const size = Math.max(20, data.magnitude * 5);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.backgroundColor = getMagnitudeColor(data.magnitude);
    el.style.border = '2px solid white';
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
  } else {
    el.className = 'cluster-marker';
    const size = Math.min(Math.max(30, data.count), 60);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = '50%';
    el.style.backgroundColor = getMagnitudeColor(data.avgMagnitude);
    el.style.border = '3px solid white';
    el.style.color = 'white';
    el.style.textAlign = 'center';
    el.style.lineHeight = `${size}px`;
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
    el.style.fontWeight = 'bold';
    el.textContent = data.count;
  }

  return el;
}

// Create popup content
export function createPopupContent(type, data) {
  try {
    if (type === 'single') {
      const quake = data.earthquake || data;
      if (!quake || typeof quake.magnitude === 'undefined') {
        throw new Error('Invalid earthquake data for popup');
      }

      return `
        <div class="earthquake-popup">
          <h3 style="margin: 0 0 8px 0; color: ${getMagnitudeColor(quake.magnitude)};">
            M${quake.magnitude.toFixed(1)}
          </h3>
          <p style="margin: 4px 0; font-size: 14px;">
            ${quake.location || 'Location unknown'}
          </p>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">
            Depth: ${quake.depth ? quake.depth.toFixed(1) : '?'} km
          </p>
          <p style="margin: 4px 0; font-size: 13px; color: #666;">
            Time: ${quake.time || 'Time unknown'}
          </p>
          ${quake.url ? `
            <a href="${quake.url}" 
               target="_blank" 
               rel="noopener noreferrer"
               style="display: inline-block; margin-top: 8px; color: #2196F3; text-decoration: none; font-size: 13px;">
              More details →
            </a>
          ` : ''}
        </div>
      `;
    }

    // Cluster popup
    if (!data || !Array.isArray(data.points) || data.points.length === 0) {
      throw new Error('Invalid cluster data for popup');
    }

    const points = data.points.slice(0, 5); // Show first 5 earthquakes
    const remaining = data.count - points.length;

    return `
      <div class="cluster-popup">
        <h3 style="margin: 0 0 8px 0;">Earthquake Cluster</h3>
        <p style="margin: 4px 0; font-size: 14px;">
          Contains ${data.count} earthquakes
        </p>
        <p style="margin: 4px 0; font-size: 13px; color: #666;">
          Average magnitude: ${data.avgMagnitude ? data.avgMagnitude.toFixed(1) : '?'}
        </p>
        <p style="margin: 4px 0 12px 0; font-size: 13px; color: #666;">
          Average depth: ${data.avgDepth ? data.avgDepth.toFixed(1) : '?'} km
        </p>
        ${points.length > 0 ? `
          <div style="border-top: 1px solid #eee; padding-top: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 13px;">Recent earthquakes in this cluster:</h4>
            ${points.map(eq => `
              <div style="margin-bottom: 8px;">
                <div style="font-weight: 500; font-size: 13px; color: ${getMagnitudeColor(eq.magnitude)};">
                  M${eq.magnitude.toFixed(1)}
                </div>
                <div style="font-size: 12px;">${eq.location}</div>
                <div style="font-size: 12px; color: #666;">${eq.time}</div>
              </div>
            `).join('')}
            ${remaining > 0 ? `
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                ...and ${remaining} more earthquakes
              </p>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  } catch (error) {
    console.error('Error creating popup content:', error);
    return `
      <div style="padding: 12px;">
        <p style="color: #f44336;">Error displaying earthquake information</p>
      </div>
    `;
  }
}

// Create legend
export function createLegend() {
  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.style.cssText = `
    position: absolute;
    bottom: 30px;
    right: 10px;
    background: white;
    padding: 10px;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    font-size: 12px;
    z-index: 1;
  `;

  const magnitudes = [
    { value: '7.0+', color: getMagnitudeColor(7.0) },
    { value: '6.0-6.9', color: getMagnitudeColor(6.0) },
    { value: '5.0-5.9', color: getMagnitudeColor(5.0) },
    { value: '4.0-4.9', color: getMagnitudeColor(4.0) },
    { value: '<4.0', color: getMagnitudeColor(3.0) }
  ];

  legend.innerHTML = `
    <div style="margin-bottom: 5px;"><strong>Magnitude Scale</strong></div>
    ${magnitudes.map(m => `
      <div style="display: flex; align-items: center; margin: 3px 0;">
        <div style="
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${m.color};
          margin-right: 5px;
          border: 1px solid rgba(0,0,0,0.2);
        "></div>
        <span>${m.value}</span>
      </div>
    `).join('')}
  `;

  return legend;
}
