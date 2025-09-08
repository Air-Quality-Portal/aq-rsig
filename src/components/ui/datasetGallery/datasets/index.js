export const galleryData = {
  'satellite': [
    {
      id: 'omi-no2-2d',
      name: 'OMI-2D',
      thumbnailUrl: '/path/to/thumbnail1.jpg',
      type: 'raster',
      description:
        'Berkeley High Resolution(BEHR) Ozone Monitoring Instrument (OMI) Integrated Column Amount of NO2 in the Tropopsphere.',
      units: 'molec/cm²',
      rescale_values: [0.1e15, 6.4e15],
      colormap: 'viridis',
      info: 'https://amt.copernicus.org/articles/14/455/2021/',
      time_interval: 'daily',
      start_date: '2014-06-01T00:00:00Z',
      end_date: '2014-09-30T00:00:00Z'
    },
    {
      id: 'TROPESS_reanalysis_mon_emi_nox_anth',
      name: 'TROPESS Chemical Reanalysis Surface Anthropogenic NOx emissions Monthly 2-dimensional Product V1',
      type: 'netcdf-2d',
      thumbnailUrl: '/path/to/thumbnail3.jpg',
      description: "The TROPESS Chemical Reanalysis Surface Total NOx emissions Monthly 2-dimensional Product contains nitrogen oxides (NO and NO2) emissions from the total of all sources. The data are part of the Tropospheric Chemical Reanalysis v2 (TCR-2) for the period 2005-2021. TCR-2 uses JPL's Multi-mOdel Multi-cOnstituent Chemical (MOMO-Chem) data assimilation framework that simultaneously optimizes both concentrations and emissions of multiple species from multiple satellite sensors. The data files are written in the netCDF version 4 file format, and each file contains a year of data at monthly resolution, and a spatial resolution of 1.125 x 1.125 degrees. The principal investigator for the TCR-2 data is Miyazaki, Kazuyuki.",
      units: 'kg m-2 s-1',
      rescale_values : [0, 4.786979e-10],
      colormap: 'reds',
      info: 'https://data.nasa.gov/dataset/tropess-chemical-reanalysis-surface-total-nox-emissions-monthly-2-dimensional-product-v1-t-2206f',
      time_interval: 'monthly',
      start_date: '2005-01-01T00:00:00+00:00',
      end_date: '2021-12-31T00:00:00+00:00'
    }
  ],
  'insitu': [
    {
      id: 'public.aqs_gases_metadata',
      name: 'AQS Stations',
      type: 'feature',
      thumbnailUrl: '/path/to/thumbnail1.jpg',
      description: 'Air Quality System monitoring stations',
      info: 'https://data.nasa.gov/dataset/tropess-chemical-reanalysis-surface-total-nox-emissions-monthly-2-dimensional-product-v1-t-2206f',
      time_interval: 'yearly',
      start_date: '2017-01-01T00:00:00+00:00',
      end_date: '2022-12-31T00:00:00+00:00'
    }
  ],
  'Lidar': [
    {
      id: 'calipso-point-cloud',
      name: 'CALIPSO Lidar Level 2 Aerosol Profile, Version 4‑51',
      type: 'point-cloud',
      url: 'https://rsig-point-cloud.s3.us-west-2.amazonaws.com/ept-tileset/tileset.json',
      thumbnailUrl: '/path/to/thumbnail1.jpg',
      description: 'CALIPSO (Cloud-Aerosol Lidar and Infrared Pathfinder Satellite Observations) data provides high-resolution vertical profiles of clouds and aerosols in the atmosphere using lidar measurements from space. It helps study cloud structure, aerosol types, and their effects on climate and weather',
      units: ' km⁻¹ sr⁻¹',
      info: 'https://catalog.data.gov/dataset/calipso-lidar-level-2-aerosol-profile-v4-51-06c1f',
      time_interval: '100minutes',
      start_date: '2006-06-11T00:00:00+00:00',
      end_date: '2023-06-30T00:00:00+00:00'
    }
  ]
};