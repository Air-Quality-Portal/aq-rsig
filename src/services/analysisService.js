// services/analysisService.js - Updated with time window support
import bbox from '@turf/bbox';

const parseTimeWindow = (timeWindow) => {
  const match = timeWindow.match(/^(\d+)([hdy])$/);
  if (!match) throw new Error('Invalid time window format');
  
  const [, amount, unit] = match;
  const value = parseInt(amount);
  
  switch (unit) {
    case 'h': return { value, unit: 'hours' };
    case 'd': return { value, unit: 'days' };
    case 'y': return { value, unit: 'years' };
    default: throw new Error('Invalid time window unit');
  }
};

const calculateTimeRange = (activeDate, timeWindow) => {
  // Handle both string and Date inputs
  let start;
  if (typeof activeDate === 'string') {
    // If no timezone info, treat as UTC
    if (!activeDate.includes('Z') && !activeDate.includes('+') && !activeDate.includes('-')) {
      start = new Date(activeDate + 'Z');
    } else {
      start = new Date(activeDate);
    }
  } else {
    start = new Date(activeDate);
  }
  
  const { value, unit } = parseTimeWindow(timeWindow);
  const end = new Date(start);
  
  switch (unit) {
    case 'hours':
      end.setUTCHours(start.getUTCHours() + value); // Use UTC methods
      break;
    case 'days':
      end.setUTCDate(start.getUTCDate() + value); // Use UTC methods
      break;
    case 'years':
      end.setUTCFullYear(start.getUTCFullYear() + value); // Use UTC methods
      break;
  }
  
  return { start, end };
};

export class AnalysisService {
  constructor(baseUrl = 'https://dev.openveda.cloud/api') {
    this.baseUrl = baseUrl;
  }

