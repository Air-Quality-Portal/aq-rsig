export const galleryData = {
  'satellite': [
    {
      id: 'omi-no2-2d',
      name: 'OMI-2D',
      thumbnailUrl: '/path/to/thumbnail1.jpg',
      type: 'raster',
      description: 'Ozone Monitoring Instrument NO2 data'
    },
    {
      id: 'TROPESS_reanalysis_mon_emi_nox_anth',
      name: 'TROPESS',
      type: 'netcdf-2d',
      thumbnailUrl: '/path/to/thumbnail3.jpg',
      description: 'TROPESS reanalysis NOx emissions'
    },
      {
      id: 'JPL-o3-hourly-v1',
      name: 'JPL GEOS Chem',
      type: 'raster',
      thumbnailUrl: '/path/to/thumbnail3.jpg',
      description: 'JPL GEOS Chem'
    }
  ],
  'insitu': [
    {
      id: 'public.aqs_gases_metadata',
      name: 'AQS Stations',
      type: 'feature',
      thumbnailUrl: '/path/to/thumbnail1.jpg',
      description: 'Air Quality System monitoring stations'
    }
  ],
  'Lidar': [
    {
      id: 'calipso-point-cloud',
      name: 'CALIPSO',
      type: 'point-cloud',
      url: 'https://rsig-point-cloud.s3.us-west-2.amazonaws.com/ept-tileset/tileset.json',
      thumbnailUrl: '/path/to/thumbnail1.jpg',
      description: 'CALIPSO lidar point cloud data'
    }
  ]
};