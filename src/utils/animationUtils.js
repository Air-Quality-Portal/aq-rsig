// Utility functions for generating animation features from dataset metadata

/**
 * Generate monthly features for animation based on start and end dates
 */
export function generateMonthlyFeatures(startDate, endDate, datasetInfo) {
  const features = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set to first day of start month
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  
  let index = 0;
  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const dateString = `${year}-${month}-01T00:00:00Z`;
    
    features.push({
      id: `${datasetInfo.id}-${year}-${month}`,
      type: 'Feature',
      properties: {
        datetime: dateString,
        start_datetime: dateString,
        date: dateString,
        year: year,
        month: month,
        index: index,
        dataset_id: datasetInfo.id,
        dataset_type: datasetInfo.type
      },
      geometry: null // NetCDF data doesn't have point geometry
    });
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
    index++;
  }
  
  return features;
}

/**
 * Generate daily features for animation based on start and end dates
 */
export function generateDailyFeatures(startDate, endDate, datasetInfo) {
  const features = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const current = new Date(start);
  let index = 0;
  
  while (current <= end) {
    const dateString = current.toISOString();
    
    features.push({
      id: `${datasetInfo.id}-${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
      type: 'Feature',
      properties: {
        datetime: dateString,
        start_datetime: dateString,
        date: dateString,
        index: index,
        dataset_id: datasetInfo.id,
        dataset_type: datasetInfo.type
      },
      geometry: null
    });
    
    // Move to next day
    current.setDate(current.getDate() + 1);
    index++;
  }
  
  return features;
}

/**
 * Generate hourly features for animation based on start and end dates
 */
export function generateHourlyFeatures(startDate, endDate, datasetInfo) {
  const features = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const current = new Date(start);
  let index = 0;
  
  while (current <= end) {
    const dateString = current.toISOString();
    
    features.push({
      id: `${datasetInfo.id}-${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}-${String(current.getHours()).padStart(2, '0')}`,
      type: 'Feature',
      properties: {
        datetime: dateString,
        start_datetime: dateString,
        date: dateString,
        index: index,
        dataset_id: datasetInfo.id,
        dataset_type: datasetInfo.type
      },
      geometry: null
    });
    
    // Move to next hour
    current.setHours(current.getHours() + 1);
    index++;
  }
  
  return features;
}

/**
 * Generate animation features based on dataset configuration
 */
export function generateAnimationFeatures(datasetInfo) {
  if (!datasetInfo.is_animatable || !datasetInfo.start_date || !datasetInfo.end_date) {
    return [];
  }
  
  const { time_interval, start_date, end_date } = datasetInfo;
  
  switch (time_interval?.toLowerCase()) {
    case 'monthly':
      return generateMonthlyFeatures(start_date, end_date, datasetInfo);
    case 'daily':
      return generateDailyFeatures(start_date, end_date, datasetInfo);
    case 'hourly':
      return generateHourlyFeatures(start_date, end_date, datasetInfo);
    default:
      console.warn(`Unsupported time interval: ${time_interval}`);
      return [];
  }
}

/**
 * Check if a dataset should show animation controls
 */
export function shouldShowAnimation(datasetInfo, layerData) {
  // For raster datasets, check if layerData has multiple features
  if (datasetInfo?.type === 'raster') {
    return Array.isArray(layerData?.features) && layerData.features.length > 1;
  }
  
  // For other datasets, check the is_animatable flag
  return datasetInfo?.is_animatable === true;
}

/**
 * Get animation features for a dataset
 */
export function getAnimationFeatures(datasetInfo, layerData) {
  // For raster datasets, use the provided features
  if (datasetInfo?.type === 'raster' && layerData?.features) {
    return layerData.features;
  }
  
  // For animatable datasets, generate features from metadata
  if (datasetInfo?.is_animatable) {
    return generateAnimationFeatures(datasetInfo);
  }
  
  return [];
}

/**
 * Get the appropriate speed for animation based on time interval
 */
export function getAnimationSpeed(timeInterval) {
  switch (timeInterval?.toLowerCase()) {
    case 'hourly':
      return 300; // Fast for hourly data
    case 'daily':
      return 500; // Medium for daily data
    case 'monthly':
      return 800; // Slower for monthly data
    case 'yearly':
      return 1200; // Slowest for yearly data
    default:
      return 700; // Default speed
  }
}