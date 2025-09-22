import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import Stack from '@mui/material/Stack';
import {
  MainMap,
  LoadingSpinner,
  PersistentDrawerRight,
  Title,
  MapControls,
} from '@components';
import { DeckGlLayerManager } from '../../components/map/deckLayer';
import { RecordDetailView } from '@components/detailView';
import { ChartProvider } from '../../context/chartContext';
import { CloseButton } from '@components/chartComponents';
import { useStationChart } from '../../hooks/useStationChart';
import './index.css';
import { LineChart } from '../../components/lineChart';
import ItemAnimation from '../../components/ui/itemAnimation';
import bbox from '@turf/bbox';
import { useAOIIntegration } from '../../hooks/useAOIIntegration';
import { AOIControls } from '../../components/aoi/AOIControls';
import { AOILayer } from '../../components/aoi/AOILayer';
import { AnalysisResults } from '../../components/aoi/AnalysisResults';

// Import our new animation utilities
import {
  shouldShowAnimation,
  getAnimationFeatures,
  getAnimationSpeed,
} from '../../utils/animationUtils';

const TITLE = 'RSIG Dashboard';
const DESCRIPTION = '';

// Collapsible Section Component
const CollapsibleSection = ({
  title,
  children,
  defaultExpanded = true,
  sx = {},
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Box sx={{ ...sx }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          py: 1,
          '&:hover': { backgroundColor: 'action.hover' },
          borderRadius: 1,
          px: 1,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton size='small' sx={{ p: 0.5 }}>
          {expanded ? (
            <ExpandLessIcon fontSize='small' />
          ) : (
            <ExpandMoreIcon fontSize='small' />
          )}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ pt: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

export function DashboardContent({ loadingData }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(true);
  const [activeLayerUrl, setActiveLayerUrl] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [layerData, setLayerData] = useState(null);
  const [layerDisplayList, setLayerDisplayList] = useState([]);
  const [pointCloudDateByDataset, setPointCloudDateByDataset] = useState({});
  const [spatialSubset, setSpatialSubset] = useState(null);
  const [datasetToRemove, setDatasetToRemove] = useState(null);

  const [activeBottomComponent, setActiveBottomComponent] = useState(null);

  // Animation state
  const [currentActiveDate, setCurrentActiveDate] = useState(null);
  const [currentActiveFeature, setCurrentActiveFeature] = useState(null);
  const [animationFeatures, setAnimationFeatures] = useState([]);

  const {
    selectedStation,
    isLoading,
    error,
    showStationChart,
    hideStationChart,
    isVisible,
    chartDatasets,
  } = useStationChart();

  const {
    aoiState,
    startDrawing,
    clearAOI,
    runAnalysis,
    onDrawComplete,
    onDrawCancel,
    clearResults,
    hasResults,
  } = useAOIIntegration(layerDisplayList, {
    activeDate: currentActiveDate,
    activeLayer: selectedRecord,
  });

  const [currentRasterFeature, setCurrentRasterFeature] = useState(null);
  const allDatasetLayerData = useRef(new Map());
  const allActiveLayers = useRef([]);
  const allActiveDatasets = useRef([]);

  // Memoize the updateActiveLayers callback to prevent infinite re-renders
  const updateActiveLayers = useCallback((layers) => {
    allActiveLayers.current = layers;
  }, []);

  const onLayerSelect = useCallback((url) => {
    setActiveLayerUrl(url);
    const myCustomEvent = new CustomEvent('layerSelected', {
      detail: { url: url },
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(myCustomEvent);
  }, []);

  const updateActiveDataset = useCallback((dataset) => {
    if (!dataset) return;

    const existingIndex = allActiveDatasets.current.findIndex(
      (d) => d.id === dataset.id
    );
    if (existingIndex !== -1) {
      allActiveDatasets.current[existingIndex] = dataset;
    } else {
      allActiveDatasets.current.push(dataset);
    }

    setLayerDisplayList((currentList) => {
      const existingDisplayIndex = currentList.findIndex(
        (d) => d.id === dataset.id
      );
      if (existingDisplayIndex !== -1) {
        const updatedList = [...currentList];
        const existingItem = updatedList[existingDisplayIndex];
        updatedList[existingDisplayIndex] = {
          ...dataset,
          opacity: existingItem.opacity,
          levelVisibility: existingItem.levelVisibility,
        };
        return updatedList;
      }

      const newItem = { ...dataset, opacity: 100 };
      if (newItem.type === 'netcdf-2d') {
        newItem.levelVisibility = {
          1000: true,
          850: false,
          550: false,
          250: false,
        };
      }
      return [...currentList, newItem];
    });
  }, []);

  const handleFrameChange = useCallback(
    (feature) => {
      // Handle different dataset types
      if (selectedRecord?.type === 'raster') {
        setCurrentRasterFeature(feature);
      }

      // Set active date and feature for all animatable datasets
      const activeDate =
        feature?.properties?.start_datetime ||
        feature?.properties?.datetime ||
        feature?.properties?.date;

      if (activeDate) {
        setCurrentActiveDate(activeDate);
        setCurrentActiveFeature(feature);
      }
    },
    [selectedRecord?.type]
  );

  const onRecordSelect = useCallback((dataWithMetadata) => {
    let datasetInfo, actualData;
    if (dataWithMetadata.datasetInfo && dataWithMetadata.galleryType) {
      datasetInfo = dataWithMetadata.datasetInfo;
      actualData = { ...dataWithMetadata, datasetInfo: undefined };
    } else {
      datasetInfo = dataWithMetadata;
      actualData = dataWithMetadata;
    }

    allDatasetLayerData.current.set(datasetInfo.id, actualData);
    setSelectedRecord(datasetInfo);
    setLayerData(actualData);

    // Generate animation features for animatable datasets
    if (shouldShowAnimation(datasetInfo, actualData)) {
      const features = getAnimationFeatures(datasetInfo, actualData);
      setAnimationFeatures(features);

      // Set initial frame
      if (features.length > 0) {
        const initialFeature = features[0];
        const initialDate =
          initialFeature?.properties?.datetime ||
          initialFeature?.properties?.start_datetime ||
          initialFeature?.properties?.date;

        if (initialDate) {
          setCurrentActiveDate(initialDate);
          setCurrentActiveFeature(initialFeature);
        }

        // For raster datasets, also set the raster feature
        if (datasetInfo.type === 'raster') {
          setCurrentRasterFeature(initialFeature);
        }
      }

      setActiveBottomComponent('animation');
    }

    // Handle point cloud datasets
    if (datasetInfo.type === 'point-cloud') {
      const first = (actualData?.available_dates || [])[0];
      setPointCloudDateByDataset((prev) => ({
        ...prev,
        [datasetInfo.id]: first || prev[datasetInfo.id] || null,
      }));
      setActiveBottomComponent('two-date-switch');
    }

    // Update selected dataset ID for raster datasets
    if (datasetInfo.type === 'raster') {
      setSelectedDatasetId(datasetInfo.id);
    }

    setOpenDrawer(false);
  }, []);

  const handleStationClick = useCallback(
    (stationFeature) => {
      showStationChart(stationFeature);
      setActiveBottomComponent('station-chart');
    },
    [showStationChart]
  );

  const handleOpacityChange = useCallback((datasetId, newOpacity) => {
    setLayerDisplayList((currentList) =>
      currentList.map((item) =>
        item.id === datasetId ? { ...item, opacity: newOpacity } : item
      )
    );
  }, []);

  const handleLevelVisibilityChange = useCallback((datasetId, level) => {
    setLayerDisplayList((currentList) =>
      currentList.map((item) => {
        if (item.id === datasetId && item.levelVisibility) {
          return {
            ...item,
            levelVisibility: {
              ...item.levelVisibility,
              [level]: !item.levelVisibility[level],
            },
          };
        }
        return item;
      })
    );
  }, []);

  const handleLayerReorder = useCallback((reorderedLayers) => {
    setLayerDisplayList(reorderedLayers);
    allActiveDatasets.current = reorderedLayers;

    // Update the top animatable dataset
    const newTopAnimatable = [...reorderedLayers]
      .reverse()
      .find((d) =>
        shouldShowAnimation(d, allDatasetLayerData.current.get(d.id))
      );

    if (newTopAnimatable) {
      setSelectedDatasetId(newTopAnimatable.id);
      const storedLayerData = allDatasetLayerData.current.get(
        newTopAnimatable.id
      );
      if (storedLayerData) {
        setSelectedRecord(newTopAnimatable);
        setLayerData(storedLayerData);
      }
    }
  }, []);

  const moveLayerToTop = useCallback((datasetId) => {
    setLayerDisplayList((currentList) => {
      const layerIndex = currentList.findIndex(
        (layer) => layer.id === datasetId
      );
      if (layerIndex === -1) return currentList;
      const reorderedList = [...currentList];
      const [movedLayer] = reorderedList.splice(layerIndex, 1);
      reorderedList.push(movedLayer);
      return reorderedList;
    });
  }, []);

  const handleLayerRemove = useCallback(
    (datasetId) => {
      const updatedList = layerDisplayList.filter(
        (item) => item.id !== datasetId
      );
      setLayerDisplayList(updatedList);
      setDatasetToRemove(datasetId);

      allActiveDatasets.current = allActiveDatasets.current.filter(
        (item) => item.id !== datasetId
      );
      allDatasetLayerData.current.delete(datasetId);

      if (selectedRecord?.id === datasetId) {
        // Find next animatable dataset
        const newTopAnimatable = [...updatedList]
          .reverse()
          .find((d) =>
            shouldShowAnimation(d, allDatasetLayerData.current.get(d.id))
          );

        if (newTopAnimatable) {
          setSelectedDatasetId(newTopAnimatable.id);
          const storedLayerData = allDatasetLayerData.current.get(
            newTopAnimatable.id
          );
          if (storedLayerData) {
            setSelectedRecord(newTopAnimatable);
            setLayerData(storedLayerData);
          }
        } else {
          setSelectedRecord(null);
          setLayerData(null);
          setSelectedDatasetId(null);
          setAnimationFeatures([]);
        }
      }
    },
    [layerDisplayList, selectedRecord?.id]
  );

  const handleSpatialSubsetChange = useCallback((newSpatialSubset) => {
    setSpatialSubset(newSpatialSubset);
  }, []);

  // Priority management for bottom components
  const hideStationChartWithPriority = useCallback(() => {
    hideStationChart();
    if (activeBottomComponent === 'station-chart') {
      if (hasResults) {
        setActiveBottomComponent('analysis-results');
      } else if (
        selectedRecord &&
        shouldShowAnimation(selectedRecord, layerData)
      ) {
        setActiveBottomComponent('animation');
      } else if (selectedRecord?.type === 'point-cloud') {
        setActiveBottomComponent('two-date-switch');
      } else {
        setActiveBottomComponent(null);
      }
    }
  }, [
    hideStationChart,
    activeBottomComponent,
    hasResults,
    selectedRecord,
    layerData,
  ]);

  const clearResultsWithPriority = useCallback(() => {
    clearResults();
    if (activeBottomComponent === 'analysis-results') {
      if (isVisible && selectedStation) {
        setActiveBottomComponent('station-chart');
      } else if (
        selectedRecord &&
        shouldShowAnimation(selectedRecord, layerData)
      ) {
        setActiveBottomComponent('animation');
      } else if (selectedRecord?.type === 'point-cloud') {
        setActiveBottomComponent('two-date-switch');
      } else {
        setActiveBottomComponent(null);
      }
    }
  }, [
    clearResults,
    activeBottomComponent,
    isVisible,
    selectedStation,
    selectedRecord,
    layerData,
  ]);

  // Auto-select top animatable dataset - FIX: Remove selectedDatasetId from dependencies
  useEffect(() => {
    const topAnimatableDataset = [...layerDisplayList]
      .reverse()
      .find((d) =>
        shouldShowAnimation(d, allDatasetLayerData.current.get(d.id))
      );

    // Only update if there's actually a change needed
    if (topAnimatableDataset && selectedDatasetId !== topAnimatableDataset.id) {
      setSelectedDatasetId(topAnimatableDataset.id);
      const storedLayerData = allDatasetLayerData.current.get(
        topAnimatableDataset.id
      );
      if (storedLayerData) {
        setSelectedRecord(topAnimatableDataset);
        setLayerData(storedLayerData);
      }
    } else if (!topAnimatableDataset && selectedDatasetId !== null) {
      setSelectedDatasetId(null);
    }
  }, [layerDisplayList]); // Removed selectedDatasetId from dependencies

  useEffect(() => {
    if (hasResults) {
      setActiveBottomComponent('analysis-results');
    }
  }, [hasResults]);

  // Update animation features when layer data changes - FIX: Remove currentActiveFeature dependency
  useEffect(() => {
    if (selectedRecord && shouldShowAnimation(selectedRecord, layerData)) {
      const features = getAnimationFeatures(selectedRecord, layerData);
      setAnimationFeatures(features);

      // Only set initial state if we don't have features yet
      if (features.length > 0 && animationFeatures.length === 0) {
        const initialFeature = features[0];
        const initialDate =
          initialFeature?.properties?.datetime ||
          initialFeature?.properties?.start_datetime ||
          initialFeature?.properties?.date;

        if (initialDate) {
          setCurrentActiveDate(initialDate);
          setCurrentActiveFeature(initialFeature);
        }

        if (selectedRecord.type === 'raster') {
          setCurrentRasterFeature(initialFeature);
        }
      }
    } else {
      setAnimationFeatures([]);
    }
  }, [selectedRecord, layerData, animationFeatures.length]); // Changed dependency

  // Get animatable datasets for dropdown - Memoize to prevent recreations
  const animatableDatasets = useMemo(() => {
    return layerDisplayList.filter((dataset) =>
      shouldShowAnimation(dataset, allDatasetLayerData.current.get(dataset.id))
    );
  }, [layerDisplayList]);

  const handleDatasetChange = useCallback(
    (event) => {
      const newDatasetId = event.target.value;
      setSelectedDatasetId(newDatasetId);

      const selectedDataset = layerDisplayList.find(
        (d) => d.id === newDatasetId
      );
      if (selectedDataset) {
        setSelectedRecord(selectedDataset);
        const storedLayerData = allDatasetLayerData.current.get(newDatasetId);
        if (storedLayerData) {
          setLayerData(storedLayerData);
        } else {
          setLayerData(selectedDataset);
        }
        moveLayerToTop(newDatasetId);
        setActiveBottomComponent('animation');
      }
    },
    [layerDisplayList, moveLayerToTop]
  );

  const aoiAsSpatialSubset = useMemo(() => {
    if (!aoiState.selectedAOI) return spatialSubset;
    try {
      const bounds = bbox(aoiState.selectedAOI);
      return {
        west: bounds[0],
        south: bounds[1],
        east: bounds[2],
        north: bounds[3],
      };
    } catch (error) {
      return spatialSubset;
    }
  }, [aoiState.selectedAOI, spatialSubset]);

  // Memoize the layer data passed to DeckGlLayerManager
  const deckLayerData = useMemo(() => {
    if (selectedRecord?.type === 'raster') {
      return {
        ...layerData,
        features: currentRasterFeature
          ? [currentRasterFeature]
          : Array.isArray(layerData?.features) && layerData.features.length > 0
            ? [layerData.features[0]]
            : [],
      };
    } else if (selectedRecord?.type === 'netcdf-2d' && currentActiveFeature) {
      return {
        ...layerData,
        datetime: currentActiveDate,
        activeFeature: currentActiveFeature,
      };
    }
    return layerData;
  }, [
    selectedRecord,
    layerData,
    currentRasterFeature,
    currentActiveFeature,
    currentActiveDate,
  ]);

  const titleDropdown = useMemo(
    () => (
      <div className='mb-3'>
        <select
          id='dataset-select'
          value={selectedDatasetId || ''}
          onChange={handleDatasetChange}
          className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        >
          <option value=''>Select a dataset...</option>
          {animatableDatasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
        </select>
      </div>
    ),
    [selectedDatasetId, handleDatasetChange, animatableDatasets]
  );

  return (
    <Box className='fullSize'>
      <IconButton
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        sx={{
          position: 'absolute',
          top: '20px',
          left: isSidebarOpen ? '300px' : '20px',
          zIndex: 1301,
          backgroundColor: 'white',
          transition: 'left 0.2s ease-in-out',
          '&:hover': { backgroundColor: 'whitesmoke' },
        }}
      >
        {isSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
      <div id='dashboard-map-container'>
        <MainMap>
          <AOILayer
            aoi={aoiState.selectedAOI}
            isDrawing={aoiState.isDrawing}
            onDrawComplete={onDrawComplete}
            onDrawCancel={onDrawCancel}
          />
          <Paper
            className='title-container'
            sx={{
              width: '350px',
              transition: 'transform 0.2s ease-in-out, width 0.2s ease-in-out',
              transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
              display: 'flex',
              flexDirection: 'column',
              height: 'fit-content',
              maxHeight: '95vh',
            }}
            elevation={16}
          >
            <Stack sx={{ p: 1.5, overflowY: 'auto' }} spacing={1.5}>
              {/* Dashboard Title Section */}
              <CollapsibleSection title='Dashboard' defaultExpanded={true}>
                {/* <Title title={TITLE} description={DESCRIPTION} /> */}
              </CollapsibleSection>

              {/* AOI Controls Section */}
              <CollapsibleSection
                title='Area of Interest'
                defaultExpanded={false}
              >
                <AOIControls
                  layerDisplayList={layerDisplayList}
                  onStartDrawing={startDrawing}
                  onClearAOI={clearAOI}
                  onRunAnalysis={runAnalysis}
                  position='embedded'
                  activeDate={currentActiveDate}
                  activeLayer={selectedRecord}
                />
              </CollapsibleSection>

              {/* Animation Controls Section */}
              {activeBottomComponent === 'animation' &&
                selectedDatasetId &&
                selectedRecord &&
                shouldShowAnimation(selectedRecord, layerData) &&
                animationFeatures.length > 0 && (
                  <CollapsibleSection
                    title='Animation Controls'
                    defaultExpanded={false}
                  >
                    <div
                      style={{
                        width: '100%',
                        background: 'white',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      }}
                    >
                      <ItemAnimation
                        items={animationFeatures}
                        onFrameChange={handleFrameChange}
                        title={titleDropdown}
                        initialAutoPlay={false}
                        speedMs={getAnimationSpeed(
                          selectedRecord?.time_interval
                        )}
                      />
                    </div>
                  </CollapsibleSection>
                )}

              {/* Active Datasets Section */}
              {layerDisplayList.length > 0 && (
                <CollapsibleSection
                  title='Active Datasets'
                  defaultExpanded={true}
                >
                  <RecordDetailView
                    record={selectedRecord}
                    allActiveDatasets={layerDisplayList}
                    allActiveLayers={allActiveLayers.current}
                    onLayerOpacityChange={handleOpacityChange}
                    onLevelVisibilityChange={handleLevelVisibilityChange}
                    onLayerRemove={handleLayerRemove}
                    onLayerReorder={handleLayerReorder}
                  />
                </CollapsibleSection>
              )}
            </Stack>
          </Paper>
          <MapControls openDrawer={openDrawer} setOpenDrawer={setOpenDrawer} />

          {/* DeckGL Layer Manager with enhanced data handling */}
          <DeckGlLayerManager
            activeLayerUrl={activeLayerUrl}
            updateActiveLayers={updateActiveLayers}
            layerData={deckLayerData}
            galleryType={layerData?.galleryType || selectedRecord?.type}
            datasetId={selectedRecord?.id}
            onStationClick={handleStationClick}
            visible={true}
            layerOpacityList={layerDisplayList}
            spatialSubset={aoiAsSpatialSubset}
            allActiveDatasets={layerDisplayList}
            pointCloudDate={
              selectedRecord?.type === 'point-cloud'
                ? pointCloudDateByDataset[selectedRecord.id] ||
                  layerData?.available_dates?.[0] ||
                  null
                : null
            }
            aoiGeometry={aoiState.selectedAOI}
            isDrawingAOI={aoiState.isDrawing}
            datasetToRemove={datasetToRemove}
            // Pass animation context
            currentActiveDate={currentActiveDate}
            currentActiveFeature={currentActiveFeature}
          />

          {/* Station chart component */}
          {activeBottomComponent === 'station-chart' &&
            isVisible &&
            selectedStation && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  width: 'calc(100% - 20px)',
                  height: '300px',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  zIndex: 1000,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {isLoading && <LoadingSpinner />}
                {error && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'red',
                    }}
                  >
                    <p>Error loading data: {error.message}</p>
                    <CloseButton handleClose={hideStationChartWithPriority} />
                  </div>
                )}
                {!isLoading && !error && (
                  <>
                    {chartDatasets && chartDatasets.length > 0 ? (
                      <ChartProvider>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px 8px',
                            borderBottom: '1px solid #eee',
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              fontSize: '20px',
                              fontWeight: '600',
                            }}
                          >
                            {`Station ${selectedStation.station_code} - ${selectedStation.city || 'Unknown'}`}
                          </h3>
                          <div style={{ zIndex: '10000' }}>
                            <CloseButton
                              handleClose={hideStationChartWithPriority}
                            />
                          </div>
                        </div>
                        <div style={{ flex: 1, padding: '16px' }}>
                          <LineChart datasets={chartDatasets} />
                        </div>
                      </ChartProvider>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                        }}
                      >
                        <p>
                          No data available for this station in the selected
                          time range.
                        </p>
                        <CloseButton
                          handleClose={hideStationChartWithPriority}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
        </MainMap>
        <PersistentDrawerRight
          open={openDrawer}
          setOpen={setOpenDrawer}
          onLayerSelect={onLayerSelect}
          onRecordSelect={onRecordSelect}
          updateActiveDataset={updateActiveDataset}
        />
        {activeBottomComponent === 'analysis-results' && hasResults && (
          <AnalysisResults
            onClose={clearResultsWithPriority}
            position='bottom'
          />
        )}
      </div>
      {loadingData && <LoadingSpinner />}
    </Box>
  );
}
