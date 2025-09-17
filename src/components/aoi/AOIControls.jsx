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
} from '@mui/icons-material';
import { useAOI } from '../../context/aoiContext';
import { getTemporalDisplayName } from '../../utils/temporalGrouping';

const getTimeWindowOptions = (resolution) => {
  switch (resolution) {
    case 'hourly':
      return [
        { value: '6h', label: '6h' },
        { value: '12h', label: '12h' },
      ];
    case 'daily':
      return [
        { value: '10d', label: '10 days' },
        { value: '30d', label: '30 days' },
      ];
    case 'yearly':
      return [
        { value: '1y', label: '1 year' },
        { value: '5y', label: '5 years' },
        { value: '10y', label: '10 years' },
      ];
    default:
      return [
        { value: '10d', label: '10 days' },
        { value: '30d', label: '30 days' },
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
            <AnalyticsIcon color="action" fontSize="small" />
            <Typography variant="subtitle2" color="text.secondary">
              Area Analysis
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
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
          <AnalyticsIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight="600">
            Area Analysis
          </Typography>
          {state.selectedAOI && state.selectedTemporalGroup && state.selectedTimeWindow && (
            <CheckIcon fontSize="small" color="success" />
          )}
        </Box>

        <Box sx={{ p: 1.5, pt: 1 }}>
          {/* Area Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="500" gutterBottom sx={{ color: 'text.primary' }}>
              Analysis Area
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              {!state.isDrawing ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DrawIcon />}
                  onClick={handleStartDrawing}
                  disabled={state.analysisState.status === 'analyzing'}
                  sx={{ 
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                  }}
                >
                  Draw
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<StopIcon />}
                  onClick={handleStopDrawing}
                  color="warning"
                  sx={{ 
                    minWidth: 'auto',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                  }}
                >
                  Stop
                </Button>
              )}

              {state.predefinedAOIs.length > 0 && (
                <Button
                  variant="text"
                  size="small"
                  endIcon={<ArrowDownIcon />}
                  onClick={() => setShowPresets(!showPresets)}
                  disabled={state.isDrawing || state.analysisState.status === 'analyzing'}
                  sx={{ 
                    minWidth: 'auto',
                    px: 1,
                    py: 0.5,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                  }}
                >
                  Presets
                </Button>
              )}

              {state.selectedAOI && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={handleClearAOI}
                  color="error"
                  sx={{ 
                    minWidth: 'auto',
                    px: 1,
                    py: 0.5,
                    fontSize: '0.75rem',
                  }}
                >
                  Clear
                </Button>
              )}
            </Box>

            <Collapse in={showPresets}>
              <Box sx={{ mb: 1 }}>
                {state.predefinedAOIs.map((aoi) => (
                  <Button
                    key={aoi.id}
                    variant="text"
                    size="small"
                    startIcon={<LocationIcon />}
                    onClick={() => handlePredefinedAOISelect(aoi.id)}
                    sx={{ 
                      display: 'block',
                      justifyContent: 'flex-start',
                      width: '100%',
                      py: 0.25,
                      fontSize: '0.75rem',
                      textTransform: 'none',
                    }}
                  >
                    {aoi.name}
                  </Button>
                ))}
              </Box>
            </Collapse>

            {state.isDrawing && (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.75rem', mb: 1 }}>
                Click points to draw polygon, click first point to close
              </Alert>
            )}

            {state.selectedAOI && (
              <Chip
                label="Area Selected"
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>

          {/* Data Selection */}
          {state.temporalGroups.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="500" gutterBottom sx={{ color: 'text.primary' }}>
                Data & Time Window
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
                  <Select
                    value={state.selectedTemporalGroup || ''}
                    onChange={handleTemporalGroupSelect}
                    displayEmpty
                    disabled={state.analysisState.status === 'analyzing' || state.isDrawing}
                    sx={{ fontSize: '0.8rem' }}
                  >
                    <MenuItem value="" disabled>
                      <Typography variant="body2" color="text.secondary">
                        Resolution
                      </Typography>
                    </MenuItem>
                    {state.temporalGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimelineIcon fontSize="small" />
                          <Typography variant="body2">
                            {getTemporalDisplayName(group.resolution)}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {timeWindowOptions.length > 0 && (
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <Select
                      value={state.selectedTimeWindow || ''}
                      onChange={handleTimeWindowSelect}
                      displayEmpty
                      disabled={state.analysisState.status === 'analyzing' || state.isDrawing}
                      sx={{ fontSize: '0.8rem' }}
                    >
                      <MenuItem value="" disabled>
                        <Typography variant="body2" color="text.secondary">
                          Window
                        </Typography>
                      </MenuItem>
                      {timeWindowOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          <Typography variant="body2">
                            {option.label}
                          </Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              {state.selectedTemporalGroup && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {state.temporalGroups
                    .find((g) => g.id === state.selectedTemporalGroup)
                    ?.layers.map((l) => l.name)
                    .slice(0, 2)
                    .join(', ')}
                  {state.temporalGroups.find((g) => g.id === state.selectedTemporalGroup)?.layers.length > 2 && '...'}
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
                  <Typography variant="caption" color="primary.600" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    From {formatActiveDate(activeDate)}
                  </Typography>
                  {activeLayer && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
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
                <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                  {state.analysisState.message}
                </Typography>
              </Alert>

              {state.analysisState.status === 'analyzing' && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={state.analysisState.progress || 0}
                    sx={{ height: 3, borderRadius: 1 }}
                  />
                  <Typography
                    variant="caption"
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
            variant="contained"
            fullWidth
            startIcon={<AnalyticsIcon />}
            onClick={handleRunAnalysis}
            disabled={!canRunAnalysis || state.analysisState.status === 'analyzing'}
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