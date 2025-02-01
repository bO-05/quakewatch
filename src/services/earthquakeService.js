/**
 * USGS Earthquake Service
 * Documentation: https://earthquake.usgs.gov/fdsnws/event/1/
 */

const USGS_API_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

/**
 * Format a timestamp into a readable date string
 * @param {number} timestamp - Milliseconds since epoch
 * @returns {string} Formatted date string
 */
const formatDate = (timestamp) => {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date.toLocaleString('en-US', {
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
};

/**
 * Get earthquakes within the specified time range
 * @param {Object} params
 * @param {number} params.startTime - Start time in milliseconds
 * @param {number} params.endTime - End time in milliseconds
 * @param {number} [params.minMagnitude=4.5] - Minimum magnitude
 * @returns {Promise<Object>}
 */
export async function getEarthquakes({ 
  startTime = Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  endTime = Date.now(),
  minMagnitude = 4.5 
} = {}) {
  try {
    const params = new URLSearchParams({
      format: 'geojson',
      starttime: new Date(startTime).toISOString().split('.')[0],
      endtime: new Date(endTime).toISOString().split('.')[0],
      minmagnitude: minMagnitude.toString()
    });

    const response = await fetch(`${USGS_API_BASE}?${params}`);
    
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching earthquake data:', error);
    throw error;
  }
}

/**
 * Get the 2011 Japan earthquake data specifically
 * @returns {Promise<Object>}
 */
export async function getJapanEarthquake2011() {
  try {
    // Using exact parameters for the 2011 Japan earthquake
    const params = new URLSearchParams({
      format: 'geojson',
      starttime: '2011-03-11T05:45:00',
      endtime: '2011-03-11T05:47:00',
      latitude: '38.297',
      longitude: '142.373',
      maxradiuskm: '100',
      minmagnitude: '9.0'
    });

    const response = await fetch(`${USGS_API_BASE}?${params}`);
    
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Japan earthquake data:', error);
    throw error;
  }
}

/**
 * Test the USGS API connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    const testParams = new URLSearchParams({
      format: 'geojson',
      limit: '1',
      minmagnitude: '7'
    });

    const response = await fetch(`${USGS_API_BASE}?${testParams}`);
    return response.ok;
  } catch (error) {
    console.error('USGS API connection test failed:', error);
    return false;
  }
}

/**
 * Get recent significant earthquakes
 * @param {Object} options
 * @param {number} [options.days=7] - Number of days to look back
 * @param {number} [options.minMagnitude=5.0] - Minimum magnitude
 * @returns {Promise<Array>} Array of earthquake features
 */
export async function getRecentEarthquakes({ 
  days = 7,
  minMagnitude = 5.0
} = {}) {
  try {
    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    const params = new URLSearchParams({
      format: 'geojson',
      starttime: startTime.toISOString().split('.')[0],
      endtime: endTime.toISOString().split('.')[0],
      minmagnitude: minMagnitude.toString(),
      orderby: 'magnitude',
      limit: 100
    });

    const response = await fetch(`${USGS_API_BASE}?${params}`);
    
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Return the raw GeoJSON features - don't transform them
    return data.features;
  } catch (error) {
    console.error('Error fetching earthquake data:', error);
    throw error;
  }
}
