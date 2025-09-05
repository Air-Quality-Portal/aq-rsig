/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Stack from '@mui/material/Stack';
import {
  MainMap,
  LoadingSpinner,
  PersistentDrawerRight,
  Title,
  MapControls,
  MapZoom,
  Search,
  FilterByDate,
} from '@components';

import { DeckGlLayerManager } from '../../components/map/deckLayer';
import { RecordDetailView } from '@components/detailView';
import SpatialSubsetManager from '@components/ui/spatialSubsetManager';

import { ChartProvider } from '../../context/chartContext';
import { CloseButton, ZoomResetTool } from '@components/chartComponents';
import { useStationChart } from '../../hooks/useStationChart';

import './index.css';
import { LineChart } from '../../components/lineChart';
import ItemAnimation from '../../components/ui/itemAnimation';

const TITLE = 'RSIG Dashboard';
const DESCRIPTION = '';

export function Dashboard({ zoomLocation, zoomLevel, loadingData }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(true);
  const [activeLayerUrl, setActiveLayerUrl] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [layerData, setLayerData] = useState(null);
  const [layerDisplayList, setLayerDisplayList] = useState([]);
  const {
    selectedStation,
    isLoading,
    error,
    showStationChart,
    hideStationChart,
    isVisible,
    chartDatasets,
  } = useStationChart();

  const [currentRasterFeature, setCurrentRasterFeature] = useState(null);

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

    // --- ADDED FOR OPACITY/REMOVE FEATURE ---
    // This new logic updates our new state array to keep it in sync with the ref.
    // This is what will cause the RecordDetailView to re-render when a new layer is added.
    setLayerDisplayList((currentList) => {
      const existingDisplayIndex = currentList.findIndex(
        (d) => d.id === dataset.id
      );
      if (existingDisplayIndex !== -1) {
        // If the item is already in our list, update its details
        // but preserve its existing opacity.
        const updatedList = [...currentList];
        updatedList[existingDisplayIndex] = {
          ...dataset, // new metadata
          opacity: updatedList[existingDisplayIndex].opacity, // keep old opacity
        };
        return updatedList;
      }
      return [...currentList, { ...dataset, opacity: 100 }];
    });
  };

  const allActiveLayers = useRef([]);
  const updateActiveLayers = (layers) => {
    allActiveLayers.current = layers;
  };

  const onRecordSelect = (dataWithMetadata) => {
    if (dataWithMetadata.datasetInfo && dataWithMetadata.galleryType) {
      const datasetInfo = dataWithMetadata.datasetInfo;
      const actualData = { ...dataWithMetadata, datasetInfo: undefined };
      setSelectedRecord(datasetInfo);
      setLayerData(actualData);
    } else {
      setSelectedRecord(dataWithMetadata);
      setLayerData(dataWithMetadata);
    }
    setOpenDrawer(false);
  };

  const handleStationClick = (stationFeature) => {
    showStationChart(stationFeature);
  };

  const handleOpacityChange = (datasetId, newOpacity) => {
    setLayerDisplayList((currentList) =>
      currentList.map((item) =>
        item.id === datasetId ? { ...item, opacity: newOpacity } : item
      )
    );
  };

  const handleLayerRemove = (datasetId) => {
    setLayerDisplayList((currentList) =>
      currentList.filter((item) => item.id !== datasetId)
    );
    allActiveDatasets.current = allActiveDatasets.current.filter(
      (item) => item.id !== datasetId
    );
    if (selectedRecord?.id === datasetId) {
      setSelectedRecord(null);
      setLayerData(null);
    }
  };

  useEffect(() => {
    fetch('/plugins/pointcloud/events.js')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then((eventsCode) => {
        eval(eventsCode);
      })
      .catch((err) => {
        console.error('Failed to load or eval events.js:', err);
      });
  }, []);

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

  return (
    <Box className='fullSize'>
      <IconButton
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        sx={{
          position: 'absolute',
          top: '20px',
          left: isSidebarOpen ? '320px' : '20px',
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
          <Paper
            className='title-container'
            sx={{
              width: '310px',
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
              <Title title={TITLE} description={DESCRIPTION} />
              <Search vizItems={[]} onSelectedVizItemSearch={console.log('')} />
              <FilterByDate vizItems={[]} onFilteredVizItems={[]} />
              <SpatialSubsetManager />

              <RecordDetailView
                record={selectedRecord}
                allActiveDatasets={layerDisplayList}
                allActiveLayers={allActiveLayers.current}
                onClose={console.log('')}
                onLayerOpacityChange={handleOpacityChange}
                onLayerRemove={handleLayerRemove}
              />
            </Stack>
          </Paper>

          <MapControls
            openDrawer={openDrawer}
            setOpenDrawer={setOpenDrawer}
            handleResetHome={console.log('')}
          />
          {(layerData?.galleryType === 'raster' ||
            selectedRecord?.type === 'raster') &&
            Array.isArray(layerData?.features) &&
            layerData.features.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: 10,
                  width: 420,
                  zIndex: 1302,
                  background: 'white',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              >
                <ItemAnimation
                  items={layerData.features}
                  onFrameChange={(feature) => setCurrentRasterFeature(feature)}
                  title='Dataset Timeline'
                  initialAutoPlay={false}
                  speedMs={700}
                />
              </div>
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
          />

          {isVisible && selectedStation && (
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
                  <CloseButton handleClose={hideStationChart} />
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
                          <CloseButton handleClose={hideStationChart} />
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
                        No data available for this station in the selected time
                        range.
                      </p>
                      <CloseButton handleClose={hideStationChart} />
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
      </div>
      {loadingData && <LoadingSpinner />}
    </Box>
  );
}
