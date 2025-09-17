// components/aoi/AOIControls.jsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Divider,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Draw as DrawIcon,
  Clear as ClearIcon,
  Analytics as AnalyticsIcon,
  LocationOn as LocationIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { useAOI } from '../../context/aoiContext';
import { getTemporalDisplayName } from '../../utils/temporalGrouping';

const getTimeWindowOptions = (resolution) => {
  switch (resolution) {
    case 'hourly':
      return [
        { value: '6h', label: '6 Hours' },
        { value: '12h', label: '12 Hours' },
      ];
    case 'daily':
      return [
        { value: '10d', label: '10 Days' },
        { value: '30d', label: '30 Days' },
      ];
    case 'yearly':
      return [
        { value: '1y', label: '1 Year' },
        { value: '5y', label: '5 Years' },
        { value: '10y', label: '10 Years' },
      ];
    default:
      return [
        { value: '10d', label: '10 Days' },
        { value: '30d', label: '30 Days' },
      ];
  }
};

export function AOIControls({
  layerDisplayList = [],
  onStartDrawing,
  onClearAOI,
  onRunAnalysis,
  position = 'top-left',
  activeDate = null,
  activeLayer = null,
}) {
  const { state, actions } = useAOI();
  const [showExpanded, setShowExpanded] = useState(false);

  const selectedTemporalGroup = useMemo(() => {
    return state.temporalGroups.find(
      (g) => g.id === state.selectedTemporalGroup
    );
  }, [state.temporalGroups, state.selectedTemporalGroup]);

  const timeWindowOptions = useMemo(() => {
    if (!selectedTemporalGroup) return [];
    return getTimeWindowOptions(selectedTemporalGroup.resolution);
  }, [selectedTemporalGroup]);

  const handlePredefinedAOISelect = useCallback(
    (event) => {
      const aoiId = event.target.value;
      const selectedAOI = state.predefinedAOIs.find((aoi) => aoi.id === aoiId);
      if (selectedAOI) {
        actions.setAOI(selectedAOI.geometry);
      }
    },
    [state.predefinedAOIs, actions]
  );

  const handleTemporalGroupSelect = useCallback(
    (event) => {
      const groupId = event.target.value;
      actions.selectTemporalGroup(groupId);
      // Reset time window when temporal group changes
      actions.setTimeWindow(null);
    },
    [actions]
  );

  const handleTimeWindowSelect = useCallback(
    (event) => {
      const timeWindow = event.target.value;
      actions.setTimeWindow(timeWindow);
    },
    [actions]
  );

  const handleRunAnalysis = useCallback(() => {
    if (
      !state.selectedAOI ||
      !state.selectedTemporalGroup ||
      !state.selectedTimeWindow
    )
      return;
    onRunAnalysis();
  }, [
    state.selectedAOI,
    state.selectedTemporalGroup,
    state.selectedTimeWindow,
    onRunAnalysis,
  ]);

  const handleClearAOI = useCallback(() => {
    actions.setAOI(null);
    actions.clearAnalysis();
    actions.setDrawing(false);
    actions.setTimeWindow(null);
    if (onClearAOI) onClearAOI();
  }, [actions, onClearAOI]);

  const handleStartDrawing = useCallback(() => {
    actions.setDrawing(true);
    if (onStartDrawing) onStartDrawing();
  }, [actions, onStartDrawing]);

  const handleStopDrawing = useCallback(() => {
    actions.setDrawing(false);
  }, [actions]);

  const canRunAnalysis =
    state.selectedAOI &&
    state.selectedTemporalGroup &&
    state.selectedTimeWindow &&
    state.temporalGroups.length > 0;

  const hasLayers = layerDisplayList.length > 0;

  const getPositionStyles = () => {
    if (position === 'embedded') {
      return {
        width: '100%',
        margin: 0,
      };
    }

    const baseStyles = {
      position: 'absolute',
      zIndex: 1300,
      margin: '10px',
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: 0, right: 0 };
      case 'bottom-left':
        return { ...baseStyles, bottom: 0, left: 0 };
      case 'bottom-right':
        return { ...baseStyles, bottom: 0, right: 0 };
      default:
        return { ...baseStyles, top: 0, left: 0 };
    }
  };

  const formatActiveDate = (dateString) => {
    if (!dateString) return 'No date selected';

    let date; // Add this variable declaration

    // If no timezone info, treat as UTC
    if (
      typeof dateString === 'string' &&
      !dateString.includes('Z') &&
      !dateString.includes('+') &&
      !dateString.includes('-')
    ) {
      date = new Date(dateString + 'Z'); // Force UTC interpretation
    } else {
      date = new Date(dateString);
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <Box sx={getPositionStyles()}>
      <Paper
        elevation={position === 'embedded' ? 1 : 3}
        sx={{
          p: 2,
          minWidth: position === 'embedded' ? 'auto' : 280,
          maxWidth: position === 'embedded' ? 'none' : 350,
          backgroundColor:
            position === 'embedded'
              ? 'transparent'
              : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: position === 'embedded' ? 'none' : 'blur(10px)',
          border: position === 'embedded' ? '1px solid #e0e0e0' : 'none',
          borderRadius: position === 'embedded' ? 1 : 2,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography
            variant='h6'
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <AnalyticsIcon />
            Area Analysis
          </Typography>
          <IconButton
            size='small'
            onClick={() => setShowExpanded(!showExpanded)}
          >
            {showExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {!hasLayers && (
          <Alert severity='info' sx={{ mb: 2 }}>
            Add layers to the map to enable analysis
          </Alert>
        )}

        {hasLayers && (
          <>
            {/* AOI Selection */}
            <Box sx={{ mb: 2 }}>
              <Typography variant='subtitle2' gutterBottom>
                1. Select Analysis Area
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                {!state.isDrawing ? (
                  <Tooltip title='Draw a polygon on the map'>
                    <Button
                      variant='outlined'
                      startIcon={<DrawIcon />}
                      onClick={handleStartDrawing}
                      size='small'
                      disabled={state.analysisState.status === 'analyzing'}
                    >
                      Draw Area
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip title='Stop drawing'>
                    <Button
                      variant='outlined'
                      startIcon={<StopIcon />}
                      onClick={handleStopDrawing}
                      size='small'
                      color='warning'
                    >
                      Stop Drawing
                    </Button>
                  </Tooltip>
                )}

                {state.selectedAOI && (
                  <Tooltip title='Clear selected area'>
                    <Button
                      variant='outlined'
                      startIcon={<ClearIcon />}
                      onClick={handleClearAOI}
                      size='small'
                      color='secondary'
                    >
                      Clear
                    </Button>
                  </Tooltip>
                )}
              </Box>

              {state.isDrawing && (
                <Alert severity='info' sx={{ mb: 1 }}>
                  <Typography variant='body2'>
                    <strong>Drawing Mode Active:</strong>
                    <br />
                    • Click to add points
                    <br />
                    • Click first point to close polygon
                    <br />• Press Escape to cancel
                  </Typography>
                </Alert>
              )}

              {state.predefinedAOIs.length > 0 && (
                <FormControl fullWidth size='small' sx={{ mb: 1 }}>
                  <InputLabel>Or Choose Predefined Area</InputLabel>
                  <Select
                    label='Or Choose Predefined Area'
                    value=''
                    onChange={handlePredefinedAOISelect}
                    disabled={
                      state.analysisState.status === 'analyzing' ||
                      state.isDrawing
                    }
                  >
                    {state.predefinedAOIs.map((aoi) => (
                      <MenuItem key={aoi.id} value={aoi.id}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                          <LocationIcon fontSize='small' />
                          {aoi.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {state.selectedAOI && (
                <Chip
                  label='Area Selected'
                  color='success'
                  size='small'
                  sx={{ mt: 1 }}
                />
              )}
            </Box>

            {/* Temporal Group Selection */}
            {state.temporalGroups.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant='subtitle2' gutterBottom>
                  2. Select Data Resolution
                </Typography>

                <FormControl fullWidth size='small' sx={{ mb: 1 }}>
                  <InputLabel>Data Resolution</InputLabel>
                  <Select
                    value={state.selectedTemporalGroup || ''}
                    label='Data Resolution'
                    onChange={handleTemporalGroupSelect}
                    disabled={
                      state.analysisState.status === 'analyzing' ||
                      state.isDrawing
                    }
                  >
                    {state.temporalGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <TimelineIcon fontSize='small' />
                          {getTemporalDisplayName(group.resolution)} (
                          {group.count} layers)
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {state.selectedTemporalGroup && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant='caption' color='text.secondary'>
                      Layers:{' '}
                      {state.temporalGroups
                        .find((g) => g.id === state.selectedTemporalGroup)
                        ?.layers.map((l) => l.name)
                        .join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Time Window Selection */}
            {state.selectedTemporalGroup && timeWindowOptions.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant='subtitle2' gutterBottom>
                  3. Select Time Window
                </Typography>

                <FormControl fullWidth size='small' sx={{ mb: 1 }}>
                  <InputLabel>Time Window</InputLabel>
                  <Select
                    value={state.selectedTimeWindow || ''}
                    label='Time Window'
                    onChange={handleTimeWindowSelect}
                    disabled={
                      state.analysisState.status === 'analyzing' ||
                      state.isDrawing
                    }
                  >
                    {timeWindowOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {activeDate && (
                  <Box
                    sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}
                  >
                    <Typography variant='caption' color='text.secondary'>
                      Analysis will start from active date:
                    </Typography>
                    <Typography variant='body2' fontWeight='medium'>
                      {formatActiveDate(activeDate)}
                    </Typography>
                    {activeLayer && (
                      <Typography variant='caption' color='text.secondary'>
                        Layer: {activeLayer.name}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Analysis Status */}
            {state.analysisState.status !== 'idle' && (
              <Box sx={{ mb: 2 }}>
                <Alert
                  severity={
                    state.analysisState.status === 'error'
                      ? 'error'
                      : state.analysisState.status === 'complete'
                        ? 'success'
                        : 'info'
                  }
                >
                  {state.analysisState.message}
                </Alert>

                {state.analysisState.status === 'analyzing' && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress
                      variant='determinate'
                      value={state.analysisState.progress || 0}
                    />
                    <Typography
                      variant='caption'
                      sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}
                    >
                      {Math.round(state.analysisState.progress || 0)}%
                    </Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* Run Analysis Button */}
            <Button
              variant='contained'
              fullWidth
              startIcon={<AnalyticsIcon />}
              onClick={handleRunAnalysis}
              disabled={
                !canRunAnalysis || state.analysisState.status === 'analyzing'
              }
              sx={{ mt: 1 }}
            >
              {state.analysisState.status === 'analyzing'
                ? 'Analyzing...'
                : state.isDrawing
                  ? 'Complete drawing first'
                  : !state.selectedTimeWindow
                    ? 'Select time window'
                    : 'Run Analysis'}
            </Button>

            {/* Expanded Details */}
            {showExpanded && state.temporalGroups.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant='subtitle2' gutterBottom>
                  Available Data Groups
                </Typography>
                {state.temporalGroups.map((group) => (
                  <Box
                    key={group.id}
                    sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}
                  >
                    <Typography variant='body2' fontWeight='medium'>
                      {getTemporalDisplayName(group.resolution)} ({group.count}{' '}
                      layers)
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {group.layers.map((l) => l.name).join(', ')}
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
