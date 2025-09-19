// components/aoi/AnalysisResults.jsx - Updated to use existing LineChart
import React, { useMemo } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip } from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useAOI } from '../../context/aoiContext';
import { ChartProvider } from '../../context/chartContext';
import { LineChart } from '../../components/lineChart';

export function AnalysisResults({ onClose, position = 'bottom' }) {
  const { state } = useAOI();
  const results = state.analysisResults;

  // Transform AOI analysis data to match the existing LineChart component format
  const chartDatasets = useMemo(() => {
    if (!results) return [];

    // Check if we have statistics data with temporal breakdown
    if (results.statistics && results.statistics.length > 0) {
      const layerStats = results.statistics[0]; // Get first (and likely only) layer

      if (layerStats.statistics && layerStats.statistics.length > 0) {
        // Extract temporal statistics and convert to your LineChart format
        const timePoints = layerStats.statistics
          .map((timePointStats, index) => ({
            datetime:
              results.chartData[index]?.datetime ||
              timePointStats.datetime ||
              `Time ${index}`,
            min: timePointStats.min,
            max: timePointStats.max,
            mean: timePointStats.mean,
          }))
          .filter(
            (point) =>
              point.min !== null && point.max !== null && point.mean !== null
          );

        // Create labels array (shared across all datasets)
        const labels = timePoints.map((point) => {
          const date = new Date(point.datetime);
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        });

        const units = layerStats.layerName || 'Value';

        // Return exactly 3 datasets with the same units so they all use one axis
        return [
          {
            parameterName: 'Minimum',
            data: timePoints.map((point) => point.min),
            labels: labels,
            units: units,
          },
          {
            parameterName: 'Maximum',
            data: timePoints.map((point) => point.max),
            labels: labels,
            units: units, // Exact same units
          },
          {
            parameterName: 'Mean',
            data: timePoints.map((point) => point.mean),
            labels: labels,
            units: units, // Exact same units
          },
        ];
      }
    }

    // Fallback: Use chartData if available
    if (results.chartData && results.chartData.length > 0) {
      const layerKeys = Object.keys(results.chartData[0]).filter(
        (key) => key !== 'datetime'
      );

      // Create labels from datetime
      const labels = results.chartData.map((point) => {
        const date = new Date(point.datetime);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      });

      // Return all available layer keys as separate datasets
      return layerKeys.map((layerKey) => ({
        parameterName: `Layer ${layerKey}`,
        data: results.chartData.map((point) => point[layerKey]),
        labels: labels,
        units: 'Value', // Same units for all
      }));
    }

    return [];
  }, [results]);

  const handleDownload = () => {
    if (!results) return;

    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!results) {
    return null;
  }

  const containerStyles =
    position === 'bottom'
      ? {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '45vh',
          zIndex: 1000,
        }
      : {
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '50vw',
          zIndex: 1000,
        };

  return (
    <Box sx={containerStyles}>
      <Paper
        elevation={8}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header - matches dashboard station chart header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #eee',
          }}
        >
          <Box>
            <Typography
              variant='h6'
              sx={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              Area Analysis Results
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Statistical trends over time •{' '}
              {chartDatasets.reduce(
                (acc, dataset) => acc + dataset.data.length,
                0
              )}{' '}
              data points
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, zIndex: '10000' }}>
            <Tooltip title='Download Data'>
              <IconButton
                size='small'
                onClick={handleDownload}
                sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
              >
                <DownloadIcon fontSize='small' />
              </IconButton>
            </Tooltip>
            <IconButton
              size='small'
              onClick={onClose}
              sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
            >
              <CloseIcon fontSize='small' />
            </IconButton>
          </Box>
        </Box>

        {/* Chart Container - matches dashboard structure */}
        <Box sx={{ flex: 1, padding: '0px' }}>
          {chartDatasets && chartDatasets.length > 0 ? (
            <ChartProvider>
              <LineChart datasets={chartDatasets} />
            </ChartProvider>
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'text.secondary',
              }}
            >
              <Typography variant='h6' gutterBottom>
                No Data Available
              </Typography>
              <Typography variant='body2'>
                No temporal data found for the selected analysis
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
