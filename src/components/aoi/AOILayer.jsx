// components/aoi/AOILayer.jsx
import React, { useEffect } from 'react';
import bbox from '@turf/bbox';
import { useMapbox } from '../../context/mapContext';

export function AOILayer({ aoi, isDrawing, onDrawComplete, onDrawCancel }) {
  const mapContext = useMapbox();
  const map = mapContext?.map;

  // For now, let's just handle AOI visualization without drawing
  // We'll add drawing functionality later once the basic system works

  // Add/remove AOI from map
  useEffect(() => {
    if (!map) return;

    const sourceId = 'aoi-source';
    const layerId = 'aoi-layer';
    const fillLayerId = 'aoi-fill-layer';

    // Remove existing layers
    try {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getLayer(fillLayerId)) {
        map.removeLayer(fillLayerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    } catch (error) {
      console.warn('Error removing existing AOI layers:', error);
    }

    if (aoi) {
      try {
        // Add source
        map.addSource(sourceId, {
          type: 'geojson',
          data: aoi
        });

        // Add fill layer
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#008888',
            'fill-opacity': 0.2
          }
        });

        // Add stroke layer
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#008888',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        });

        // Fit bounds to AOI
        const bounds = bbox(aoi);
        map.fitBounds(bounds, {
          padding: 50,
          duration: 1000
        });
      } catch (error) {
        console.error('Error adding AOI to map:', error);
      }
    }

    return () => {
      // Cleanup on unmount
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getLayer(fillLayerId)) {
          map.removeLayer(fillLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (error) {
        console.warn('Error cleaning up AOI layers:', error);
      }
    };
  }, [map, aoi]);

  // Show message when drawing is requested (since we disabled drawing for now)
  useEffect(() => {
    if (isDrawing) {
      console.log('Drawing requested - for now, please select a predefined AOI from the dropdown');
      // Call onDrawCancel to stop the drawing state
      if (onDrawCancel) {
        onDrawCancel();
      }
    }
  }, [isDrawing, onDrawCancel]);

  return null;
}