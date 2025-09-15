// contexts/aoiContext.js
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
} from 'react';

// Initial state
const initialState = {
  selectedAOI: null,
  predefinedAOIs: [],
  isDrawing: false,
  analysisState: {
    status: 'idle', // idle, grouping, analyzing, complete, error
    message: 'Select an area to start analysis',
    progress: 0,
    error: null,
  },
  analysisResults: null,
  temporalGroups: [],
  selectedTemporalGroup: null,
};

// Reducer
function aoiReducer(state, action) {
  switch (action.type) {
    case 'SET_AOI':
      return {
        ...state,
        selectedAOI: action.payload,
        analysisResults: null, // Clear previous results
      };

    case 'SET_DRAWING':
      return {
        ...state,
        isDrawing: action.payload,
      };

    case 'SET_PREDEFINED_AOIS':
      return {
        ...state,
        predefinedAOIs: action.payload,
      };

    case 'SET_TEMPORAL_GROUPS':
      return {
        ...state,
        temporalGroups: action.payload,
        selectedTemporalGroup:
          action.payload.length === 1 ? action.payload[0].id : null,
      };

    case 'SELECT_TEMPORAL_GROUP':
      return {
        ...state,
        selectedTemporalGroup: action.payload,
      };

    case 'SET_ANALYSIS_STATE':
      return {
        ...state,
        analysisState: {
          ...state.analysisState,
          ...action.payload,
        },
      };

    case 'SET_ANALYSIS_RESULTS':
      return {
        ...state,
        analysisResults: action.payload,
        analysisState: action.payload
          ? { status: 'complete', message: 'Analysis complete', progress: 100 }
          : state.analysisState,
      };

    case 'CLEAR_ANALYSIS':
      return {
        ...state,
        analysisResults: null,
        analysisState: {
          status: 'idle',
          message: 'Select an area to start analysis',
          progress: 0,
          error: null,
        },
      };

    default:
      return state;
  }
}

// Context
const AOIContext = createContext(null);

// Provider
export function AOIProvider({ children }) {
  const [state, dispatch] = useReducer(aoiReducer, initialState);

  // Memoize all actions to prevent recreation
  const actions = useMemo(
    () => ({
      setAOI: (aoi) => {
        dispatch({ type: 'SET_AOI', payload: aoi });
      },

      setDrawing: (drawing) => {
        dispatch({ type: 'SET_DRAWING', payload: drawing });
      },

      setPredefinedAOIs: (aois) => {
        dispatch({ type: 'SET_PREDEFINED_AOIS', payload: aois });
      },

      setTemporalGroups: (groups) => {
        dispatch({ type: 'SET_TEMPORAL_GROUPS', payload: groups });
      },

      selectTemporalGroup: (groupId) => {
        dispatch({ type: 'SELECT_TEMPORAL_GROUP', payload: groupId });
      },

      setAnalysisState: (analysisState) => {
        dispatch({ type: 'SET_ANALYSIS_STATE', payload: analysisState });
      },

      setAnalysisResults: (results) => {
        dispatch({ type: 'SET_ANALYSIS_RESULTS', payload: results });
      },

      clearAnalysis: () => {
        dispatch({ type: 'CLEAR_ANALYSIS' });
      },
    }),
    []
  ); // Empty dependency array - actions never change

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      state,
      actions,
    }),
    [state, actions]
  );

  return (
    <AOIContext.Provider value={contextValue}>{children}</AOIContext.Provider>
  );
}

// Hook
export function useAOI() {
  const context = useContext(AOIContext);
  if (!context) {
    throw new Error('useAOI must be used within an AOIProvider');
  }
  return context;
}
