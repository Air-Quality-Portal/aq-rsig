// hooks/useAOIIntegration.js - Fixed to pass activeDate and timeWindow
import { useCallback, useEffect, useMemo } from 'react';
import { useAOI } from '../context/aoiContext';
import { analysisService } from '../services/analysisService';
import {
  groupLayersByTemporalResolution,
  getDefaultPredefinedAOIs,
} from '../utils/temporalGrouping';

export function useAOIIntegration(layerDisplayList = [], options = {}) {
  const { activeDate, activeLayer } = options;
  const { state, actions } = useAOI();

  // Memoize predefined AOIs to prevent recreation
  const predefinedAOIs = useMemo(() => getDefaultPredefinedAOIs(), []);

  // Initialize predefined AOIs ONLY ONCE
  useEffect(() => {
    actions.setPredefinedAOIs(predefinedAOIs);
  }, []); // Remove actions dependency - only run once

  // Memoize temporal groups to prevent unnecessary recalculation
  const temporalGroups = useMemo(() => {
    return groupLayersByTemporalResolution(layerDisplayList);
  }, [layerDisplayList]);

  // Update temporal groups when they actually change
  useEffect(() => {
    actions.setTemporalGroups(temporalGroups);
  }, [temporalGroups]); // Remove actions dependency

  // Start drawing AOI
  const startDrawing = useCallback(() => {
    actions.setDrawing(true);
    actions.setAnalysisState({
      status: 'idle',
      message: 'Draw a polygon on the map to select your area of interest',
    });
  }, []); // Remove actions dependency

  // Handle AOI drawing complete
  const onDrawComplete = useCallback((feature) => {
    actions.setAOI(feature);
    actions.setDrawing(false);
    actions.setAnalysisState({
      status: 'idle',
      message: 'Area selected. Choose temporal resolution and run analysis.',
    });
  }, []); // Remove actions dependency

  // Handle AOI drawing cancel
  const onDrawCancel = useCallback(() => {
    actions.setDrawing(false);
    if (!state.selectedAOI) {
      actions.setAnalysisState({
        status: 'idle',
        message: 'Select an area to start analysis',
      });
    } else {
      actions.setAnalysisState({
        status: 'idle',
        message: 'Area selected. Choose temporal resolution and run analysis.',
      });
    }
  }, [state.selectedAOI]); // Only depend on selectedAOI

  // Clear AOI
  const clearAOI = useCallback(() => {
    actions.setAOI(null);
    actions.setDrawing(false); // Also stop drawing
    actions.clearAnalysis();
  }, []); // Remove actions dependency

  // Run analysis
  const runAnalysis = useCallback(async () => {
    if (!state.selectedAOI || !state.selectedTemporalGroup || state.isDrawing) {
      return;
    }

    // Check for required parameters
    if (!activeDate) {
      actions.setAnalysisState({
        status: 'error',
        message: 'Active date is required. Please select a time frame on the map.',
      });
      return;
    }

    if (!state.selectedTimeWindow) {
      actions.setAnalysisState({
        status: 'error',
        message: 'Time window is required. Please select a time window.',
      });
      return;
    }

    const temporalGroup = state.temporalGroups.find(
      (g) => g.id === state.selectedTemporalGroup
    );
    if (!temporalGroup) {
      actions.setAnalysisState({
        status: 'error',
        message: 'Selected temporal group not found',
      });
      return;
    }

    actions.setAnalysisState({
      status: 'analyzing',
      message: 'Starting analysis...',
      progress: 0,
    });

    try {
      const results = await analysisService.runAnalysis(
        state.selectedAOI,
        temporalGroup,
        (progress, message) => {
          actions.setAnalysisState({
            status: 'analyzing',
            message,
            progress,
          });
        },
        {
          activeDate: activeDate,
          timeWindow: state.selectedTimeWindow,
          layerName: activeLayer?.name || 'Unknown Layer',
        }
      );

      actions.setAnalysisResults(results);
      actions.setAnalysisState({
        status: 'complete',
        message: 'Analysis completed successfully',
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      actions.setAnalysisState({
        status: 'error',
        message: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [
    state.selectedAOI, 
    state.selectedTemporalGroup, 
    state.selectedTimeWindow,
    state.temporalGroups, 
    state.isDrawing,
    activeDate,
    activeLayer
  ]); // Add activeDate and activeLayer to dependencies

  // Clear results but keep AOI
  const clearResults = useCallback(() => {
    actions.setAnalysisResults(null);
    actions.setAnalysisState({
      status: 'idle',
      message: state.selectedAOI
        ? 'Area selected. Choose temporal resolution and run analysis.'
        : 'Select an area to start analysis',
    });
  }, [state.selectedAOI]); // Remove actions dependency

  return {
    // State
    aoiState: state,

    // Actions
    startDrawing,
    clearAOI,
    runAnalysis,
    onDrawComplete,
    onDrawCancel,
    clearResults,

    // Computed
    canRunAnalysis: Boolean(
      state.selectedAOI &&
        state.selectedTemporalGroup &&
        state.selectedTimeWindow &&
        activeDate &&
        state.temporalGroups.length > 0 &&
        !state.isDrawing // Don't allow analysis while drawing
    ),
    isAnalyzing: state.analysisState.status === 'analyzing',
    hasResults: Boolean(state.analysisResults),
    isDrawing: state.isDrawing,
  };
}