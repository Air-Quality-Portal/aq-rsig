import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
} from 'react';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';

const MapboxContext = createContext();

const accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
const mapboxStyleBaseUrl = process.env.REACT_APP_MAPBOX_STYLE_URL;
const BASEMAP_STYLES_MAPBOX_ID =
  process.env.REACT_APP_BASEMAP_STYLES_MAPBOX_ID || 'cldu1cb8f00ds01p6gi583w1m';

export const MapboxProvider = ({ children }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const deckOverlay = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (map.current) return;

    const mapboxStyleUrl = 'mapbox://styles/mapbox/light-v10';

    mapboxgl.accessToken = accessToken;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapboxStyleUrl,
      center: [-98.5795, 39.8283],
      zoom: 3,
      options: {
        trackResize: true,
      },
    }).once('load', () => {
      window.map = map; // Expose for debugging
      window.MapboxOverlay = MapboxOverlay;

      deckOverlay.current = new MapboxOverlay({
        interleaved: true,
        layers: [],
      });
      window.deckOverlay = deckOverlay.current; // Expose for debugging
      map.current.addControl(deckOverlay.current);

      setIsInitialized(true);
    });
  }, []);

  return (
    <MapboxContext.Provider
      value={{
        map: map.current,
        deckOverlay: deckOverlay.current,
        isInitialized,
      }}
    >
      <div
        id='map'
        ref={mapContainer}
        style={{ width: '100%', height: '100%' }}
      />
      {children}
    </MapboxContext.Provider>
  );
};

export const useMapbox = () => useContext(MapboxContext);