  async runAnalysis(aoi, temporalGroup, onProgress, options = {}) {
    const { activeDate, timeWindow, layerName } = options;
    
    console.log('=== ANALYSIS SERVICE DEBUG ===');
    console.log('AOI:', aoi);
    console.log('Temporal Group:', temporalGroup);
    console.log('Active Date:', activeDate);
    console.log('Time Window:', timeWindow);
    console.log('Layer Name:', layerName);

    // Validate inputs
    if (!aoi) {
      throw new Error('AOI is required for analysis');
    }

    if (!temporalGroup) {
      throw new Error('Temporal group is required for analysis');
    }

    if (!temporalGroup.layers || !Array.isArray(temporalGroup.layers)) {
      throw new Error('Temporal group must have a valid layers array');
    }

    if (temporalGroup.layers.length === 0) {
      throw new Error('Temporal group has no layers to analyze');
    }

    if (!activeDate || !timeWindow) {
      throw new Error('Active date and time window are required');
    }

    // Calculate time range from active date and window
    const { start, end } = calculateTimeRange(activeDate, timeWindow);
    console.log(`Calculated time range: ${start.toISOString()} to ${end.toISOString()}`);
    const { value, unit } = parseTimeWindow(timeWindow);

    console.log(`Analysis time range: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`Time window: ${value} ${unit} from active date`);

    if (onProgress) {
      onProgress(10, `Analyzing ${value} ${unit} from ${start.toLocaleDateString()}...`);
    }

    const allStatistics = [];
    const chartDataMap = new Map();

    // Process each layer in the temporal group
    for (let i = 0; i < temporalGroup.layers.length; i++) {
      const layer = temporalGroup.layers[i];
      const progress = 20 + (i / temporalGroup.layers.length) * 70;

      if (onProgress) {
        onProgress(progress, `Processing ${layer.name} (${value} ${unit} window)...`);
      }

      try {
        const layerStats = await this.fetchLayerStatistics(
          layer,
          aoi,
          start,
          end,
          (itemProgress, message) => {
            const totalProgress = progress + (itemProgress * 0.7) / temporalGroup.layers.length;
            if (onProgress) onProgress(totalProgress, message);
          }
        );

        allStatistics.push(layerStats);

        // Add to chart data
        layerStats.temporal.forEach((point) => {
          const dateKey = point.datetime;
          if (!chartDataMap.has(dateKey)) {
            chartDataMap.set(dateKey, { datetime: dateKey });
          }
          const chartPoint = chartDataMap.get(dateKey);
          chartPoint[layer.id] = point.value;
        });
      } catch (error) {
        console.error(`Failed to analyze layer ${layer.name}:`, error);
        
        allStatistics.push({
          layerId: layer.id,
          layerName: layer.name,
          error: error.message,
          statistics: [],
          temporal: [],
        });
      }
    }

    if (onProgress) onProgress(95, 'Processing results...');

    // Convert chart data map to sorted array
    const chartData = Array.from(chartDataMap.values()).sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    const totalDataPoints = allStatistics.reduce((sum, stat) => sum + stat.temporal.length, 0);
    
    if (onProgress) onProgress(100, `Analysis complete: ${totalDataPoints} data points`);

    return {
      aoiId: this.generateAOIId(aoi),
      temporalGroupId: temporalGroup.id,
      timeWindow: timeWindow,
      activeDate: activeDate,
      timeRange: { start: start.toISOString(), end: end.toISOString() },
      layerName: layerName,
      statistics: allStatistics,
      chartData,
      generatedAt: new Date(),
    };
  }

  async fetchLayerStatistics(layer, aoiGeometry, start, end, onProgress) {
    const collectionId = layer.stacCol || layer.id;

    console.log(`Fetching statistics for collection: ${collectionId}`);
    console.log('Time range:', start.toISOString(), 'to', end.toISOString());

    // Get all available STAC items for the time range (no limit)
    const items = await this.fetchSTACItems(collectionId, start, end);
    const filteredItems = items.filter(item => {
  const itemDate = new Date(item.properties.datetime || item.properties.start_datetime);
  return itemDate >= start && itemDate <= end;
});

    if (filteredItems.length === 0) {
      throw new Error(
        `No data items found for collection ${collectionId} in the specified time window`
      );
    }

    // Prepare clean GeoJSON Feature for request body
    let requestBody;
    if (aoiGeometry.type === 'Feature') {
      requestBody = {
        type: 'Feature',
        geometry: aoiGeometry.geometry,
        properties: aoiGeometry.properties || {},
      };
    } else {
      requestBody = {
        type: 'Feature',
        geometry: aoiGeometry,
        properties: {},
      };
    }

    if (!requestBody.geometry || Object.keys(requestBody.geometry).length === 0) {
      throw new Error('Invalid AOI geometry - geometry is required');
    }

    const result = {
      layerId: collectionId,
      layerName: layer.name,
      statistics: [],
      temporal: [],
    };

    // Process ALL items in the time window (not limited to 20)
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i];
      const itemProgress = (i / filteredItems.length) * 100;

      if (onProgress) {
        onProgress(
          itemProgress,
          `Processing item ${i + 1}/${filteredItems.length}: ${item.id}`
        );
      }

      try {
        const itemStats = await this.fetchItemStatistics(
          collectionId,
          item.id,
          requestBody
        );

        if (itemStats) {
          const datetime =
            item.properties.datetime ||
            item.properties.start_datetime ||
            item.properties.date;

          result.temporal.push({
            datetime: datetime,
            value: itemStats.mean || 0,
            min: itemStats.min || 0,
            max: itemStats.max || 0,
            std: itemStats.std || 0,
            count: itemStats.valid_pixels || itemStats.count || 0,
            itemId: item.id,
          });

          result.statistics.push({
            ...itemStats,
            itemId: item.id,
            datetime: datetime,
          });
        }
      } catch (error) {
        console.warn(`Failed to get statistics for item ${item.id}:`, error.message);
      }
    }

    // Sort temporal data by datetime
    result.temporal.sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    console.log(`Processed statistics for ${layer.name}: ${result.temporal.length} time points`);
    return result;
  }

  async fetchSTACItems(collectionId, start, end) {
    const stacUrl = `${this.baseUrl}/stac/collections/${collectionId}/items`;
    const params = new URLSearchParams({
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit: '1000', // Get all items in time window
    });

    console.log(`Fetching STAC items: ${stacUrl}?${params}`);

    try {
      const response = await fetch(`${stacUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`STAC API error: ${response.status}`);
      }

      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error(`Error fetching STAC items for ${collectionId}:`, error);
      throw new Error(`Failed to fetch STAC items: ${error.message}`);
    }
  }

  async fetchItemStatistics(collectionId, itemId, requestBody) {
    const params = new URLSearchParams({
      bidx: '1',
      assets: 'data',
      expression: 'cog_default',
      asset_bidx: 'data|1,2,3',
      asset_as_band: 'true',
      histogram_bins: '8',
    });

    const url = `${this.baseUrl}/raster/collections/${collectionId}/items/${itemId}/statistics?${params}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/geo+json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Statistics API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.type === 'Feature' && data.properties && data.properties.statistics) {
        const stats = data.properties.statistics;
        const assetKey = Object.keys(stats)[0];
        if (assetKey && stats[assetKey]) {
          return stats[assetKey];
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching statistics for item ${itemId}:`, error);
      throw error;
    }
  }

  generateAOIId(aoi) {
    const bounds = bbox(aoi);
    return `aoi_${bounds.map((b) => b.toFixed(3)).join('_')}`;
  }
}

export const analysisService = new AnalysisService();