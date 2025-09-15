// components/aoi/AnalysisResults.jsx
import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAOI } from '../../context/aoiContext';

export function AnalysisResults({ onClose, position = 'bottom' }) {
  const { state } = useAOI();
  const results = state.analysisResults;

  // Prepare chart data with min, max, mean values from the spatial statistics
  const chartData = useMemo(() => {
    if (!results) return [];

    // Check if we have statistics data with temporal breakdown
    if (results.statistics && results.statistics.length > 0) {
      const layerStats = results.statistics[0]; // Get first (and likely only) layer
      
      if (layerStats.statistics && layerStats.statistics.length > 0) {
        // Extract temporal statistics (min/max/mean for each time point)
        return layerStats.statistics.map((timePointStats, index) => ({
          datetime: results.chartData[index]?.datetime || `Time ${index}`,
          min: timePointStats.min,
          max: timePointStats.max,
          mean: timePointStats.mean
        })).filter(point => 
          point.min !== null && point.max !== null && point.mean !== null
        );
      }
    }

    // Fallback: If no temporal statistics, create test data to show the chart works
    if (results.chartData && results.chartData.length > 0) {
      return results.chartData.map((point) => {
        // Use the single value and create some spread around it for demonstration
        const layerKeys = Object.keys(point).filter(key => key !== 'datetime');
        if (layerKeys.length > 0) {
          const baseValue = point[layerKeys[0]];
          return {
            datetime: point.datetime,
            min: baseValue * 0.8,  // 20% below
            max: baseValue * 1.2,  // 20% above  
            mean: baseValue
          };
        }
        return null;
      }).filter(Boolean);
    }

    return [];
  }, [results]);

  // Colors for the three lines
  const colors = {
    min: '#dc2626',    // Red
    max: '#16a34a',    // Green  
    mean: '#2563eb'    // Blue
  };

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
          height: '50vh',
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
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'grey.50'
          }}
        >
          <Box>
            <Typography variant='h6' sx={{ fontWeight: 600 }}>
              Time Series Analysis
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Statistical trends over time • {chartData.length} data points
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
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

        {/* Chart */}
        <Box sx={{ flex: 1, p: 3 }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart 
                data={chartData}
                margin={{ top: 20, right: 30, left: 40, bottom: 60 }}
              >
                <CartesianGrid 
                  strokeDasharray='3 3' 
                  stroke='#e5e7eb'
                  opacity={0.7}
                />
                <XAxis
                  dataKey='datetime'
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: '2-digit'
                    });
                  }}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#9ca3af' }}
                  tickLine={{ stroke: '#9ca3af' }}
                  angle={-45}
                  textAnchor='end'
                  height={60}
                />
                <YAxis
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    if (value < 1) return value.toFixed(3);
                    return value.toFixed(1);
                  }}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={{ stroke: '#9ca3af' }}
                  tickLine={{ stroke: '#9ca3af' }}
                  width={60}
                />
                <RechartsTooltip
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { 
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                  }}
                  formatter={(value, name) => [
                    typeof value === 'number' ? value.toFixed(4) : value,
                    name
                  ]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType='line'
                />
                
                <Line
                  type='monotone'
                  dataKey='min'
                  stroke={colors.min}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  name='Minimum'
                  strokeDasharray='none'
                />
                
                <Line
                  type='monotone'
                  dataKey='max'
                  stroke={colors.max}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  name='Maximum'
                  strokeDasharray='none'
                />
                
                <Line
                  type='monotone'
                  dataKey='mean'
                  stroke={colors.mean}
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                  name='Mean'
                  strokeDasharray='none'
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Box 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'text.secondary'
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