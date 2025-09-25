// Fixed utility functions for generating animation features from dataset metadata

/**
 * Parse date string and extract UTC year, month, day to avoid timezone issues
 */
function parseUTCDate(dateString) {
  // Parse ISO date string directly to avoid timezone conversion
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10) - 1, // Convert to 0-based month
      day: parseInt(match[3], 10)
    };
  }
  
  // Fallback to regular Date parsing if format doesn't match
  const date = new Date(dateString);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate()
  };
}

/**
 * Generate monthly features for animation based on start and end dates
 */
export function generateMonthlyFeatures(startDate, endDate, datasetInfo) {
  const features = [];
  
  // Parse start and end dates in UTC to avoid timezone issues
  const startParsed = parseUTCDate(startDate);
  const endParsed = parseUTCDate(endDate);
  
  // Create UTC dates for consistent behavior
  const current = new Date(Date.UTC(startParsed.year, startParsed.month, 1));
  const endMonth = new Date(Date.UTC(endParsed.year, endParsed.month, 1));
  
  let index = 0;
  while (current <= endMonth) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dateString = `${year}-${month}-01T00:00:00Z`;
    
    features.push({
      id: `${datasetInfo.id}-${year}-${month}`,
      type: 'Feature',
      properties: {
        datetime: dateString,
        start_datetime: dateString,
        date: dateString,
        year: year,
        month: parseInt(month, 10),
        index: index,
        dataset_id: datasetInfo.id,
        dataset_type: datasetInfo.type
      },
      geometry: null // NetCDF data doesn't have point geometry
    });
    
    // Move to next month using UTC methods
    current.setUTCMonth(current.getUTCMonth() + 1);
    index++;
  }
  
  return features;
}

/**
 * Generate daily features for animation based on start and end dates
 */
export function generateDailyFeatures(startDate, endDate, datasetInfo) {
  const features = [];
  
  // Parse dates in UTC
  const startParsed = parseUTCDate(startDate);
  const endParsed = parseUTCDate(endDate);
  
  const current = new Date(Date.UTC(startParsed.year, startParsed.month, startParsed.day));
  const end = new Date(Date.UTC(endParsed.year, endParsed.month, endParsed.day));
  
  let index = 0;
  
  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}T00:00:00Z`;
    
    features.push({
      id: `${datasetInfo.id}-${year}-${month}-${day}`,
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
    
    // Move to next day using UTC methods
    current.setUTCDate(current.getUTCDate() + 1);
    index++;
  }
  
  return features;
}

/**
 * Generate hourly features for animation based on start and end dates
 */
export function generateHourlyFeatures(startDate, endDate, datasetInfo) {
  const features = [];
  
  // For hourly data, parse the full datetime including hours
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Create UTC dates to avoid timezone issues
  const current = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    start.getUTCHours()
  ));
  
  const endUTC = new Date(Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
    end.getUTCHours()
  ));
  
  let index = 0;
  
  while (current <= endUTC) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    const hour = String(current.getUTCHours()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}T${hour}:00:00Z`;
    
    features.push({
      id: `${datasetInfo.id}-${year}-${month}-${day}-${hour}`,
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
    
    // Move to next hour using UTC methods
    current.setUTCHours(current.getUTCHours() + 1);
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
      return 2000; // Fast for hourly data
    case 'daily':
      return 2000; // Medium for daily data
    case 'monthly':
      return 2000; // Slower for monthly data
    case 'yearly':
      return 2000; // Slowest for yearly data
    default:
      return 2000; // Default speed
  }
}

/**
 * Debug function to test date generation
 */
export function debugDateGeneration(datasetInfo) {
  console.log('Dataset:', datasetInfo.id);
  console.log('Start date:', datasetInfo.start_date);
  console.log('End date:', datasetInfo.end_date);
  console.log('Time interval:', datasetInfo.time_interval);
  
  const features = generateAnimationFeatures(datasetInfo);
  console.log('Generated features count:', features.length);
  
  if (features.length > 0) {
    console.log('First feature:', features[0]);
    console.log('Last feature:', features[features.length - 1]);
  }
  
  return features;
}