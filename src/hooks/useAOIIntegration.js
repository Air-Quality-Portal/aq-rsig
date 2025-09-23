// hooks/useAOIIntegration.js - Fixed to use temporal group dates instead of animation dates
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAOI } from '../context/aoiContext';
import { analysisService } from '../services/analysisService';
import {
  groupLayersByTemporalResolution,
  getDefaultPredefinedAOIs,
  getAnalysisTimeRange,
} from '../utils/temporalGrouping';

export function useAOIIntegration(layerDisplayList = [], options = {}) {
  const { activeDate, activeLayer } = options;
  const { state, actions } = useAOI();
  
  // Add loading state for predefined AOIs
  const [aoiLoadingState, setAoiLoadingState] = useState({
    loading: true,
    error: null,
    loaded: false
  });

  // Initialize and load predefined AOIs
  useEffect(() => {
    let mounted = true;
    
    const loadPredefinedAOIs = async () => {
      setAoiLoadingState({ loading: true, error: null, loaded: false });
      
      try {
        console.log('Loading predefined AOIs...');
        const predefinedAOIs = await getDefaultPredefinedAOIs();
        
        if (mounted) {
          console.log(`Loaded ${predefinedAOIs.length} predefined AOIs`);
          actions.setPredefinedAOIs(predefinedAOIs);
          setAoiLoadingState({ loading: false, error: null, loaded: true });
        }
      } catch (error) {
        console.error('Failed to load predefined AOIs:', error);
        if (mounted) {
          setAoiLoadingState({ 
            loading: false, 
            error: error.message || 'Failed to load predefined areas',
            loaded: false
          });
        }
      }
    };

    loadPredefinedAOIs();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - only run once

  // Memoize temporal groups to prevent unnecessary recalculation
  const temporalGroups = useMemo(() => {
    return groupLayersByTemporalResolution(layerDisplayList);
  }, [layerDisplayList]);

  // Update temporal groups when they actually change
  useEffect(() => {
    actions.setTemporalGroups(temporalGroups);
  }, [temporalGroups, actions]);

  // Get the selected temporal group details
  const selectedTemporalGroup = useMemo(() => {
    return state.temporalGroups.find(g => g.id === state.selectedTemporalGroup);
  }, [state.temporalGroups, state.selectedTemporalGroup]);

  // Get analysis date range from selected temporal group
  const analysisTimeRange = useMemo(() => {
    if (!selectedTemporalGroup) return null;
    return getAnalysisTimeRange(selectedTemporalGroup);
  }, [selectedTemporalGroup]);

  // Get the appropriate active date for analysis (from selected temporal group, not animation)
  const analysisActiveDate = useMemo(() => {
    if (!selectedTemporalGroup || !analysisTimeRange) {
      return activeDate; // Fallback to animation active date
    }

    // Use the start of the temporal group's time range
    return analysisTimeRange.start.toISOString();
  }, [selectedTemporalGroup, analysisTimeRange, activeDate]);

  // Get the appropriate layer for analysis (first layer from selected temporal group)
  const analysisActiveLayer = useMemo(() => {
    if (!selectedTemporalGroup || !selectedTemporalGroup.layers?.length) {
      return activeLayer; // Fallback to animation layer
    }

    // Use the first layer from the selected temporal group
    return selectedTemporalGroup.layers[0];
  }, [selectedTemporalGroup, activeLayer]);

  // Start drawing AOI
  const startDrawing = useCallback(() => {
    actions.setDrawing(true);
    actions.setAnalysisState({
      status: 'idle',
      message: 'Draw a polygon on the map to select your area of interest',
    });
  }, [actions]);

  // Handle AOI drawing complete
  const onDrawComplete = useCallback((feature) => {
    actions.setAOI(feature);
    actions.setDrawing(false);
    actions.setAnalysisState({
      status: 'idle',
      message: 'Area selected. Choose temporal resolution and run analysis.',
    });
  }, [actions]);

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
  }, [state.selectedAOI, actions]);

  // Clear AOI
  const clearAOI = useCallback(() => {
    actions.setAOI(null);
    actions.setDrawing(false); // Also stop drawing
    actions.clearAnalysis();
  }, [actions]);

  // Run analysis
  const runAnalysis = useCallback(async () => {
    if (!state.selectedAOI || !state.selectedTemporalGroup || state.isDrawing) {
      return;
    }

    // Check for required parameters
    if (!analysisActiveDate) {
      actions.setAnalysisState({
        status: 'error',
        message: 'Analysis date is required. Please select a temporal group with valid data.',
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
          activeDate: analysisActiveDate, // Use temporal group date, not animation date
          timeWindow: state.selectedTimeWindow,
          layerName: analysisActiveLayer?.name || temporalGroup.layers[0]?.name || 'Unknown Layer',
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
    analysisActiveDate,      // Use temporal group date
    analysisActiveLayer,     // Use temporal group layer
    actions
  ]);

  // Clear results but keep AOI
  const clearResults = useCallback(() => {
    actions.setAnalysisResults(null);
    actions.setAnalysisState({
      status: 'idle',
      message: state.selectedAOI
        ? 'Area selected. Choose temporal resolution and run analysis.'
        : 'Select an area to start analysis',
    });
  }, [state.selectedAOI, actions]);

  // Retry loading AOIs if failed
  const retryLoadAOIs = useCallback(async () => {
    setAoiLoadingState({ loading: true, error: null, loaded: false });
    
    try {
      const predefinedAOIs = await getDefaultPredefinedAOIs();
      actions.setPredefinedAOIs(predefinedAOIs);
      setAoiLoadingState({ loading: false, error: null, loaded: true });
    } catch (error) {
      console.error('Retry failed to load predefined AOIs:', error);
      setAoiLoadingState({ 
        loading: false, 
        error: error.message || 'Failed to load predefined areas',
        loaded: false
      });
    }
  }, [actions]);

  return {
    // State
    aoiState: state,
    aoiLoadingState, // New loading state for predefined AOIs

    // Actions
    startDrawing,
    clearAOI,
    runAnalysis,
    onDrawComplete,
    onDrawCancel,
    clearResults,
    retryLoadAOIs, // New retry function

    // Computed
    canRunAnalysis: Boolean(
      state.selectedAOI &&
        state.selectedTemporalGroup &&
        state.selectedTimeWindow &&
        analysisActiveDate &&      // Use temporal group date
        state.temporalGroups.length > 0 &&
        !state.isDrawing // Don't allow analysis while drawing
    ),
    isAnalyzing: state.analysisState.status === 'analyzing',
    hasResults: Boolean(state.analysisResults),
    isDrawing: state.isDrawing,
    
    // New computed properties for AOI loading state
    areAOIsLoading: aoiLoadingState.loading,
    aoiLoadError: aoiLoadingState.error,
    areAOIsLoaded: aoiLoadingState.loaded,

    // Expose analysis-specific dates/layers (for display purposes)
    analysisActiveDate,
    analysisActiveLayer,
    analysisTimeRange,
  };
}