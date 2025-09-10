import React, { useEffect, useState } from 'react';
import { IconLayer, BitmapLayer } from '@deck.gl/layers';
import { Tile3DLayer, TileLayer } from '@deck.gl/geo-layers';
import { GeoJsonLayer, ArcLayer } from '@deck.gl/layers';
import { Matrix4 } from '@math.gl/core';
import { useMapbox } from '../../../context/mapContext';
import {
  getLayerId,
  calculateGeoJSONBounds,
  zoomToBounds,
  buildRasterTileUrl,
  buildNetCDF2DTileUrl,
} from './utils';

function handleStationClick(clickedFeature, onStationClick) {
  onStationClick(clickedFeature);
}

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
    return '10, 50';
  }
  return `${rescaleValues[0]}, ${rescaleValues[1]}`;
};

// Try to fly to the tileset center with several fallbacks
const flyToTilesetCenter = (tileset, map, fallbackEPTBounds) => {
  if (!map || !tileset) return;

  // loaders.gl Tileset3D sometimes exposes a cartographicCenter
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

  // 3D Tiles "region" in radians: [w,s,e,n,minZ,maxZ]
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

  // Fallback: EPT mercator meters bounds (if you happened to have them)
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
  pointCloudDate, // selected timestamp string for point-cloud
}) {
  const [managedLayers, setManagedLayers] = useState({});
  const mapContext = useMapbox();
  const deckOverlay = mapContext?.deckOverlay;

  // expose for debugging
  useEffect(() => {
    window.Tile3DLayer = Tile3DLayer;
    window.GeoJsonLayer = GeoJsonLayer;
    window.ArcLayer = ArcLayer;
  }, []);

  // keep parent in sync (debug map of datasetId -> layers[])
  useEffect(() => {
    updateActiveLayers?.(managedLayers);
  }, [managedLayers, updateActiveLayers]);

  // Compose ordered layer list. First: explicit order from layerOpacityList.
  // Then: include any managed dataset not present in layerOpacityList (prevents filtering-out new layers).
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

    return ordered;
  };

  // Push to deck overlay
  useEffect(() => {
    const allLayers = getOrderedLayers();
    if (deckOverlay) {
      deckOverlay.setProps({ layers: allLayers });
    }
    onLayersUpdate?.(allLayers);

    // helpful:
    console.log(
      '[Deck] pushing layers ->',
      allLayers.map((l) => l.id)
    );
  }, [managedLayers, deckOverlay, onLayersUpdate, layerOpacityList]);

  // Build (or rebuild) layers for the current dataset
  useEffect(() => {
    if (!datasetId) return;

    // clear this dataset if no data
    if (!layerData) {
      setManagedLayers((prev) => {
        if (Object.prototype.hasOwnProperty.call(prev, datasetId)) {
          const { [datasetId]: _, ...rest } = prev;
          console.log(`Clearing layers for dataset: ${datasetId}`);
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
      // ---------- 3D Tiles point cloud ----------
      case 'point-cloud': {
        // Prefer template + selected date, fall back to pre-expanded url
        const template = layerData?.tilesetTemplate || activeLayerUrl || '';
        const dateStr =
          pointCloudDate ||
          layerData?.available_dates?.[0] ||
          (Array.isArray(layerData?.datasetInfo?.available_dates)
            ? layerData.datasetInfo.available_dates[0]
            : null);

        if (!template) {
          console.warn('[point-cloud] No tileset template/url available');
          break;
        }
        if (!dateStr) {
          console.warn('[point-cloud] No available date to expand template');
          break;
        }

        // IMPORTANT: change the layer id when the date changes so deck.gl fully resets
        const layerId = `${getLayerId('pointcloud', datasetId)}-${dateStr}`;

        const url = template.replace('{DateTime}', dateStr);
        // Do NOT append bbox to a 3D tiles URL. Most servers don't support it.

        console.log('[point-cloud] mount:', {
          layerId,
          url,
          datasetId,
          dateStr,
        });

        const pointCloudLayer = new Tile3DLayer({
          id: layerId,
          data: url,
          pickable: true,
          visible,
          opacity: dynamicOpacity,

          // keep it simple first; once rendering, tweak sub-layer props if needed
          onTilesetLoad: (tileset) => {
            console.log('[point-cloud] tileset loaded:', tileset);
            // If you still have EPT bounds in your STAC/meta, pass as fallback here:
            const fallbackBounds = layerData?.asset?.ept?.bounds;
            flyToTilesetCenter(tileset, mapContext?.map, fallbackBounds);
          },
          onTileLoad: (tileHeader) => {
            // fires per tile content; good signal you’re actually loading
            console.log('[point-cloud] tile content loaded:', tileHeader);
          },
          onError: (e) => {
            console.error('[point-cloud] Tile3DLayer error:', e);
          },
        });

        newLayers.push(pointCloudLayer);
        break;
      }

      // ---------- Raster COG ----------
      case 'raster': {
        const feature =
          Array.isArray(layerData.features) && layerData.features.length > 0
            ? layerData.features[0]
            : null;
        if (!feature) break;

        const bounds = calculateGeoJSONBounds([feature]);
        const { collection, id: itemId, properties } = feature;

        const tileParams = {
          assets: 'cog_default',
          colormap: datasetMetadata.colormap || 'viridis',
          rescale: formatRescaleValues(datasetMetadata.rescale_values),
          nodata: '-9999',
        };

        if (spatialSubset) {
          tileParams.bbox = `${spatialSubset.west},${spatialSubset.south},${spatialSubset.east},${spatialSubset.north}`;
        }

        const tileUrl = buildRasterTileUrl(collection, itemId, tileParams);

        const rasterLayer = new TileLayer({
          id: getLayerId('raster', `${datasetId}-${itemId}`),
          data: tileUrl,
          minZoom: 0,
          maxZoom: 19,
          tileSize: 256,
          visible,
          pickable: true,
          opacity: dynamicOpacity,
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
        });

        newLayers.push(rasterLayer);

        if (bounds && mapContext?.map) {
          setTimeout(() => {
            mapContext.map.flyTo({
              center: [-98.5795, 39.8283],
              zoom: 2,
              pitch: 0,
              bearing: 0,
              duration: 1500,
            });
          }, 400);
        }
        break;
      }

      // ---------- NetCDF 2D ----------
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

          const netcdfLayer = new TileLayer({
            id: `${getLayerId('netcdf-2d', datasetId)}-lev-${lev}`,
            data: tileUrl,
            minZoom: 0,
            maxZoom: 19,
            tileSize: 256,
            visible,
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
              duration: 1500,
            });
          }, 400);
        }
        break;
      }

      // ---------- Station icons ----------
      case 'feature': {
        const geojsonData = layerData;
        let filtered = geojsonData.features;

        if (spatialSubset) {
          filtered = geojsonData.features.filter((f) => {
            const [lng, lat] = f.geometry.coordinates;
            return isPointInBounds(lng, lat, spatialSubset);
          });
          console.log(
            `[feature] spatial filtering: ${geojsonData.features.length} -> ${filtered.length}`
          );
        }

        const stationBounds = calculateGeoJSONBounds(filtered);

        const iconSvg =
          `<svg fill="#2496ED" width="30px" height="30px" viewBox="-51.2 -51.2 614.40 614.40" xmlns="http://www.w3.org/2000/svg">` +
          `<g id="SVGRepo_bgCarrier" stroke-width="0"></g>` +
          `<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="#000" stroke-width="10.24">` +
          `<path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path>` +
          `</g></svg>`;
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
              html: `<div><strong>Station:</strong> ${object.name || object.id || 'Unknown'}</div>`,
              style: {
                backgroundColor: '#f8f8f8',
                fontSize: '0.8em',
                color: '#333',
              },
            },
        });

        newLayers.push(stationLayer);

        if (mapContext?.map) {
          setTimeout(() => {
            if (spatialSubset) {
              mapContext.map.fitBounds(
                [
                  [spatialSubset.west, spatialSubset.south],
                  [spatialSubset.east, spatialSubset.north],
                ],
                { padding: 50, duration: 1500 }
              );
            } else if (
              stationBounds &&
              stationBounds.minLng !== Infinity &&
              stationBounds.maxLng !== -Infinity
            ) {
              if (filtered.length === 1) {
                const coords = filtered[0].geometry.coordinates;
                if (
                  coords &&
                  coords.length === 2 &&
                  !isNaN(coords[0]) &&
                  !isNaN(coords[1])
                ) {
                  mapContext.map.flyTo({
                    center: coords,
                    zoom: 12,
                    duration: 1500,
                  });
                }
              } else {
                zoomToBounds(mapContext.map, stationBounds, {
                  padding: 50,
                  maxZoom: 15,
                  pitch: 0,
                  bearing: 0,
                });
              }
            }
          }, 400);
        }
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
    pointCloudDate, // IMPORTANT: rebuild on date change
  ]);

  // Live opacity updates without full rebuild
  useEffect(() => {
    setManagedLayers((prev) => {
      const updated = { ...prev };
      for (const entry of layerOpacityList) {
        const { id: dsId, opacity: pct } = entry;
        const newOpacity = pct / 100;
        if (!updated[dsId]) continue;
        const existingLayers = updated[dsId];
        updated[dsId] = existingLayers.map((layer) => {
          if (layer.props.opacity === newOpacity) return layer;
          const originalRender = layer.props.renderSubLayers;
          return layer.clone({
            opacity: newOpacity,
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
  }, [layerOpacityList]);

  return null;
}
