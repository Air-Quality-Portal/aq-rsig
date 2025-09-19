import React, { useState } from 'react';
import {
  Card,
  Typography,
  Grid,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Link,
  Tooltip,
} from '@mui/material';

import { fetchDatasetData } from '../../../utils/urlBuilder';
import { galleryData } from './datasets';

export function DatasetGallery({
  onLayerSelect,
  onRecordSelect,
  updateActiveDataset,
}) {
  const [loadingDataset, setLoadingDataset] = useState(null);
  const [error, setError] = useState(null);

  const allDatasets = Object.keys(galleryData).reduce((acc, category) => {
    return [
      ...acc,
      ...galleryData[category].map((dataset) => ({
        ...dataset,
        category,
      })),
    ];
  }, []);

  const handleDatasetClick = async (dataset) => {
    console.log('Selected dataset:', dataset);
    if (dataset.type === 'netcdf-2d') {
      const directData = {
        conceptId: dataset.conceptId || 'C2837626477-GES_DISC',
        datetime: dataset.start_date || '2018-02-12T09:00:00Z',
        variable: dataset.variable || 'o3',
        colormap: dataset.colormap || 'reds',
        rescale: dataset.rescale || '0, 4.786979e-10',
        datasetInfo: dataset,
        galleryType: dataset.type,
      };

      if (onRecordSelect) {
        onRecordSelect(directData);
      }
      updateActiveDataset(dataset);
      return;
    }

    try {
      setLoadingDataset(dataset.id);
      setError(null);

      const data = await fetchDatasetData(dataset);

      if (onLayerSelect) {
        onLayerSelect?.(data.tilesetUrl || data.datasetInfo?.url || null);
      }

      if (onRecordSelect) {
        onRecordSelect(data);
      }
    } catch (error) {
      setError(`Failed to load ${dataset.name}: ${error.message}`);
    } finally {
      updateActiveDataset(dataset);
      setLoadingDataset(null);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'raster':
        return 'primary';
      case 'stations':
        return 'secondary';
      case 'point-cloud':
        return 'success';
      case 'feature':
        return 'warning';
      case 'geojson':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2, overflowY: 'auto' }}>
      {error && (
        <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography
        variant='h6'
        sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
      >
        Datasets
      </Typography>

      <Grid container spacing={2}>
        {allDatasets.map((dataset) => (
          <Grid item xs={12} sm={6} key={dataset.id}>
            <Card
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 4,
                },
                position: 'relative',
                opacity: loadingDataset === dataset.id ? 0.7 : 1,
                border: '1px solid',
                borderColor: 'divider',
                minWidth: '18rem',
                borderRadius: 2,
              }}
              onClick={() => handleDatasetClick(dataset)}
            >
              {/* Loading Overlay */}
              {loadingDataset === dataset.id && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    zIndex: 2,
                    borderRadius: 2,
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              )}

              {/* Main Content with Hover Tooltip */}
              <Tooltip
                title={dataset.description || ''}
                placement='left'
                componentsProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'rgba(50, 25, 255, 0.6)',
                      color: 'white',
                      boxShadow: 3,
                      fontSize: '0.75rem',
                      maxWidth: 300,
                      borderRadius: 2,
                      p: 1,
                    },
                  },
                }}
              >
                <Box sx={{ p: 1.5 }}>
                  {/* Top Row: Title + Category Chip */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <Typography
                      variant='subtitle1'
                      component='h3'
                      sx={{
                        fontWeight: 600,
                        fontSize: '1rem',
                        lineHeight: 1.2,
                        flexGrow: 1,
                      }}
                    >
                      {dataset.name}
                    </Typography>

                    <Chip
                      label={dataset.category}
                      size='small'
                      color={getTypeColor(dataset.type)}
                      sx={{ height: 22, fontSize: '0.7rem' }}
                    />
                  </Box>

                  {/* Metadata List */}
                  <Box
                    component='ul'
                    sx={{
                      pl: 2,
                      mb: 0,
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      lineHeight: 1.5,
                    }}
                  >
                    {dataset.units && (
                      <li>
                        <strong>Unit:</strong> {dataset.units}
                      </li>
                    )}
                    {dataset.start_date && (
                      <li>
                        <strong>Start Date:</strong> {dataset.start_date}
                      </li>
                    )}
                    {dataset.end_date && (
                      <li>
                        <strong>End Date:</strong> {dataset.end_date}
                      </li>
                    )}
                    {dataset.time_interval && (
                      <li>
                        <strong>Time Interval:</strong> {dataset.time_interval}
                      </li>
                    )}
                    {dataset.info && (
                      <li>
                        <Link
                          href={dataset.info}
                          target='_blank'
                          rel='noopener noreferrer'
                          underline='hover'
                          sx={{ fontSize: '0.75rem', color: 'primary.main' }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          See more
                        </Link>
                      </li>
                    )}
                  </Box>
                </Box>
              </Tooltip>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
