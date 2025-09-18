import React, { useEffect, useState, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

const TITLE = 'RSIG Dashboard';
const DESCRIPTION = '';

function TwoDateSwitch({ dates = [], value, onChange }) {
  const two = Array.from(new Set(dates))
    .sort((a, b) => new Date(a) - new Date(b))
    .slice(0, 2);

  if (two.length < 2) return null;

  const format = (d) =>
    new Date(d).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

  return (
    <div
      style={{
        position: 'absolute',
        right: 10,
        bottom: 10,
        zIndex: 1302,
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: 10,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        Select date
      </div>
      <ToggleButtonGroup
        exclusive
        size='small'
        value={value}
        onChange={(_, v) => v && onChange(v)}
      >
        <ToggleButton value={two[0]}>{format(two[0])}</ToggleButton>
        <ToggleButton value={two[1]}>{format(two[1])}</ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}

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

  const {
    selectedStation,
    isLoading,
    error,
    showStationChart,
    hideStationChart,
    isVisible,
    chartDatasets,
  } = useStationChart();

  const [currentActiveDate, setCurrentActiveDate] = useState(null);
  const [currentActiveFeature, setCurrentActiveFeature] = useState(null);

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

  const onLayerSelect = (url) => {
    setActiveLayerUrl(url);
    const myCustomEvent = new CustomEvent('layerSelected', {
      detail: { url: url },
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(myCustomEvent);
  };

  const allActiveDatasets = useRef([]);
  const updateActiveDataset = (dataset) => {
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
        newItem.levelVisibility = { 1000: true, 500: true };
      }
      return [...currentList, newItem];
    });
  };

  const handleFrameChange = useCallback((feature) => {
    setCurrentRasterFeature(feature);
    const activeDate =
      feature?.properties?.start_datetime ||
      feature?.properties?.datetime ||
      feature?.properties?.date;
    if (activeDate) {
      setCurrentActiveDate(activeDate);
      setCurrentActiveFeature(feature);
      setActiveBottomComponent('animation');
    }
  }, []);

  const allActiveLayers = useRef([]);
  const updateActiveLayers = (layers) => {
    allActiveLayers.current = layers;
  };

  const onRecordSelect = (dataWithMetadata) => {
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

    if (datasetInfo.type === 'point-cloud') {
      const first = (actualData?.available_dates || [])[0];
      setPointCloudDateByDataset((prev) => ({
        ...prev,
        [datasetInfo.id]: first || prev[datasetInfo.id] || null,
      }));
      setActiveBottomComponent('two-date-switch');
    }

    if (datasetInfo.type === 'raster') {
      setSelectedDatasetId(datasetInfo.id);
      setActiveBottomComponent('animation');
    }

    setOpenDrawer(false);
  };

  const handleStationClick = (stationFeature) => {
    showStationChart(stationFeature);
    setActiveBottomComponent('station-chart');
  };

  const handleOpacityChange = (datasetId, newOpacity) => {
    setLayerDisplayList((currentList) =>
      currentList.map((item) =>
        item.id === datasetId ? { ...item, opacity: newOpacity } : item
      )
    );
  };

  const handleLevelVisibilityChange = (datasetId, level) => {
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
  };

  const handleLayerReorder = (reorderedLayers) => {
    setLayerDisplayList(reorderedLayers);
    allActiveDatasets.current = reorderedLayers;
    const newTopRaster = [...reorderedLayers]
      .reverse()
      .find((d) => d.type === 'raster');
    if (newTopRaster && newTopRaster.id !== selectedDatasetId) {
      setSelectedDatasetId(newTopRaster.id);
      const storedLayerData = allDatasetLayerData.current.get(newTopRaster.id);
      if (storedLayerData) {
        setSelectedRecord(newTopRaster);
        setLayerData(storedLayerData);
      }
    }
  };

  const moveLayerToTop = (datasetId) => {
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
  };

  const handleLayerRemove = (datasetId) => {
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
      const newTopRaster = [...updatedList]
        .reverse()
        .find((d) => d.type === 'raster');
      if (newTopRaster) {
        setSelectedDatasetId(newTopRaster.id);
        const storedLayerData = allDatasetLayerData.current.get(
          newTopRaster.id
        );
        if (storedLayerData) {
          setSelectedRecord(newTopRaster);
          setLayerData(storedLayerData);
        }
      } else {
        setSelectedRecord(null);
        setLayerData(null);
        setSelectedDatasetId(null);
      }
    }
  };

  const handleSpatialSubsetChange = (newSpatialSubset) => {
    setSpatialSubset(newSpatialSubset);
  };

  const hideStationChartWithPriority = useCallback(() => {
    hideStationChart();
    if (activeBottomComponent === 'station-chart') {
      if (hasResults) {
        setActiveBottomComponent('analysis-results');
      } else if (
        selectedDatasetId &&
        layerDisplayList.some((d) => d.type === 'raster')
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
    selectedDatasetId,
    selectedRecord,
    layerDisplayList,
  ]);

  const clearResultsWithPriority = useCallback(() => {
    clearResults();
    if (activeBottomComponent === 'analysis-results') {
      if (isVisible && selectedStation) {
        setActiveBottomComponent('station-chart');
      } else if (
        selectedDatasetId &&
        layerDisplayList.some((d) => d.type === 'raster')
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
    selectedDatasetId,
    selectedRecord,
    layerDisplayList,
  ]);

  useEffect(() => {
    if (hasResults) {
      setActiveBottomComponent('analysis-results');
    }
  }, [hasResults]);

  useEffect(() => {
    const isRaster =
      layerData?.galleryType === 'raster' || selectedRecord?.type === 'raster';
    if (
      isRaster &&
      Array.isArray(layerData?.features) &&
      layerData.features.length > 0
    ) {
      setCurrentRasterFeature((prev) => prev ?? layerData.features[0]);
    } else {
      setCurrentRasterFeature(null);
    }
  }, [layerData, selectedRecord]);

  const rasterDatasets = layerDisplayList.filter(
    (dataset) => dataset.type === 'raster'
  );

  const handleDatasetChange = (event) => {
    const newDatasetId = event.target.value;
    setSelectedDatasetId(newDatasetId);

    const selectedDataset = layerDisplayList.find((d) => d.id === newDatasetId);
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
  };

  useEffect(() => {
    const topRasterDataset = [...layerDisplayList]
      .reverse()
      .find((d) => d.type === 'raster');
    if (topRasterDataset && selectedDatasetId !== topRasterDataset.id) {
      setSelectedDatasetId(topRasterDataset.id);
      const storedLayerData = allDatasetLayerData.current.get(
        topRasterDataset.id
      );
      if (storedLayerData) {
        setSelectedRecord(topRasterDataset);
        setLayerData(storedLayerData);
      }
    } else if (!topRasterDataset) {
      setSelectedDatasetId(null);
    }
  }, [layerDisplayList, selectedDatasetId]);

  const aoiAsSpatialSubset = React.useMemo(() => {
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

  const titleDropdown = (
    <div className='mb-3'>
      <select
        id='dataset-select'
        value={selectedDatasetId || ''}
        onChange={handleDatasetChange}
        className='w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
      >
        <option value=''>Select a dataset...</option>
        {rasterDatasets.map((dataset) => (
          <option key={dataset.id} value={dataset.id}>
            {dataset.name}
          </option>
        ))}
      </select>
    </div>
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
              maxHeight: '95vh'
            }}
            elevation={16}
          >
            <Stack sx={{ p: 1.5, overflowY: 'auto' }} spacing={1.5}>
              <Title title={TITLE} description={DESCRIPTION} />
              <AOIControls
                layerDisplayList={layerDisplayList}
                onStartDrawing={startDrawing}
                onClearAOI={clearAOI}
                onRunAnalysis={runAnalysis}
                position='embedded'
                activeDate={currentActiveDate}
                activeLayer={selectedRecord}
              />
                  {activeBottomComponent === 'animation' &&
                selectedDatasetId &&
                rasterDatasets.length > 0 &&
                selectedRecord?.type === 'raster' &&
                selectedRecord?.id === selectedDatasetId &&
                Array.isArray(layerData?.features) &&
                layerData.features.length > 0 && (
                  <div
                    style={{
                      // position: 'absolute',
                      right: 10,
                      minWidth: 0,
                      bottom: '10px',
                      width: '100%',
                      zIndex: 1302,
                      background: 'white',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    <ItemAnimation
                      items={layerData.features}
                      onFrameChange={handleFrameChange}
                      title={titleDropdown}
                      initialAutoPlay={false}
                      speedMs={700}
                    />
                  </div>
                )}

              <RecordDetailView
                record={selectedRecord}
                allActiveDatasets={layerDisplayList}
                allActiveLayers={allActiveLayers.current}
                onLayerOpacityChange={handleOpacityChange}
                onLevelVisibilityChange={handleLevelVisibilityChange}
                onLayerRemove={handleLayerRemove}
                onLayerReorder={handleLayerReorder}
              />
            </Stack>
          </Paper>
          <MapControls
            openDrawer={openDrawer}
            setOpenDrawer={setOpenDrawer}
          />
          {activeBottomComponent === 'two-date-switch' &&
            selectedRecord?.type === 'point-cloud' &&
            Array.isArray(layerData?.available_dates) &&
            layerData.available_dates.length > 0 && (
              <TwoDateSwitch
                dates={layerData.available_dates}
                value={
                  pointCloudDateByDataset[selectedRecord.id] ||
                  layerData.available_dates[0]
                }
                onChange={(next) => {
                  setPointCloudDateByDataset((prev) => ({
                    ...prev,
                    [selectedRecord.id]: next,
                  }));
                }}
              />
            )}
          <DeckGlLayerManager
            activeLayerUrl={activeLayerUrl}
            updateActiveLayers={updateActiveLayers}
            layerData={
              layerData?.galleryType === 'raster' ||
              selectedRecord?.type === 'raster'
                ? {
                    ...layerData,
                    features: currentRasterFeature
                      ? [currentRasterFeature]
                      : Array.isArray(layerData?.features) &&
                          layerData.features.length > 0
                        ? [layerData.features[0]]
                        : [],
                  }
                : layerData
            }
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
          />
          {activeBottomComponent === 'station-chart' && isVisible && selectedStation && (
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
                          <CloseButton handleClose={hideStationChartWithPriority} />
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
                        No data available for this station in the selected time range.
                      </p>
                      <CloseButton handleClose={hideStationChartWithPriority} />
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
          <AnalysisResults onClose={clearResultsWithPriority} position='bottom' />
        )}
      </div>
      {loadingData && <LoadingSpinner />}
    </Box>
  );
}