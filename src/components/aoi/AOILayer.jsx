// components/aoi/AOILayer.jsx
import React, { useEffect, useRef } from 'react';
import bbox from '@turf/bbox';
import { useMapbox } from '../../context/mapContext';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

// Simple custom styles with stronger colors
const drawStyles = [
  // Active polygon fill (while drawing)
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    paint: {
      'fill-color': '#ff0000',
      'fill-opacity': 0.2
    }
  },
  // Active polygon stroke (while drawing)
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
    paint: {
      'line-color': '#ff0000',
      'line-width': 3
    }
  },
  // Inactive polygon fill
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    paint: {
      'fill-color': '#3388ff',
      'fill-opacity': 0.2
    }
  },
  // Inactive polygon stroke
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'false']],
    paint: {
      'line-color': '#3388ff',
      'line-width': 2
    }
  },
  // Vertex points
  {
    id: 'gl-draw-polygon-and-line-vertex-stroke-inactive',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
    paint: {
      'circle-radius': 4,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#ff0000',
      'circle-stroke-width': 2
    }
  }
];

export function AOILayer({ aoi, isDrawing, onDrawComplete, onDrawCancel, deckRef }) {
  const mapContext = useMapbox();
  const map = mapContext?.map;
  const drawRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Initialize Mapbox GL Draw
  useEffect(() => {
    if (!map) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'simple_select',
      styles: drawStyles
    });

    map.addControl(draw, 'top-right');
    drawRef.current = draw;

    const onDrawCreate = (e) => {
      const feature = e.features[0];
      if (feature && feature.geometry.type === 'Polygon') {
        isDrawingRef.current = false;
        onDrawComplete?.(feature.geometry);
      }
    };

    const onDrawDelete = () => {
      onDrawCancel?.();
    };

    map.on('draw.create', onDrawCreate);
    map.on('draw.delete', onDrawDelete);

    return () => {
      map.off('draw.create', onDrawCreate);
      map.off('draw.delete', onDrawDelete);
      if (drawRef.current) {
        map.removeControl(drawRef.current);
        drawRef.current = null;
      }
    };
  }, [map, onDrawComplete, onDrawCancel]);

  // Handle drawing state
  useEffect(() => {
    if (!drawRef.current) return;

    if (isDrawing && !isDrawingRef.current) {
      isDrawingRef.current = true;
      drawRef.current.deleteAll();
      drawRef.current.changeMode('draw_polygon');
    } else if (!isDrawing && isDrawingRef.current) {
      isDrawingRef.current = false;
      drawRef.current.changeMode('simple_select');
    }
  }, [isDrawing]);

  // Clear draw control when AOI is cleared
  useEffect(() => {
    if (!aoi && drawRef.current) {
      drawRef.current.deleteAll();
    }
  }, [aoi]);

  // Fit to bounds when AOI changes
  useEffect(() => {
    if (!isDrawing && aoi && map) {
      setTimeout(() => {
        const bounds = bbox(aoi);
        map.fitBounds(bounds, { padding: 50, duration: 1000 });
      }, 100);
    }
  }, [aoi, isDrawing, map]);

  return null;
}