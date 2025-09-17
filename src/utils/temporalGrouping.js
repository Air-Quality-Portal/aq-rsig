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
 * Get default predefined AOIs
 */
export function getDefaultPredefinedAOIs() {
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
    },
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
    },
  ];
}
