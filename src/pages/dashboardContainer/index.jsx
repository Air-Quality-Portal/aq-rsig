import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DashboardContent } from '../dashboard/index.jsx';
import { AOIProvider } from '../../context/aoiContext';

export function DashboardContainer() {
  // get the query params
  const [searchParams] = useSearchParams();
  const [zoomLocation, setZoomLocation] = useState(
    searchParams.get('zoom-location') || []
  ); // let default zoom location be controlled by map component
  const [zoomLevel, setZoomLevel] = useState(
    searchParams.get('zoom-level') || null
  ); // let default zoom level be controlled by map component
  const [loadingData, setLoadingData] = useState(false);

  return (
    <AOIProvider>
      <DashboardContent
        zoomLocation={zoomLocation}
        zoomLevel={zoomLevel}
        setZoomLocation={setZoomLocation}
        setZoomLevel={setZoomLevel}
        loadingData={loadingData}
      />
    </AOIProvider>
  );
}
