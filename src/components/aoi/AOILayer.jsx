// components/aoi/AOILayer.jsx
import React, { useEffect, useRef } from 'react';
import bbox from '@turf/bbox';
import { useMapbox } from '../../context/mapContext';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

export function AOILayer({ aoi, isDrawing, onDrawComplete, onDrawCancel, deckRef }) {
  const mapContext = useMapbox();
  const map = mapContext?.map;
  const drawRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Initialize Mapbox GL Draw (for drawing only)
  useEffect(() => {
    if (!map) return;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'simple_select',
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