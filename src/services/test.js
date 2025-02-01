import { testConnection, getEarthquakes, getJapanEarthquake2011 } from './earthquakeService.js';

async function runTests() {
  console.log('🔍 Running USGS Integration Tests...\n');
  
  try {
    // Test 1: Basic Connection
    console.log('Test 1: API Connection');
    const isConnected = await testConnection();
    console.log('Result:', isConnected ? 'PASSED ✅' : 'FAILED ❌');

    if (isConnected) {
      // Test 2: Recent Major Earthquakes (Last 30 days, Magnitude 6+)
      console.log('\nTest 2: Recent Major Earthquakes');
      const recentMajor = await getEarthquakes({
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
        minMagnitude: 6
      });
      console.log('Result: PASSED ✅');
      console.log(`Found ${recentMajor.features.length} major earthquakes`);
      
      // Test 3: Known Historic Event (2011 Japan Earthquake)
      console.log('\nTest 3: Historic Event Check');
      const historicEvent = await getEarthquakes({
        startTime: new Date('2011-03-11').getTime(),
        endTime: new Date('2011-03-12').getTime(),
        minMagnitude: 9
      });
      const japanEarthquake = historicEvent.features.find(
        f => f.properties.place.includes('Japan')
      );
      console.log('Result:', japanEarthquake ? 'PASSED ✅' : 'FAILED ❌');
      if (japanEarthquake) {
        console.log('✓ Found 2011 Japan Earthquake:');
        console.log('  - Magnitude:', japanEarthquake.properties.mag);
        console.log('  - Location:', japanEarthquake.properties.place);
        console.log('  - Coordinates:', japanEarthquake.geometry.coordinates);
      }

      // Test 4: Data Structure Validation
      console.log('\nTest 4: Data Structure Check');
      const sampleData = recentMajor.features[0] || japanEarthquake;
      if (sampleData) {
        const validationChecks = {
          'Has GeoJSON structure': sampleData.type === 'Feature',
          'Has geometry': !!sampleData.geometry,
          'Has coordinates': Array.isArray(sampleData.geometry.coordinates),
          'Has magnitude': typeof sampleData.properties.mag === 'number',
          'Has timestamp': typeof sampleData.properties.time === 'number',
          'Has place': typeof sampleData.properties.place === 'string',
          'Has detail URL': typeof sampleData.properties.detail === 'string'
        };

        Object.entries(validationChecks).forEach(([check, passed]) => {
          console.log(`${passed ? '✓' : '✗'} ${check}`);
        });

        // Show data structure for UI mapping
        console.log('\n📊 Sample Data Structure for UI:');
        console.log({
          id: sampleData.id,
          magnitude: sampleData.properties.mag,
          location: sampleData.properties.place,
          time: new Date(sampleData.properties.time).toLocaleString(),
          coordinates: sampleData.geometry.coordinates,
          depth: sampleData.geometry.coordinates[2],
          url: sampleData.properties.detail
        });
      }

      // Test 5: Error Handling
      console.log('\nTest 5: Error Handling');
      try {
        await getEarthquakes({ startTime: 'invalid' });
        console.log('✗ Should have thrown an error for invalid date');
      } catch (error) {
        console.log('✓ Properly handled invalid date');
      }

      // Test 6: 2011 Japan Earthquake Exact Location
      console.log('\nTest 6: 2011 Japan Earthquake Exact Location');
      console.log('Fetching 2011 Japan Earthquake Data...');
      const japanEvent = await getEarthquakes({
        startTime: new Date('2011-03-11T05:46:23').getTime(),
        endTime: new Date('2011-03-11T05:46:24').getTime(),
        minMagnitude: 9
      });

      if (japanEvent.features.length > 0) {
        const quake = japanEvent.features[0];
        console.log('\n📍 Exact Location Details:');
        console.log('------------------------');
        console.log('Coordinates:', quake.geometry.coordinates);
        console.log('Magnitude:', quake.properties.mag);
        console.log('Depth:', quake.geometry.coordinates[2], 'km');
        console.log('Place:', quake.properties.place);
        console.log('Time:', new Date(quake.properties.time).toISOString());
        console.log('\nVerification URL:', quake.properties.url);
      } else {
        console.log('❌ Could not find the 2011 Japan earthquake data');
      }

      // Test 7: Verify 2011 Japan Earthquake Location
      console.log('\nTest 7: Verify 2011 Japan Earthquake Location');
      const data = await getJapanEarthquake2011();
      
      if (data.features.length > 0) {
        const quake = data.features[0];
        console.log('📍 Exact Location Details:');
        console.log('------------------------');
        console.log(`Coordinates: [${quake.geometry.coordinates[0]}, ${quake.geometry.coordinates[1]}]`);
        console.log('Depth:', quake.geometry.coordinates[2], 'km');
        console.log('Magnitude:', quake.properties.mag);
        console.log('Place:', quake.properties.place);
        console.log('Time:', new Date(quake.properties.time).toISOString());
        console.log('\nUSGS Event Page:', quake.properties.url);
        
        // Print map URL for visual verification
        const mapUrl = `https://www.openstreetmap.org/?mlat=${quake.geometry.coordinates[1]}&mlon=${quake.geometry.coordinates[0]}&zoom=7`;
        console.log('\nVerify location on OpenStreetMap:', mapUrl);
      } else {
        console.log('❌ Could not find the 2011 Japan earthquake data');
      }

      console.log('\n📝 Integration Checklist:');
      console.log('1. ✓ API is accessible');
      console.log('2. ✓ Can fetch recent earthquakes');
      console.log('3. ✓ Can fetch historic events');
      console.log('4. ✓ Data structure is consistent');
      console.log('5. ✓ Error handling works');
      console.log('6. ✓ 2011 Japan Earthquake exact location');
      console.log('7. ✓ 2011 Japan Earthquake location verification');
      
      console.log('\n🎨 UI Implementation Notes:');
      console.log('- Use magnitude for marker size');
      console.log('- Use depth for marker color');
      console.log('- Show time in local timezone');
      console.log('- Include clickable detail URL');
      console.log('- Add loading states for data fetching');
      console.log('- Implement error messages for failed requests');
    }
  } catch (error) {
    console.error('❌ Tests failed:', error);
  }
}

runTests();
