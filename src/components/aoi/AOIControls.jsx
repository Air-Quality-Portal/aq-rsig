// components/aoi/AOIControls.jsx
import React, { useState, useCallback, useEffect } from 'react';
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
} from '@mui/icons-material';
import { useAOI } from '../../context/aoiContext';
import {
  groupLayersByTemporalResolution,
  getTemporalDisplayName,
} from '../../utils/temporalGrouping';

export function AOIControls({
  layerDisplayList = [],
  onStartDrawing,
  onClearAOI,
  onRunAnalysis,
  position = 'top-left',
}) {
  const { state, actions } = useAOI();
  const [showExpanded, setShowExpanded] = useState(false);

  // Update temporal groups when layers change
  //   useEffect(() => {
  //     const groups = groupLayersByTemporalResolution(layerDisplayList);
  //     actions.setTemporalGroups(groups);
  //   }, [layerDisplayList]);

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
    },
    [actions]
  );

  const handleRunAnalysis = useCallback(() => {
    if (!state.selectedAOI || !state.selectedTemporalGroup) return;
    onRunAnalysis();
  }, [state.selectedAOI, state.selectedTemporalGroup, onRunAnalysis]);

  const handleClearAOI = useCallback(() => {
    actions.setAOI(null);
    actions.clearAnalysis();
    if (onClearAOI) onClearAOI();
  }, [actions, onClearAOI]);

  const canRunAnalysis =
    state.selectedAOI &&
    state.selectedTemporalGroup &&
    state.temporalGroups.length > 0;
  const hasLayers = layerDisplayList.length > 0;

  const getPositionStyles = () => {
    // For embedded position, don't use absolute positioning
    if (position === 'embedded') {
      return {
        width: '100%', // Take full width of parent container
        margin: 0, // Remove margin for embedded layout
      };
    }

    // Keep existing absolute positioning for other positions
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

              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Tooltip title='Drawing temporarily disabled - use predefined areas below'>
                  <Button
                    variant='outlined'
                    startIcon={<DrawIcon />}
                    onClick={() =>
                      alert(
                        'Drawing temporarily disabled. Please select a predefined area from the dropdown below.'
                      )
                    }
                    size='small'
                    disabled={true}
                  >
                    Draw (Coming Soon)
                  </Button>
                </Tooltip>

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

              {state.predefinedAOIs.length > 0 && (
                <FormControl fullWidth size='small' sx={{ mb: 1 }}>
                  <InputLabel>Predefined Areas</InputLabel>
                  <Select
                    label='Predefined Areas'
                    value=''
                    onChange={handlePredefinedAOISelect}
                    disabled={state.analysisState.status === 'analyzing'}
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

                {state.temporalGroups.length === 1 ? (
                  <Chip
                    icon={<TimelineIcon />}
                    label={`${getTemporalDisplayName(state.temporalGroups[0].resolution)} (${state.temporalGroups[0].count} layers)`}
                    color='primary'
                    sx={{ mb: 1 }}
                  />
                ) : (
                  <FormControl fullWidth size='small'>
                    <InputLabel>Data Resolution</InputLabel>
                    <Select
                      value={state.selectedTemporalGroup || ''}
                      label='Data Resolution'
                      onChange={handleTemporalGroupSelect}
                      disabled={state.analysisState.status === 'analyzing'}
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
                )}

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
