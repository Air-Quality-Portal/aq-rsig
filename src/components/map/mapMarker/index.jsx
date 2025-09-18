import { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

import { useMapbox } from '../../../context/mapContext';
import './index.css';
/*
  Add marker on map
  @param {STACItem} vizItems   - An array of stac items which are to be rendered as markers
  @param {function} onSelectVizItem  - function to execute when the marker is clicked . will provide vizItemId as a parameter to the callback
*/

// eslint-disable-next-line prettier/prettier
export const MarkerFeature = ({ vizItems, onSelectVizItem }) => {
  const { map } = useMapbox();
  const [markersVisible, setMarkersVisible] = useState(true);
  useEffect(() => {
    if (!map || !vizItems.length) return;

    const plottedMarkers = vizItems.map((item) => {
      const location = item.geometry.coordinates[0][0];
      const [lon, lat] = location;
      const marker = addMarker(map, lon, lat);
      const mel = marker.getElement();
      mel.addEventListener('click', (e) => {
        onSelectVizItem && onSelectVizItem(item.id);
      });
      mel.style.display = markersVisible ? 'block' : 'none';
      return mel;
    });

    // clean-ups
    return () => {
      plottedMarkers.forEach((marker) => {
        marker.parentNode.removeChild(marker);
      });
    };
  }, [vizItems, map, onSelectVizItem, markersVisible]);

  useEffect(() => {
    if (!map) return;

    const threshold = 8;
    map.on('zoom', () => {
      const currentZoom = map.getZoom();
      if (currentZoom <= threshold) {
        setMarkersVisible(true);
      } else {
        setMarkersVisible(false);
      }
    });
  }, [map]);

  return null;
};

const addMarker = (map, longitude, latitude) => {
  const el = document.createElement('div');
  el.className = 'marker';
  const markerColor = '#34495E';
  el.innerHTML = getMarkerSVG(markerColor);
  let marker = new mapboxgl.Marker(el)
    .setLngLat([longitude, latitude])
    .addTo(map);
  return marker;
};

const getMarkerSVG = (color, strokeColor = '#000000') => {
  return `
        <svg fill="${color}" width="30px" height="30px" viewBox="-51.2 -51.2 614.40 614.40" xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round" stroke="${strokeColor}"
                stroke-width="10.24">
                <path
                    d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path>
            </g>
            <g id="SVGRepo_iconCarrier">
                <path
                    d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"></path>
            </g>
        </svg>`;
};
