// URL Builder for different dataset types
export const buildDatasetUrl = (dataset) => {
  console.log('Building URL for dataset:', dataset);
  // const { id, type, url } = dataset;
  const id = dataset.collection_id || dataset.id;
  const { type, url } = dataset;
  const baseUrl = 'https://dev.openveda.cloud/api';

  switch (type) {
    case 'raster':
      return `${baseUrl}/stac/collections/${id}/items`;

    case 'feature':
      return `${baseUrl}/features/collections/${id}/items`;

    case 'point-cloud':
      if (url) {
        return url;
      }
      return `${baseUrl}/stac/collections/${id}/items`;

    case 'geojson':
      return `${baseUrl}/collections/${id}/items`;
    case 'netcdf-2d':
      return `https://dev.openveda.cloud/api/stac/collections/${id}/items`;
    default:
      console.warn(`Unknown dataset type: ${type}`);
      return null;
  }
};

export const fetchDatasetData = async (dataset) => {
  if (dataset.type === 'point-cloud') {
    const tilesetTemplate = dataset.url;
    const firstDate = dataset.available_dates?.[0] ?? null;
    const tilesetUrl = firstDate
      ? tilesetTemplate.replace('{DateTime}', firstDate)
      : null;

    return {
      datasetInfo: { ...dataset },
      galleryType: dataset.type,
      tilesetTemplate,
      tilesetUrl,
      available_dates: dataset.available_dates || [],
    };
  }

  // --- all other types keep using STAC/feature listing fetch ---
  const url = buildDatasetUrl(dataset);
  const response = await fetch(url + `?limit=1000`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch data: ${response.status} - ${response.statusText}`
    );
  }
  const data = await response.json();
  return { ...data, datasetInfo: dataset, galleryType: dataset.type };
};
