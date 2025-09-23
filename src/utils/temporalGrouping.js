// utils/temporalGrouping.js

/**
 * Group layers by their temporal resolution
 */
export function groupLayersByTemporalResolution(layers = []) {
  if (!Array.isArray(layers) || layers.length === 0) {
    return [];
  }

  const temporalResolutions = {
    hourly: {
      order: 1,
      label: 'Hourly',
      description: 'Data updated every hour',
    },
    daily: { order: 2, label: 'Daily', description: 'Data updated daily' },
    weekly: { order: 3, label: 'Weekly', description: 'Data updated weekly' },
    monthly: {
      order: 4,
      label: 'Monthly',
      description: 'Data updated monthly',
    },
    quarterly: {
      order: 5,
      label: 'Quarterly',
      description: 'Data updated quarterly',
    },
    yearly: { order: 6, label: 'Yearly', description: 'Data updated yearly' },
    annual: { order: 6, label: 'Annual', description: 'Data updated annually' },
    irregular: {
      order: 7,
      label: 'Irregular',
      description: 'Irregular temporal resolution',
    },
    unknown: {
      order: 8,
      label: 'Unknown',
      description: 'Unknown temporal resolution',
    },
  };

  const grouped = {};

  layers.forEach((layer) => {
    console.log('Processing layer:', layer);
    const temporalResolution = detectTemporalResolution(layer);

    if (!grouped[temporalResolution]) {
      grouped[temporalResolution] = {
        id: temporalResolution,
        resolution: temporalResolution,
        label: temporalResolutions[temporalResolution]?.label || 'Unknown',
        description:
          temporalResolutions[temporalResolution]?.description ||
          'Unknown temporal resolution',
        order: temporalResolutions[temporalResolution]?.order || 999,
        layers: [],
        count: 0,
        // Track temporal coverage across all layers in group
        temporalExtent: {
          start: null,
          end: null,
        },
      };
    }

    // Add layer to group
    grouped[temporalResolution].layers.push(layer);
    grouped[temporalResolution].count++;

    // Update temporal extent for the group
    const layerExtent = extractLayerTemporalExtent(layer);
    if (layerExtent.start && layerExtent.end) {
      const group = grouped[temporalResolution];

      if (
        !group.temporalExtent.start ||
        new Date(layerExtent.start) < new Date(group.temporalExtent.start)
      ) {
        group.temporalExtent.start = layerExtent.start;
      }

      if (
        !group.temporalExtent.end ||
        new Date(layerExtent.end) > new Date(group.temporalExtent.end)
      ) {
        group.temporalExtent.end = layerExtent.end;
      }
    }
  });

  return Object.values(grouped).sort((a, b) => a.order - b.order);
}

/**
 * Extract temporal extent from layer metadata
 */
function extractLayerTemporalExtent(layer) {
  console.log(`Extracting for: ${layer.name}`);
  console.log('start_date:', layer.start_date, 'end_date:', layer.end_date);

  // Simple direct check
  if (layer.start_date && layer.end_date) {
    return {
      start: new Date(layer.start_date).toISOString(),
      end: new Date(layer.end_date).toISOString()
    };
  }

  // Fallback
  console.warn(`No dates found, using fallback`);
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);
  return { 
    start: start.toISOString(), 
    end: end.toISOString() 
  };
}

/**
 * Get analysis time range for a temporal group
 * Now uses actual dataset temporal coverage
 */
