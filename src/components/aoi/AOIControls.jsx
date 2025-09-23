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
  Chip,
  Alert,
  Tooltip,
  LinearProgress,
  Collapse,
  Divider,
  CircularProgress,
  AlertTitle,
} from '@mui/material';
import {
  Draw as DrawIcon,
  Clear as ClearIcon,
  Analytics as AnalyticsIcon,
  LocationOn as LocationIcon,
  Timeline as TimelineIcon,
  Stop as StopIcon,
  KeyboardArrowDown as ArrowDownIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAOI } from '../../context/aoiContext';
import { getTemporalDisplayName } from '../../utils/temporalGrouping';

const getTimeWindowOptions = (resolution) => {
  // A helper function to generate a continuous array of options
  const generateRange = (start, end, unitSingular, unitPlural, suffix) => {
    const options = [];
    for (let i = start; i <= end; i++) {
      options.push({
        value: `${i}${suffix}`,
        label: `${i} ${i === 1 ? unitSingular : unitPlural}`,
      });
    }
    return options;
  };

  switch (resolution) {
    case 'hourly':
      // Generates 6h, 7h, 8h... up to 12h
      return generateRange(6, 12, 'hour', 'hours', 'h');
    case 'daily':
      // Generates 10 days, 11 days... up to 30 days
      return generateRange(10, 30, 'day', 'days', 'd');
    case 'yearly':
      // Generates 1 year, 2 years... up to 10 years
      return generateRange(1, 10, 'year', 'years', 'y');
    default:
      // Default to the daily range
      return generateRange(10, 30, 'day', 'days', 'd');
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
  // New props for handling AOI loading state
  areAOIsLoading = false,
  aoiLoadError = null,
  areAOIsLoaded = false,
  onRetryLoadAOIs = null,
}) {
  const { state, actions } = useAOI();
  const [showPresets, setShowPresets] = useState(false);

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
    (aoiId) => {
      const selectedAOI = state.predefinedAOIs.find((aoi) => aoi.id === aoiId);
      if (selectedAOI) {
        actions.setAOI(selectedAOI.geometry);
        setShowPresets(false);
      }
    },
    [state.predefinedAOIs, actions]
  );

  const handleTemporalGroupSelect = useCallback(
    (event) => {
      actions.selectTemporalGroup(event.target.value);
      actions.setTimeWindow(null);
    },
    [actions]
  );

  const handleTimeWindowSelect = useCallback(
    (event) => {
      actions.setTimeWindow(event.target.value);
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

  const handleRetryLoadAOIs = useCallback(() => {
    if (onRetryLoadAOIs) {
      onRetryLoadAOIs();
    }
  }, [onRetryLoadAOIs]);

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
      margin: '8px',
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
    if (!dateString) return '';
    let date;
    if (
      typeof dateString === 'string' &&
      !dateString.includes('Z') &&
      !dateString.includes('+') &&
      !dateString.includes('-')
    ) {
      date = new Date(dateString + 'Z');
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!hasLayers) {
    return (
      <Box sx={getPositionStyles()}>
        <Paper
          elevation={position === 'embedded' ? 0 : 2}
          sx={{
            p: 2,
            borderRadius: 2,
            backgroundColor:
              position === 'embedded'
                ? 'transparent'
                : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: position === 'embedded' ? 'none' : 'blur(10px)',
            border: position === 'embedded' ? '1px solid #e0e0e0' : 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AnalyticsIcon color='action' fontSize='small' />
            <Typography variant='subtitle2' color='text.secondary'>
              Area Analysis
            </Typography>
          </Box>
          <Typography variant='body2' color='text.secondary'>
            Add layers to enable analysis
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={getPositionStyles()}>
      <Paper
        elevation={position === 'embedded' ? 0 : 2}
        sx={{
          borderRadius: 2,
          backgroundColor:
            position === 'embedded'
              ? 'transparent'
              : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: position === 'embedded' ? 'none' : 'blur(10px)',
          border: position === 'embedded' ? '1px solid #e0e0e0' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 1.5,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <AnalyticsIcon fontSize='small' color='primary' />
          <Typography variant='subtitle2' fontWeight='600'>
            Area Analysis
          </Typography>
          {state.selectedAOI &&
            state.selectedTemporalGroup &&
            state.selectedTimeWindow && (
              <CheckIcon fontSize='small' color='success' />
            )}
        </Box>

        <Box sx={{ p: 1.5, pt: 1 }}>
          {/* Area Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='body2'
              fontWeight='500'
              gutterBottom
              sx={{ color: 'text.primary' }}
            >
              Analysis Area
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              {!state.isDrawing ? (
                <Button
                  variant='outlined'
                  size='small'
                  onClick={handleStartDrawing}
                  disabled={state.analysisState.status === 'analyzing'}
                  sx={{
                    minWidth: 'auto',
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <DrawIcon fontSize='small' />
                </Button>
              ) : (
                <Button
                  variant='outlined'
                  size='small'
                  onClick={handleStopDrawing}
                  color='warning'
                  sx={{
                    minWidth: 'auto',
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <StopIcon fontSize='small' />
                </Button>
              )}

              {/* Predefined AOI Select with Loading State */}
              <FormControl
                size='small'
                sx={{
                  flex: 1,
                  minWidth: 120,
                }}
              >
                <Select
                  value=''
                  onChange={(e) => handlePredefinedAOISelect(e.target.value)}
                  displayEmpty
                  disabled={
                    state.isDrawing ||
                    state.analysisState.status === 'analyzing' ||
                    areAOIsLoading ||
                    (aoiLoadError && !areAOIsLoaded)
                  }
                  sx={{
                    fontSize: '0.75rem',
                    '& .MuiSelect-select': {
                      py: 0.5,
                      px: 1,
                    },
                  }}
                >
                  <MenuItem value='' disabled>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {areAOIsLoading ? (
                        <>
                          <CircularProgress size={12} />
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            sx={{ fontSize: '0.75rem' }}
                          >
                            Loading areas...
                          </Typography>
                        </>
                      ) : aoiLoadError ? (
                        <>
                          <WarningIcon fontSize='small' color='error' />
                          <Typography
                            variant='body2'
                            color='error'
                            sx={{ fontSize: '0.75rem' }}
                          >
                            Load failed
                          </Typography>
                        </>
                      ) : (
                        <>
                          <LocationIcon fontSize='small' color='action' />
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            sx={{ fontSize: '0.75rem' }}
                          >
                            Choose preset area
                          </Typography>
                        </>
                      )}
                    </Box>
                  </MenuItem>
                  
                  {/* Only show state options if loaded successfully */}
                  {areAOIsLoaded &&
                    !areAOIsLoading &&
                    !aoiLoadError &&
                    state.predefinedAOIs.map((aoi) => (
                      <MenuItem key={aoi.id} value={aoi.id}>
                        <Typography
                          variant='body2'
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {aoi.name}
                        </Typography>
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Retry button for failed AOI loading */}
              {aoiLoadError && onRetryLoadAOIs && (
                <Tooltip title='Retry loading preset areas'>
                  <Button
                    variant='text'
                    size='small'
                    onClick={handleRetryLoadAOIs}
                    disabled={areAOIsLoading}
                    sx={{
                      minWidth: 'auto',
                      px: 1,
                      py: 0.5,
                    }}
                  >
                    <RefreshIcon fontSize='small' />
                  </Button>
                </Tooltip>
              )}

              {state.selectedAOI && (
                <Button
                  variant='text'
                  size='small'
                  onClick={handleClearAOI}
                  color='error'
                  sx={{
                    minWidth: 'auto',
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <ClearIcon fontSize='small' />
                </Button>
              )}
            </Box>

            {/* AOI Loading Error Alert */}
            {aoiLoadError && (
              <Alert
                severity='warning'
                sx={{ py: 0.5, fontSize: '0.75rem', mb: 1 }}
                action={
                  onRetryLoadAOIs && (
                    <Button
                      color='inherit'
                      size='small'
                      onClick={handleRetryLoadAOIs}
                      disabled={areAOIsLoading}
                    >
                      Retry
                    </Button>
                  )
                }
              >
                <AlertTitle sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                  Failed to load preset areas
                </AlertTitle>
                {aoiLoadError}
              </Alert>
            )}

            {/* AOI Loading Progress */}
            {areAOIsLoading && (
              <Alert
                severity='info'
                sx={{ py: 0.5, fontSize: '0.75rem', mb: 1 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant='body2' sx={{ fontSize: '0.75rem' }}>
                    Loading US states...
                  </Typography>
                </Box>
              </Alert>
            )}

            {state.isDrawing && (
              <Alert
                severity='info'
                sx={{ py: 0.5, fontSize: '0.75rem', mb: 1 }}
              >
                Click points to draw polygon, click first point to close
              </Alert>
            )}

            {state.selectedAOI && (
              <Chip
                label='Area Selected'
                size='small'
                color='success'
                variant='outlined'
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            )}

            {/* Show state count when loaded */}
            {areAOIsLoaded && !areAOIsLoading && !aoiLoadError && (
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ fontSize: '0.65rem', display: 'block', mt: 0.5 }}
              >
                {state.predefinedAOIs.length} preset areas available
              </Typography>
            )}
          </Box>

          {/* Data Selection */}
          {state.temporalGroups.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='body2'
                fontWeight='500'
                gutterBottom
                sx={{ color: 'text.primary' }}
              >
                Data & Time Window
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <FormControl size='small' sx={{ minWidth: 120, flex: 1 }}>
                  <Select
                    value={state.selectedTemporalGroup || ''}
                    onChange={handleTemporalGroupSelect}
                    displayEmpty
                    disabled={
                      state.analysisState.status === 'analyzing' ||
                      state.isDrawing
                    }
                    sx={{ fontSize: '0.8rem' }}
                  >
                    <MenuItem value='' disabled>
                      <Typography variant='body2' color='text.secondary'>
                        Resolution
                      </Typography>
                    </MenuItem>
                    {state.temporalGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <TimelineIcon fontSize='small' />
                          <Typography variant='body2'>
                            {getTemporalDisplayName(group.resolution)}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {timeWindowOptions.length > 0 && (
                  <FormControl size='small' sx={{ minWidth: 80 }}>
                    <Select
                      value={state.selectedTimeWindow || ''}
                      onChange={handleTimeWindowSelect}
                      displayEmpty
                      disabled={
                        state.analysisState.status === 'analyzing' ||
                        state.isDrawing
                      }
                      sx={{ fontSize: '0.8rem' }}
                    >
                      <MenuItem value='' disabled>
                        <Typography variant='body2' color='text.secondary'>
                          Window
                        </Typography>
                      </MenuItem>
                      {timeWindowOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Typography variant='body2'>
                            {option.label}
                          </Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              {state.selectedTemporalGroup && (
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ fontSize: '0.7rem' }}
                >
                  {state.temporalGroups
                    .find((g) => g.id === state.selectedTemporalGroup)
                    ?.layers.map((l) => l.name)
                    .slice(0, 2)
                    .join(', ')}
                  {state.temporalGroups.find(
                    (g) => g.id === state.selectedTemporalGroup
                  )?.layers.length > 2 && '...'}
                </Typography>
              )}

              {activeDate && state.selectedTimeWindow && (
                <Box
                  sx={{
                    mt: 1,
                    p: 0.75,
                    bgcolor: 'primary.50',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'primary.200',
                  }}
                >
                  <Typography
                    variant='caption'
                    color='primary.600'
                    sx={{ fontSize: '0.7rem', fontWeight: 500 }}
                  >
                    From {formatActiveDate(activeDate)}
                  </Typography>
                  {activeLayer && (
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ display: 'block', fontSize: '0.65rem' }}
                    >
                      {activeLayer.name}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Status & Progress */}
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
                sx={{ py: 0.5, fontSize: '0.75rem' }}
              >
                <Typography variant='body2' sx={{ fontSize: '0.75rem' }}>
                  {state.analysisState.message}
                </Typography>
              </Alert>

              {state.analysisState.status === 'analyzing' && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant='determinate'
                    value={state.analysisState.progress || 0}
                    sx={{ height: 3, borderRadius: 1 }}
                  />
                  <Typography
                    variant='caption'
                    sx={{
                      display: 'block',
                      textAlign: 'center',
                      mt: 0.25,
                      fontSize: '0.65rem',
                      color: 'text.secondary',
                    }}
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
            sx={{
              py: 1,
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            {state.analysisState.status === 'analyzing'
              ? 'Analyzing...'
              : state.isDrawing
                ? 'Complete drawing first'
                : !state.selectedTimeWindow
                  ? 'Select time window'
                  : 'Run Analysis'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}