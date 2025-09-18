import React, { useEffect, useState } from 'react';
import { IconLayer, BitmapLayer } from '@deck.gl/layers';
import { Tile3DLayer, TileLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer } from '@deck.gl/layers';
import { Matrix4 } from '@math.gl/core';
import { useMapbox } from '../../../context/mapContext';
import { getLayerId, buildRasterTileUrl, buildNetCDF2DTileUrl } from './utils';

function handleStationClick(clickedFeature, onStationClick) {
  onStationClick(clickedFeature);
}

const extractPressureLevel = (layerId) => {
  const match = layerId?.match(/-lev-([\d.]+)$/);
  return match ? parseFloat(match[1]) : null;
};

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

const getDatasetMetadata = (datasetId, allActiveDatasets) =>
  allActiveDatasets.find((d) => d.id === datasetId) || {};

const formatRescaleValues = (rescaleValues) => {
  if (
    !rescaleValues ||
    !Array.isArray(rescaleValues) ||
    rescaleValues.length !== 2
  ) {
    return null;
  }
  return rescaleValues
    .map((num) => Number.parseFloat(num).toExponential())
    .join(',');
};

const flyToTilesetCenter = (tileset, map, fallbackEPTBounds) => {
  if (!map || !tileset) return;

  const cc = tileset.cartographicCenter;
  if (cc && Number.isFinite(cc[0]) && Number.isFinite(cc[1])) {
    const [lng, lat] = cc;
    map.flyTo({
      center: [lng, lat],
      zoom: 7,
      pitch: 60,
      bearing: 0,
      duration: 1500,
    });
    return;
  }

  const region = tileset?.root?.boundingVolume?.region;
  if (region && region.length >= 4) {
    const [w, s, e, n] = region;
    const centerLng = ((w + e) / 2) * (180 / Math.PI);
    const centerLat = ((s + n) / 2) * (180 / Math.PI);
    map.flyTo({
      center: [centerLng, centerLat],
      zoom: 7,
      pitch: 60,
      bearing: 0,
      duration: 1500,
    });
    return;
  }

  if (
    fallbackEPTBounds &&
    Array.isArray(fallbackEPTBounds) &&
    fallbackEPTBounds.length >= 6
  ) {
    const [minX, minY, , maxX, maxY] = fallbackEPTBounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerLng = (centerX / 20037508.34) * 180;
    const centerLat =
      (180 / Math.PI) *
      (2 * Math.atan(Math.exp(centerY / 6378137.0)) - Math.PI / 2);
    map.flyTo({
      center: [centerLng, centerLat],
      zoom: 7,
      pitch: 60,
      bearing: 0,
      duration: 1500,
    });
  }
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
  pointCloudDate,
  aoiGeometry,
  isDrawingAOI,
  datasetToRemove,
}) {
  const [managedLayers, setManagedLayers] = useState({});
  const [layerRefreshCounter, setLayerRefreshCounter] = useState(0);
  const [currentRasterItem, setCurrentRasterItem] = useState(null);
  const mapContext = useMapbox();
  const deckOverlay = mapContext?.deckOverlay;

  useEffect(() => {
    updateActiveLayers?.(managedLayers);
  }, [managedLayers, updateActiveLayers]);

  useEffect(() => {
    if (datasetToRemove) {
      setManagedLayers((prev) => {
        if (Object.prototype.hasOwnProperty.call(prev, datasetToRemove)) {
          const { [datasetToRemove]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }
  }, [datasetToRemove]);

  // Clear raster layers when item changes
  useEffect(() => {
    if (galleryType === 'raster' && layerData?.features?.[0]) {
      const newItemId = layerData.features[0].id;

      if (currentRasterItem && currentRasterItem !== newItemId) {
        setManagedLayers((prev) => {
          const updated = { ...prev };
          if (updated[datasetId]) {
            delete updated[datasetId];
          }
          return updated;
        });

        setLayerRefreshCounter((prev) => prev + 1);
      }

      setCurrentRasterItem(newItemId);
    }
  }, [layerData?.features?.[0]?.id, galleryType, datasetId, currentRasterItem]);

  const getOrderedLayers = () => {
    const ordered = [];
    const wanted = new Set(layerOpacityList.map((l) => l.id));
    layerOpacityList.forEach((cfg) => {
      const ls = managedLayers[cfg.id];
      if (ls && Array.isArray(ls)) ordered.push(...ls);
    });
    Object.entries(managedLayers).forEach(([id, ls]) => {
      if (!wanted.has(id) && Array.isArray(ls)) ordered.push(...ls);
    });
    if (aoiGeometry && !isDrawingAOI) {
      const aoiData = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: aoiGeometry }],
      };
      const aoiLayer = new GeoJsonLayer({
        id: 'aoi-visualization',
        data: aoiData,
        getFillColor: [255, 107, 53, 80],
        getLineColor: [255, 107, 53, 255],
        getLineWidth: 3,
        pickable: false,
        stroked: true,
        filled: true,
      });
      ordered.push(aoiLayer);
    }
    return ordered;
  };

  useEffect(() => {
    const allLayers = getOrderedLayers();
    if (deckOverlay) {
      deckOverlay.setProps({ layers: allLayers });
    }
    onLayersUpdate?.(allLayers);
  }, [managedLayers, deckOverlay, onLayersUpdate, layerOpacityList]);

  useEffect(() => {
    if (!datasetId) return;

    if (!layerData) {
      setManagedLayers((prev) => {
        if (Object.prototype.hasOwnProperty.call(prev, datasetId)) {
          const { [datasetId]: _, ...rest } = prev;
          return rest;
        }
        return prev;
      });
      return;
    }

    const datasetMetadata = getDatasetMetadata(datasetId, allActiveDatasets);
    const entry = layerOpacityList.find((l) => l.id === datasetId);
    const dynamicOpacity = entry ? entry.opacity / 100 : 1.0;
    let newLayers = [];

    switch (galleryType) {
      case 'point-cloud': {
        const template = layerData?.tilesetTemplate || activeLayerUrl || '';
        const dateStr =
          pointCloudDate ||
          layerData?.available_dates?.[0] ||
          (Array.isArray(layerData?.datasetInfo?.available_dates)
            ? layerData.datasetInfo.available_dates[0]
            : null);
        if (!template || !dateStr) break;
        const layerId = `${getLayerId('pointcloud', datasetId)}-${dateStr}`;
        const url = template.replace('{DateTime}', dateStr);
        const pointCloudLayer = new Tile3DLayer({
          id: layerId,
          data: url,
          pickable: true,
          visible,
          opacity: dynamicOpacity,
          onTilesetLoad: (tileset) => {
            const fallbackBounds = layerData?.asset?.ept?.bounds;
            flyToTilesetCenter(tileset, mapContext?.map, fallbackBounds);
          },
        });
        newLayers.push(pointCloudLayer);
        break;
      }

      case 'raster': {
        const feature =
          Array.isArray(layerData.features) && layerData.features.length > 0
            ? layerData.features[0]
            : null;
        if (!feature) break;

        const { collection, id: itemId, properties } = feature;
        const datetime = properties?.datetime || properties?.start_datetime;

        const tileParams = {
          assets: 'cog_default',
          colormap: datasetMetadata.colormap || 'viridis',
          rescale: formatRescaleValues(datasetMetadata.rescale_values),
          nodata: '-9999',
        };

        if (spatialSubset) {
          tileParams.bbox = `${spatialSubset.west},${spatialSubset.south},${spatialSubset.east},${spatialSubset.north}`;
        }

        const tileUrl = buildRasterTileUrl(collection, itemId, tileParams, feature);
        const uniqueLayerId = `raster-${datasetId}-${layerRefreshCounter}-${itemId.slice(-8)}`;

        const rasterLayer = new TileLayer({
          id: uniqueLayerId,
          data: tileUrl,
          minZoom: 0,
          maxZoom: 19,
          tileSize: 256,
          visible,
          pickable: true,
          opacity: dynamicOpacity,
          updateTriggers: {
            getTileData: [itemId, datetime, layerRefreshCounter],
          },
          refinementStrategy: 'never',

          renderSubLayers: (props) => {
            const {
              bbox: { west, south, east, north },
            } = props.tile;

            if (
              spatialSubset &&
              !tileIntersectsBounds(west, south, east, north, spatialSubset)
            ) {
              return null;
            }

            return new BitmapLayer({
              ...props,
              id: `bitmap-${props.tile.id}-${layerRefreshCounter}`,
              data: null,
              image: props.data,
              bounds: [west, south, east, north],
              updateTriggers: {
                getImage: [itemId, datetime, layerRefreshCounter],
              },
            });
          },

          onClick: (info) => {
            if (onStationClick)
              onStationClick({
                type: 'raster',
                feature,
                tile: info.tile,
                coordinate: info.coordinate,
                datetime: datetime,
              });
          },
        });

        newLayers.push(rasterLayer);
        break;
      }

      case 'netcdf-2d': {
        const { conceptId, datetime, variable, ...rest } = layerData;
        if (!conceptId || !datetime || !variable) break;

        const varValues = { lev: [500, 1000] };
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
          (l) => l.id === datasetId
        );
        const baseZOffset = datasetIndex * 10;
        const DEFAULT_BOUNDS = [-125.0, 24.5, -66.5, 49.5];
        const effectiveBounds = spatialSubset || {
          west: DEFAULT_BOUNDS[0],
          south: DEFAULT_BOUNDS[1],
          east: DEFAULT_BOUNDS[2],
          north: DEFAULT_BOUNDS[3],
        };
        tileUrls.forEach((tileUrl, index) => {
          const lev = levValues[index];
          if (lev === undefined) return;
          const relativeZOffset = baseZOffset + index * 500000;
          const isLayerVisible =
            layerOpacityList.find((d) => d.id === datasetId)?.levelVisibility?.[
              lev
            ] ?? true;

          const netcdfLayer = new TileLayer({
            id: `${getLayerId('netcdf-2d', datasetId)}-lev-${lev}`,
            data: tileUrl,
            minZoom: 0,
            maxZoom: 19,
            tileSize: 256,
            visible: isLayerVisible && visible,
            pickable: true,
            opacity: dynamicOpacity,
            renderSubLayers: (props) => {
              const {
                bbox: { west, south, east, north },
              } = props.tile;
              if (
                east < effectiveBounds.west ||
                west > effectiveBounds.east ||
                north < effectiveBounds.south ||
                south > effectiveBounds.south
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
          });
          newLayers.push(netcdfLayer);
        });
        break;
      }

      case 'feature': {
        const geojsonData = layerData;
        let filtered = geojsonData.features;
        if (spatialSubset) {
          filtered = geojsonData.features.filter((f) => {
            const [lng, lat] = f.geometry.coordinates;
            return isPointInBounds(lng, lat, spatialSubset);
          });
        }
        const iconSvg = `<svg fill="#2496ED" width="30px" height="30px" viewBox="-51.2 -51.2 614.40 614.40" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#000" stroke-width="10.24"><path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path></g></svg>`;
        const svgToDataURL = (svg) =>
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        const iconData = filtered.map((feature) => ({
          ...feature.properties,
          coordinates: feature.geometry.coordinates,
          position: feature.geometry.coordinates,
          feature,
        }));
        const stationLayer = new IconLayer({
          id: getLayerId('station', datasetId),
          data: iconData,
          pickable: true,
          visible,
          opacity: dynamicOpacity,
          getIcon: () => ({
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
              html: `<strong>Station:</strong> ${
                object.name || object.id || 'Unknown'
              }`,
              style: {
                backgroundColor: '#f8f8f8',
                fontSize: '0.8em',
                color: '#34495E',
              },
            },
        });
        newLayers.push(stationLayer);
        break;
      }

      default:
        newLayers = [];
    }

    setManagedLayers((prev) => ({ ...prev, [datasetId]: newLayers }));
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
    pointCloudDate,
    layerRefreshCounter,
  ]);

  useEffect(() => {
    setManagedLayers((prev) => {
      const updated = { ...prev };
      for (const entry of layerOpacityList) {
        const { id: dsId, opacity: pct, levelVisibility } = entry;
        const newOpacity = pct / 100;
        if (!updated[dsId]) continue;
        const existingLayers = updated[dsId];
        updated[dsId] = existingLayers.map((layer) => {
          const level = extractPressureLevel(layer.id);
          let newVisibility = visible;
          if (level !== null && levelVisibility) {
            newVisibility = levelVisibility[level] ?? true;
          }
          const propsChanged =
            layer.props.opacity !== newOpacity ||
            layer.props.visible !== newVisibility;
          if (!propsChanged) return layer;
          const originalRender = layer.props.renderSubLayers;
          return layer.clone({
            opacity: newOpacity,
            visible: newVisibility,
            ...(originalRender && {
              renderSubLayers: (props) => {
                const sub = originalRender(props);
                return sub?.clone ? sub.clone({ opacity: newOpacity }) : sub;
              },
            }),
          });
        });
      }
      return updated;
    });
  }, [layerOpacityList, visible]);

  return null;
}