export function getAnalysisTimeRange(temporalGroup) {
  console.log('Getting analysis time range for temporal group:', temporalGroup);

  // Use the temporal extent from the group
  if (
    temporalGroup.temporalExtent &&
    temporalGroup.temporalExtent.start &&
    temporalGroup.temporalExtent.end
  ) {
    console.log('Using group temporal extent:', temporalGroup.temporalExtent);
    return {
      start: new Date(temporalGroup.temporalExtent.start),
      end: new Date(temporalGroup.temporalExtent.end),
    };
  }

  // Fallback: find extent from individual layers
  console.log('No group temporal extent, extracting from individual layers...');
  let earliestStart = null;
  let latestEnd = null;

  temporalGroup.layers.forEach((layer) => {
    console.log(`Extracting extent from layer: ${layer.name}`);
    const extent = extractLayerTemporalExtent(layer);

    if (extent.start && extent.end) {
      const startDate = new Date(extent.start);
      const endDate = new Date(extent.end);

      console.log(
        `Layer ${layer.name} extent: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      if (!earliestStart || startDate < earliestStart) {
        earliestStart = startDate;
      }

      if (!latestEnd || endDate > latestEnd) {
        latestEnd = endDate;
      }
    }
  });

  // If we found valid dates, use them
  if (earliestStart && latestEnd) {
    console.log(
      `Combined temporal extent: ${earliestStart.toISOString()} to ${latestEnd.toISOString()}`
    );
    return {
      start: earliestStart,
      end: latestEnd,
    };
  }

  // Final fallback - last 1 year
  console.warn(
    'Using fallback date range for analysis - no valid temporal data found'
  );
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);

  console.log(
    `Fallback temporal extent: ${start.toISOString()} to ${end.toISOString()}`
  );
  return { start, end };
}

/**
 * Detect temporal resolution from layer properties
 */
function detectTemporalResolution(layer) {
  // Check explicit temporal resolution property
  if (layer.temporalResolution) {
    return layer.temporalResolution.toLowerCase();
  }

  // Check time_interval field (from gallery data)
  if (layer.time_interval) {
    return layer.time_interval.toLowerCase();
  }

  // Check layer metadata for temporal information
  if (layer.metadata) {
    const meta = layer.metadata;

    if (meta.temporal_resolution) return meta.temporal_resolution.toLowerCase();
    if (meta.temporalResolution) return meta.temporalResolution.toLowerCase();
    if (meta.time_interval) return meta.time_interval.toLowerCase();
    if (meta.update_frequency) return meta.update_frequency.toLowerCase();
    if (meta.frequency) return meta.frequency.toLowerCase();
  }

  // Analyze layer name/description for temporal keywords
  const text = `${layer.name || ''} ${layer.description || ''}`.toLowerCase();

  if (text.includes('hourly') || text.includes('hour')) return 'hourly';
  if (text.includes('daily') || text.includes('day')) return 'daily';
  if (text.includes('weekly') || text.includes('week')) return 'weekly';
  if (text.includes('monthly') || text.includes('month')) return 'monthly';
  if (text.includes('quarterly') || text.includes('quarter'))
    return 'quarterly';
  if (
    text.includes('yearly') ||
    text.includes('annual') ||
    text.includes('year')
  )
    return 'yearly';

  // Check for specific dataset patterns
  const id = (layer.id || '').toLowerCase();
  if (id.includes('hour')) return 'hourly';
  if (id.includes('day')) return 'daily';
  if (id.includes('month')) return 'monthly';
  if (id.includes('year') || id.includes('annual')) return 'yearly';

  // Default
  return 'unknown';
}

/**
 * Get display name for temporal resolution
 */
export function getTemporalDisplayName(resolution) {
  const names = {
    hourly: 'Hourly',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
    annual: 'Annual',
    irregular: 'Irregular',
    unknown: 'Unknown',
  };

  return names[resolution] || 'Unknown';
}

/**
 * Load all US state GeoJSON files from public directory
 * Returns a promise that resolves to an array of AOI objects
 */
export async function loadStatePredefinedAOIs() {
  // List of all US states and DC based on the file tree shown
  const stateFiles = [
    'Alabama.geojson',
    'Alaska.geojson', 
    'Arizona.geojson',
    'Arkansas.geojson',
    'California.geojson',
    'Colorado.geojson',
    'Connecticut.geojson',
    'Delaware.geojson',
    'District of Columbia.geojson',
    'Florida.geojson',
    'Georgia.geojson',
    'Hawaii.geojson',
    'Idaho.geojson',
    'Illinois.geojson',
    'Indiana.geojson',
    'Iowa.geojson',
    'Kansas.geojson',
    'Kentucky.geojson',
    'Louisiana.geojson',
    'Maine.geojson',
    'Maryland.geojson',
    'Massachusetts.geojson',
    'Michigan.geojson',
    'Minnesota.geojson',
    'Mississippi.geojson',
    'Missouri.geojson',
    'Montana.geojson',
    'Nebraska.geojson',
    'Nevada.geojson',
    'New Hampshire.geojson',
    'New Jersey.geojson',
    'New Mexico.geojson',
    'New York.geojson',
    'North Carolina.geojson',
    'North Dakota.geojson',
    'Ohio.geojson',
    'Oklahoma.geojson',
    'Oregon.geojson',
    'Pennsylvania.geojson',
    'Rhode Island.geojson',
    'South Carolina.geojson',
    'South Dakota.geojson',
    'Tennessee.geojson',
    'Texas.geojson',
    'Utah.geojson',
    'Vermont.geojson',
    'Virginia.geojson',
    'Washington.geojson',
    'West Virginia.geojson',
    'Wisconsin.geojson',
    'Wyoming.geojson'
  ];

  console.log('Loading state GeoJSON files...');
  
  const loadedStates = [];
  const failedStates = [];

  // Load all state files in parallel
  const loadPromises = stateFiles.map(async (filename) => {
    try {
      const response = await fetch(`/geo-data/states/${filename}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const geoJsonData = await response.json();
      
      // Extract state name from filename (remove .geojson extension)
      const stateName = filename.replace('.geojson', '');
      
      // Handle special case for DC
      const displayName = stateName === 'District of Columbia' ? 'Washington D.C.' : stateName;
      
      // Create AOI object compatible with existing interface
      const aoi = {
        id: stateName.toLowerCase().replace(/\s+/g, '_'),
        name: displayName,
        description: `State of ${displayName}`,
        geometry: geoJsonData.type === 'FeatureCollection' 
          ? geoJsonData.features[0]?.geometry 
          : geoJsonData.type === 'Feature'
          ? geoJsonData.geometry
          : geoJsonData,
        source: 'state_geojson'
      };

      // Validate geometry exists
      if (!aoi.geometry) {
        throw new Error('No valid geometry found in GeoJSON');
      }

      loadedStates.push(aoi);
      console.log(`✓ Loaded ${displayName}`);
      
    } catch (error) {
      console.warn(`Failed to load ${filename}:`, error.message);
      failedStates.push({ filename, error: error.message });
    }
  });

  // Wait for all promises to resolve
  await Promise.allSettled(loadPromises);

  // Sort states alphabetically by name
  loadedStates.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Successfully loaded ${loadedStates.length} states`);
  if (failedStates.length > 0) {
    console.warn(`Failed to load ${failedStates.length} states:`, failedStates);
  }

  return loadedStates;
}

/**
 * Get default predefined AOIs (now loads from GeoJSON files)
 * Returns a promise that resolves to an array of AOI objects
 */
export async function getDefaultPredefinedAOIs() {
  try {
    // Load state geometries from GeoJSON files
    const stateAOIs = await loadStatePredefinedAOIs();
    
    // You can still add custom AOIs here if needed
    const customAOIs = [
      {
        id: 'chesapeake_bay',
        name: 'Chesapeake Bay',
        description: 'Chesapeake Bay region',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-77.5, 36.5],
              [-77.5, 39.5],
              [-75.5, 39.5],
              [-75.5, 36.5],
              [-77.5, 36.5],
            ],
          ],
        },
        source: 'custom'
      }
    ];

    // Combine state AOIs with custom AOIs
    return [...stateAOIs, ...customAOIs];
    
  } catch (error) {
    console.error('Error loading predefined AOIs:', error);
    
    // Fallback to original hardcoded AOIs if loading fails
    console.warn('Falling back to hardcoded AOIs');
    return [
      {
        id: 'california',
        name: 'California',
        description: 'State of California',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-124.409591, 32.534156],
              [-124.409591, 42.009518],
              [-114.131211, 42.009518],
              [-114.131211, 32.534156],
              [-124.409591, 32.534156],
            ],
          ],
        },
        source: 'fallback'
      },
      {
        id: 'texas',
        name: 'Texas',
        description: 'State of Texas',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-106.645646, 25.837377],
              [-106.645646, 36.500704],
              [-93.508039, 36.500704],
              [-93.508039, 25.837377],
              [-106.645646, 25.837377],
            ],
          ],
        },
        source: 'fallback'
      },
      {
        id: 'florida',
        name: 'Florida',
        description: 'State of Florida',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-87.634938, 24.396308],
              [-87.634938, 31.000888],
              [-79.974306, 31.000888],
              [-79.974306, 24.396308],
              [-87.634938, 24.396308],
            ],
          ],
        },
        source: 'fallback'
      },
    ];
  }
}