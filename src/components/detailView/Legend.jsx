import React from 'react';
import { Box, Typography } from '@mui/material';

// 1. HARDCODED COLORMAP DATA
// A collection of common colormaps
const colormaps = {
  viridis: ['#440154', '#3b528b', '#21908d', '#5dc962', '#fde725'],
  reds: ['#fff5f0', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'],
  rdbu_r: ['#67001f', '#d6604d', '#f7f7f7', '#4393c3', '#053061'],
  ylorrd: ['#ffffd2', '#ffeda0', '#feb24c', '#f03b20', '#bd0026'],
  blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c'],
  greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#31a354', '#006d2c'],
  pink_r: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'].reverse(),
  turbo: ['#30123b', '#4451a4', '#418bfa', '#24c3e2', '#26eca2', '#61fc6c', '#a5ff36', '#e7e31c', '#f6a100', '#ea4f00', '#d10000', '#990000']
};

/**
 * Gets the color stops for a legend.
 * It prioritizes the 'stops' array if it exists on the dataset.
 * Otherwise, it looks up the colormap by its name.
 */
export const getColormapStops = (colormapName, stops) => {
  if (stops && Array.isArray(stops) && stops.length > 0) {
    return stops;
  }
  if (colormapName && colormaps[colormapName]) {
    return colormaps[colormapName];
  }
  return null;
};

// 2. HELPER FUNCTION (moved from RecordDetailView.jsx)
const formatNumber = (num) => {
  if (num === null || num === undefined) return '';
  if (num === 0) return '0';
  const absNum = Math.abs(num);
  if (absNum >= 1e6 || (absNum < 1e-3 && absNum > 0)) {
    return num.toExponential(2);
  }
  if (!Number.isInteger(num)) {
    return parseFloat(num.toPrecision(3));
  }
  return num.toLocaleString();
};

// 3. STATIC LEGEND COMPONENT (moved from RecordDetailView.jsx)
export const StaticLegend = ({ dataset }) => {
  const { type, stops, rescale_values, units, colormap } = dataset;

  const renderGradientLegend = () => {
    // Use the helper function
    const colorStops = getColormapStops(colormap, stops);

    if (!colorStops || !rescale_values) return null;

    const gradient = `linear-gradient(to right, ${colorStops
      .map((c, i) => `${c} ${(i / (colorStops.length - 1)) * 100}%`)
      .join(', ')})`;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box
          sx={{
            width: '100%',
            height: 12,
            background: gradient,
            borderRadius: 1,
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography
            variant='caption'
            sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
          >
            {formatNumber(rescale_values[0])}
          </Typography>
          <Typography
            variant='caption'
            sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
          >
            {formatNumber(rescale_values[1])}
          </Typography>
        </Box>
      </Box>
    );
  };

  switch (type) {
    case 'raster':
    case 'netcdf-2d':
      return renderGradientLegend();

    case 'point-cloud':
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            width: '100%',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: 12,
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {[
              { color: 'green', width: '25%' },
              { color: 'blue', width: '25%' },
              { color: 'yellow', width: '25%' },
              { color: 'red', width: '25%' },
            ].map((item, index) => (
              <Box
                key={index}
                sx={{
                  width: item.width,
                  height: '100%',
                  backgroundColor: item.color,
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
              0
            </Typography>
            <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
              0.1
            </Typography>
            <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
              0.5
            </Typography>
            <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
              1.5
            </Typography>
            <Typography variant='caption' sx={{ fontSize: '0.7rem' }}>
              2
            </Typography>
          </Box>
          <Typography
            variant='caption'
            sx={{
              fontSize: '0.65rem',
              color: 'text.secondary',
              textAlign: 'center',
            }}
          >
            curtain : 0-31 KM Altitude - 
          </Typography>
        </Box>
      );

    case 'feature':
      return null;

    default:
      return null;
  }
};