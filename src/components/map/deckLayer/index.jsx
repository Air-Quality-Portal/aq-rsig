import React, { useEffect, useState } from 'react';
import { IconLayer } from '@deck.gl/layers';
import { Tile3DLayer, TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { GeoJsonLayer, ArcLayer } from '@deck.gl/layers';
import { Matrix4 } from '@math.gl/core';
import { useMapbox } from '../../../context/mapContext';
import {
  getLayerId,
  removeDatasetLayers,
  calculateGeoJSONBounds,
  zoomToBounds,
  buildRasterTileUrl,
  buildNetCDF2DTileUrl,
} from './utils';

function handleStationClick(clickedFeature, onStationClick) {
  onStationClick(clickedFeature);
}

// NEW: Utility function to check if a point is within spatial bounds
const isPointInBounds = (lng, lat, bounds) => {
  if (!bounds) return true;
  return (
    lng >= bounds.west &&
    lng <= bounds.east &&
    lat >= bounds.south &&
    lat <= bounds.north
  );
};

const tileIntersectsBounds = (west, south, east, north, bounds) => {
  if (!bounds) return true;
  return (
    west <= bounds.east &&
    east >= bounds.west &&
    south <= bounds.north &&
    north >= bounds.south
  );
};

const addSpatialBoundsToUrl = (baseUrl, bounds) => {
  if (!bounds) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set(
    'bbox',
    `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`
  );
  return url.toString();
};

const getDatasetMetadata = (datasetId, allActiveDatasets) => {
  const dataset = allActiveDatasets.find((d) => d.id === datasetId);
  return dataset || {};
};

const formatRescaleValues = (rescaleValues) => {
  if (
    !rescaleValues ||
    !Array.isArray(rescaleValues) ||
    rescaleValues.length !== 2
  ) {
    return '10, 50'; // Default fallback
  }
  return `${rescaleValues[0]}, ${rescaleValues[1]}`;
};

export function DeckGlLayerManager({
  activeLayerUrl,
  layerData,
  updateActiveLayers,
  galleryType,
  datasetId,
  onStationClick,
  visible = true,
  onLayersUpdate,
  layerOpacityList = [],
  spatialSubset,
  allActiveDatasets = [],
}) {
  const [managedLayers, setManagedLayers] = useState({});
  const mapContext = useMapbox();
  const deckOverlay = mapContext?.deckOverlay;

  updateActiveLayers(managedLayers);

  useEffect(() => {
    window.Tile3DLayer = Tile3DLayer;
    window.GeoJsonLayer = GeoJsonLayer;
    window.ArcLayer = ArcLayer;
  }, []);

  // Function to get layers in the correct order based on layerOpacityList
  const getOrderedLayers = () => {
    const orderedLayers = [];

    // Process layers in the order they appear in layerOpacityList
    // Items later in the array will render on top
    layerOpacityList.forEach((layerConfig) => {
      const layersForDataset = managedLayers[layerConfig.id];
      if (layersForDataset && Array.isArray(layersForDataset)) {
        orderedLayers.push(...layersForDataset);
      }
    });

    return orderedLayers;
  };

  // Separate useEffect for cleanup to avoid infinite loop
  useEffect(() => {
    // Clean up managed layers for datasets that are no longer in layerOpacityList
    const activeDatasetIds = new Set(layerOpacityList.map((layer) => layer.id));

    setManagedLayers((prevManaged) => {
      const shouldCleanup = Object.keys(prevManaged).some(
        (datasetId) => !activeDatasetIds.has(datasetId)
      );

      if (!shouldCleanup) return prevManaged; // No cleanup needed

      const cleanedManaged = {};
      Object.keys(prevManaged).forEach((datasetId) => {
        if (activeDatasetIds.has(datasetId)) {
          cleanedManaged[datasetId] = prevManaged[datasetId];
        } else {
          console.log(`Cleaning up layers for removed dataset: ${datasetId}`);
        }
      });

      return cleanedManaged;
    });
  }, [layerOpacityList]); // Only depend on layerOpacityList

  useEffect(() => {
    // Update deck.gl with ordered layers
    const allLayers = getOrderedLayers();

    if (deckOverlay) {
      deckOverlay.setProps({ layers: allLayers });
    }
    if (onLayersUpdate) {
      onLayersUpdate(allLayers);
    }
  }, [managedLayers, deckOverlay, onLayersUpdate, layerOpacityList]);

  useEffect(() => {
    if (!datasetId) return;

    if (!layerData) {
      setManagedLayers((prevManaged) => {
        if (prevManaged.hasOwnProperty(datasetId)) {
          const { [datasetId]: _, ...rest } = prevManaged;
          console.log(`Clearing all layers for dataset: ${datasetId}`);
          return rest;
        }
        return prevManaged;
      });
      return;
    }

    // NEW: Get dataset metadata for colormap and rescale values
    const datasetMetadata = getDatasetMetadata(datasetId, allActiveDatasets);
    console.log('Dataset metadata:', datasetMetadata);

    const currentLayerInfo = layerOpacityList.find(
      (layer) => layer.id === datasetId
    );
    const dynamicOpacity = currentLayerInfo
      ? currentLayerInfo.opacity / 100
      : 1.0;

    let newLayers = [];
    switch (galleryType) {
      //CALIPSO
      case 'point-cloud': {
        // Add spatial bounds to point cloud URL if available
        const spatialAwareUrl = spatialSubset
          ? addSpatialBoundsToUrl(activeLayerUrl, spatialSubset)
          : activeLayerUrl;

        const pointCloudLayer = new Tile3DLayer({
          id: getLayerId('pointcloud', datasetId),
          data: spatialAwareUrl,
          pickable: true,
          visible: visible,
          pointSize: 2,
          opacity: dynamicOpacity,
          _subLayerProps: {
            points: {
              pointSize: 0.2,
              getColor: (d) => d.color || [0, 255, 0, 255],
              material: false,
              radiusPixels: 15,
              billboard: false,
              sizeScale: 1,
              sizeMinPixels: 8,
              sizeMaxPixels: 30,
              opacity: dynamicOpacity,
            },
            mesh: {
              getColor: [0, 255, 0, 255],
              material: false,
              wireframe: false,
              opacity: dynamicOpacity,
            },
          },
          loadOptions: {
            '3d-tiles': { pointCloudColoration: { mode: 'RGB' } },
          },
          getPointColor: [0, 255, 0, 255],
          onClick: (info) => {
            if (info.object && onStationClick) onStationClick(info.object);
          },
          onTilesetLoad: (tileset) => {
            const bounds = layerData.asset.ept.bounds;
            console.log('Point cloud bounds::::', bounds);
            const [minX, minY, minZ, maxX, maxY, maxZ] = bounds;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const centerLng = (centerX / 20037508.34) * 180;

            const centerLat =
              (180 / Math.PI) *
              (2 * Math.atan(Math.exp(centerY / 6378137.0)) - Math.PI / 2);
            console.log(centerLng, centerLat);
            if (mapContext?.map) {
              mapContext.map.flyTo({
                center: [centerLng, centerLat],
                zoom: 8,
                pitch: 60,
                bearing: 0,
                duration: 2000,
              });
            }
          },
        });
        newLayers.push(pointCloudLayer);
        break;
      }
      case 'raster': {
        const bounds = calculateGeoJSONBounds(layerData.features);
        const feature =
          Array.isArray(layerData.features) && layerData.features.length > 0
            ? layerData.features[0]
            : null;
        let rasterLayers = [];
        if (feature) {
          const { collection, id: itemId, properties } = feature;

          // NEW: Use dynamic colormap and rescale values from dataset metadata
          const tileParams = {
            assets: 'cog_default',
            colormap: datasetMetadata.colormap || 'viridis', // Use dataset colormap or fallback
            rescale: formatRescaleValues(datasetMetadata.rescale_values), // Use dataset rescale values
            nodata: '-9999',
          };

          // Add spatial bounds if available
          if (spatialSubset) {
            tileParams.bbox = `${spatialSubset.west},${spatialSubset.south},${spatialSubset.east},${spatialSubset.north}`;
          }

          console.log('Raster tile params:', tileParams);
          const tileUrl = buildRasterTileUrl(collection, itemId, tileParams);

          const rasterLayer = new TileLayer({
            id: getLayerId('raster', `${datasetId}-${itemId}`),
            data: tileUrl,
            minZoom: 0,
            maxZoom: 19,
            tileSize: 256,
            visible: visible,
            pickable: true,
            opacity: dynamicOpacity,
            renderSubLayers: (props) => {
              const {
                bbox: { west, south, east, north },
              } = props.tile;

              // Filter tiles based on spatial subset
              if (
                spatialSubset &&
                !tileIntersectsBounds(west, south, east, north, spatialSubset)
              ) {
                return null;
              }

              return new BitmapLayer({
                ...props,
                data: null,
                image: props.data,
                bounds: [west, south, east, north],
                modelMatrix: new Matrix4().translate([0, 0, 0]),
              });
            },
            onClick: (info) => {
              if (onStationClick)
                onStationClick({
                  type: 'raster',
                  feature,
                  tile: info.tile,
                  coordinate: info.coordinate,
                  datetime: properties?.datetime || properties?.start_datetime,
                });
            },
            onTileLoad: () => {
              console.log(
                'Tile loaded for datetime:',
                properties?.start_datetime ||
                  properties?.datetime ||
                  '(no datetime)'
              );
            },
          });
          rasterLayers.push(rasterLayer);
        }
        newLayers.push(...rasterLayers);
        if (bounds && mapContext?.map) {
          setTimeout(() => {
            mapContext.map.flyTo({
              center: [-98.5795, 39.8283],
              zoom: 2,
              pitch: 0,
              bearing: 0,
              duration: 2000,
            });
          }, 500);
        }
        break;
      }

      //TROPESS
      case 'netcdf-2d': {
        const { conceptId, datetime, variable, bounds, ...rest } = layerData;
        const varValues = { lev: [500, 1000] };

        if (!conceptId || !datetime || !variable) {
          newLayers = [];
          break;
        }

        const netcdfParams = {
          ...rest,
          colormap: datasetMetadata.colormap || 'reds',
          rescale: formatRescaleValues(datasetMetadata.rescale_values),
          ...(spatialSubset && {
            spatialBounds: spatialSubset,
            bbox: `${spatialSubset.west},${spatialSubset.south},${spatialSubset.east},${spatialSubset.north}`,
          }),
        };
        const tileUrls = buildNetCDF2DTileUrl(
          conceptId,
          datetime,
          variable,
          varValues,
          netcdfParams
        );
        const levValues = varValues?.lev || [];

        const datasetIndex = layerOpacityList.findIndex(
          (layer) => layer.id === datasetId
        );
        const baseZOffset = datasetIndex * 10; 

        tileUrls.forEach((tileUrl, index) => {
          const lev = levValues[index];

          if (lev === undefined) return;

          // Use small relative z-offset instead of massive absolute offset
          const relativeZOffset = baseZOffset + index * 500000; 
          const BOUNDS = [-125.0, 24.5, -66.5, 49.5];

          // Use spatial subset bounds if available, otherwise use default bounds
          const effectiveBounds = spatialSubset || {
            west: BOUNDS[0],
            south: BOUNDS[1],
            east: BOUNDS[2],
            north: BOUNDS[3],
          };

          const netcdfLayer = new TileLayer({
            id: `${getLayerId('netcdf-2d', datasetId)}-lev-${lev}`,
            data: tileUrl,
            minZoom: 0,
            maxZoom: 19,
            tileSize: 256,
            visible: visible,
            pickable: true,
            opacity: dynamicOpacity,
            renderSubLayers: (props) => {
              const {
                bbox: { west, south, east, north },
              } = props.tile;

              // Use effective bounds for filtering
              if (
                east < effectiveBounds.west ||
                west > effectiveBounds.east ||
                north < effectiveBounds.south ||
                south > effectiveBounds.north
              ) {
                return null;
              }
              return new BitmapLayer({
                ...props,
                opacity: dynamicOpacity,
                data: null,
                image: props.data,
                bounds: [west, south, east, north],
                modelMatrix: new Matrix4().translate([0, 0, relativeZOffset]),
              });
            },
            onClick: (info) => {
              if (onStationClick) {
                onStationClick({
                  type: 'netcdf-2d',
                  conceptId,
                  datetime,
                  variable,
                  lev: lev,
                  tile: info.tile,
                  coordinate: info.coordinate,
                  layerData,
                });
              }
            },
            onTileLoad: (tile) =>
              console.log(`NetCDF tile loaded for lev=${lev}:`, tile),
            onTileError: (error) =>
              console.error(`NetCDF tile load error for lev=${lev}:`, error),
          });

          newLayers.push(netcdfLayer);
        });
        if (mapContext?.map) {
          setTimeout(() => {
            mapContext.map.flyTo({
              center: [-98.5795, 39.8283],
              zoom: 2,
              pitch: 0,
              bearing: 0,
              duration: 2000,
            });
          }, 500);
        }
        break;
      }
      //AQS
      case 'feature': {
        const geojsonData = layerData;

        // Apply spatial filtering to station data
        let filteredFeatures = geojsonData.features;
        if (spatialSubset) {
          filteredFeatures = geojsonData.features.filter((feature) => {
            const [lng, lat] = feature.geometry.coordinates;
            return isPointInBounds(lng, lat, spatialSubset);
          });

          console.log(
            `Spatial filtering: ${geojsonData.features.length} -> ${filteredFeatures.length} stations`
          );
        }

        const stationBounds = calculateGeoJSONBounds(filteredFeatures);
        const iconSvg = `<svg fill="#2496ED" width="30px" height="30px" viewBox="-51.2 -51.2 614.40 614.40" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#000000" stroke-width="10.24"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path></g><g id="SVGRepo_iconCarrier"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35-817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path></g></svg>`;
        const svgToDataURL = (svg) =>
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

        // Use filtered features for icon data
        const iconData = filteredFeatures.map((feature) => ({
          ...feature.properties,
          coordinates: feature.geometry.coordinates,
          position: feature.geometry.coordinates,
          feature: feature,
        }));

        const stationLayer = new IconLayer({
          id: getLayerId('station', datasetId),
          data: iconData,
          pickable: true,
          visible: visible,
          opacity: dynamicOpacity,
          getIcon: (d) => ({
            url: svgToDataURL(iconSvg),
            width: 30,
            height: 30,
            anchorY: 30,
            anchorX: 15,
          }),
          getPosition: (d) => d.position,
          getSize: 24,
          sizeScale: 1,
          sizeMinPixels: 16,
          sizeMaxPixels: 32,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 100],
          onClick: (info) => {
            if (info.object && onStationClick)
              handleStationClick(
                info.object.feature || info.object,
                onStationClick
              );
          },
          getTooltip: ({ object }) =>
            object && {
              html: `<div><strong>Station:</strong> ${object.name || object.id || 'Unknown'}</div>`,
              style: {
                backgroundColor: '#f8f8f8',
                fontSize: '0.8em',
                color: '#333',
              },
            },
        });
        newLayers.push(stationLayer);

        // Zoom to filtered stations or spatial subset
        if (mapContext?.map) {
          setTimeout(() => {
            if (spatialSubset) {
              // Zoom to spatial subset bounds
              mapContext.map.fitBounds(
                [
                  [spatialSubset.west, spatialSubset.south],
                  [spatialSubset.east, spatialSubset.north],
                ],
                {
                  padding: 50,
                  duration: 2000,
                }
              );
            } else if (
              stationBounds &&
              stationBounds.minLng !== Infinity &&
              stationBounds.maxLng !== -Infinity
            ) {
              if (filteredFeatures.length === 1) {
                const coords = filteredFeatures[0].geometry.coordinates;
                if (
                  coords &&
                  coords.length === 2 &&
                  !isNaN(coords[0]) &&
                  !isNaN(coords[1])
                )
                  mapContext.map.flyTo({
                    center: coords,
                    zoom: 12,
                    duration: 2000,
                  });
              } else {
                zoomToBounds(mapContext.map, stationBounds, {
                  padding: 50,
                  maxZoom: 15,
                  pitch: 0,
                  bearing: 0,
                });
              }
            }
          }, 500);
        }
        break;
      }
      default: {
        newLayers = [];
        break;
      }
    }
    setManagedLayers((prevManaged) => {
      return {
        ...prevManaged,
        [datasetId]: newLayers,
      };
    });
  }, [
    layerData,
    activeLayerUrl,
    galleryType,
    datasetId,
    visible,
    onStationClick,
    mapContext,
    layerOpacityList,
    spatialSubset,
    allActiveDatasets,
  ]);

  useEffect(() => {
    // Only update opacity for layers whose opacity value has changed
    setManagedLayers((prevManagedLayers) => {
      const updatedManaged = { ...prevManagedLayers };

      for (const layerOpacityEntry of layerOpacityList) {
        const { id: datasetId, opacity: newOpacityValue } = layerOpacityEntry;
        const newOpacity = newOpacityValue / 100;

        if (!updatedManaged[datasetId]) continue;

        const existingLayers = updatedManaged[datasetId];

        // Clone each layer with new opacity
        updatedManaged[datasetId] = existingLayers.map((layer) => {
          if (layer.props.opacity === newOpacity) return layer;

          // Top-level layer opacity
          const originalRender = layer.props.renderSubLayers;

          const cloned = layer.clone({
            opacity: newOpacity,
            ...(originalRender && {
              renderSubLayers: (props) => {
                const sub = originalRender(props);
                return sub?.clone ? sub.clone({ opacity: newOpacity }) : sub;
              },
            }),
          });

          return cloned;
        });
      }
      return updatedManaged;
    });
  }, [layerOpacityList]);

  return null;
}
