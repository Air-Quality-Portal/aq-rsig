// services/analysisService.js
import bbox from '@turf/bbox';
import { getAnalysisTimeRange } from '../utils/temporalGrouping';

export class AnalysisService {
  constructor(baseUrl = 'https://dev.openveda.cloud/api') {
    this.baseUrl = baseUrl;
  }

  async runAnalysis(aoi, temporalGroup, onProgress) {
    console.log('=== ANALYSIS SERVICE DEBUG ===');
    console.log('AOI:', aoi);
    console.log('Temporal Group:', temporalGroup);

    // Validate inputs
    if (!aoi) {
      throw new Error('AOI is required for analysis');
    }

    if (!temporalGroup) {
      throw new Error('Temporal group is required for analysis');
    }

    if (!temporalGroup.layers || !Array.isArray(temporalGroup.layers)) {
      console.error('Temporal group layers issue:', {
        hasLayers: !!temporalGroup.layers,
        layersType: typeof temporalGroup.layers,
        layersValue: temporalGroup.layers,
      });
      throw new Error('Temporal group must have a valid layers array');
    }

    if (temporalGroup.layers.length === 0) {
      throw new Error('Temporal group has no layers to analyze');
    }

    const aoiBounds = bbox(aoi);

    // Use the temporal group's actual temporal extent
    const { start, end } = getAnalysisTimeRange(temporalGroup);

    console.log(
      `Analysis time range: ${start.toISOString()} to ${end.toISOString()}`
    );
    console.log(
      'Temporal group layers:',
      temporalGroup.layers.map((l) => ({
        id: l.id,
        name: l.name,
        stacCol: l.stacCol,
        start_date: l.start_date,
        end_date: l.end_date,
      }))
    );

    if (onProgress) onProgress(10, 'Preparing analysis...');

    const allStatistics = [];
    const chartDataMap = new Map();

    // Process each layer in the temporal group
    for (let i = 0; i < temporalGroup.layers.length; i++) {
      const layer = temporalGroup.layers[i];
      const progress = 20 + (i / temporalGroup.layers.length) * 70;

      if (onProgress) onProgress(progress, `Analyzing ${layer.name}...`);

      try {
        const layerStats = await this.fetchLayerStatistics(
          layer,
          aoi,
          start,
          end,
          (itemProgress, message) => {
            // Sub-progress for this layer
            const totalProgress =
              progress + (itemProgress * 0.7) / temporalGroup.layers.length;
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

        // Add error entry to maintain layer tracking
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

    if (onProgress) onProgress(100, 'Analysis complete');

    return {
      aoiId: this.generateAOIId(aoi),
      temporalGroupId: temporalGroup.id,
      statistics: allStatistics,
      chartData,
      generatedAt: new Date(),
    };
  }

  async fetchLayerStatistics(layer, aoiGeometry, start, end, onProgress) {
    const collectionId = layer.stacCol || layer.id;

    console.log(`Fetching statistics for collection: ${collectionId}`);
    console.log('AOI Geometry:', aoiGeometry);
    console.log('Time range:', start.toISOString(), 'to', end.toISOString());

    // Step 1: Get list of available STAC items for the date range
    const items = await this.fetchSTACItems(collectionId, start, end);
    console.log(`Found ${items.length} items for ${collectionId}`);

    if (items.length === 0) {
      throw new Error(
        `No data items found for collection ${collectionId} in the specified date range`
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

    // Validate geometry
    if (
      !requestBody.geometry ||
      Object.keys(requestBody.geometry).length === 0
    ) {
      throw new Error('Invalid AOI geometry - geometry is required');
    }

    const bounds = bbox(aoiGeometry);
    const result = {
      layerId: collectionId,
      layerName: layer.name,
      statistics: [],
      temporal: [],
    };

    // Step 2: Fetch statistics for each item
    const maxItems = Math.min(items.length, 20);
    for (let i = 0; i < maxItems; i++) {
      const item = items[i];
      const itemProgress = (i / items.length) * 100;

      if (onProgress)
        onProgress(
          itemProgress,
          `Processing item ${i + 1}/${maxItems}: ${item.id}`
        );

      try {
        const itemStats = await this.fetchItemStatistics(
          collectionId,
          item.id,
          requestBody
        );

        if (itemStats) {
          // Add item datetime from STAC item properties
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
        console.warn(
          `Failed to get statistics for item ${item.id}:`,
          error.message
        );
        // Continue with other items
      }
    }

    // Sort temporal data by datetime
    result.temporal.sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );

    console.log(
      `Processed statistics for ${layer.name}: ${result.temporal.length} time points`
    );
    return result;
  }

  async fetchSTACItems(collectionId, start, end) {
    const stacUrl = `${this.baseUrl}/stac/collections/${collectionId}/items`;
    const params = new URLSearchParams({
      datetime: `${start.toISOString()}/${end.toISOString()}`,
      limit: '1000',
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
    // Build the item-specific statistics URL with ALL required parameters
    const params = new URLSearchParams({
      bidx: '1',
      assets: 'data',
      expression: 'cog_default',
      asset_bidx: 'data|1,2,3',
      asset_as_band: 'true',
      histogram_bins: '8',
    });

    const url = `${this.baseUrl}/raster/collections/${collectionId}/items/${itemId}/statistics?${params}`;

    console.log(`Fetching item statistics: ${url}`);

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
        throw new Error(
          `Statistics API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      // Extract statistics from the response
      if (
        data.type === 'Feature' &&
        data.properties &&
        data.properties.statistics
      ) {
        const stats = data.properties.statistics;

        // Get the first asset's statistics (usually 'data' or similar)
        const assetKey = Object.keys(stats)[0];
        if (assetKey && stats[assetKey]) {
          return stats[assetKey];
        }
      }

      console.warn(`No statistics found in response for item ${itemId}`);
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

  validateAOI(aoi) {
    console.log('Validating AOI:', aoi);

    if (!aoi) {
      throw new Error('AOI is required');
    }

    const geometry = aoi.geometry || aoi;

    if (!geometry) {
      throw new Error('AOI must have a geometry');
    }

    if (!['Polygon', 'MultiPolygon'].includes(geometry.type)) {
      throw new Error('AOI geometry must be a Polygon or MultiPolygon');
    }

    console.log('AOI validation passed');
    return true;
  }
}

// Export a default instance
export const analysisService = new AnalysisService();
