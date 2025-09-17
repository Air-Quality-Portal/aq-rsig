import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapbox } from '../../../context/mapContext';
import { HamburgerControl } from './hamburger';
import { MeasureDistanceControl } from './measureDistance';
import { ChangeUnitControl } from './changeUnit';
import { ClearMeasurementControl } from './clearMeasurement';
import { LayerVisibilityControl } from './layerVisibility';
import { HomeControl } from './home';
import { RestoreControl } from './restore';
import { MeasurementLayer } from '../measurementLayer';

import './index.css';
const scaleUnits = {
  KM: 'km',
  MILES: 'mi',
};

const DefaultMapControls = ({
  measureMode,
  onClickHamburger,
  onClickMeasureMode,
  onClickClearIcon,
  clearMeasurementIcon,
  mapScaleUnit,
  setMapScaleUnit,
  handleResetHome,
  handleResetToSelectedRegion,
  openDrawer,
}) => {
  const { map } = useMapbox();
  const customControlContainer = useRef();

  useEffect(() => {
    if (!map) return;

    const hamburgerControl = new HamburgerControl(onClickHamburger);
    const mapboxNavigation = new mapboxgl.NavigationControl({
      showCompass: false,
    });
    const layerVisibilityControl = new LayerVisibilityControl();
    const homeControl = new HomeControl(handleResetHome);
    const restoreControl = new RestoreControl(handleResetToSelectedRegion);

    const hamburgerControlElem = hamburgerControl.onAdd(map);
    // const homeControlElem = homeControl.onAdd(map);
    // const restoreControlElem = restoreControl.onAdd(map);
    const mapboxNavigationElem = mapboxNavigation.onAdd(map);
    // const layerVisibilityControlElem = layerVisibilityControl.onAdd(map);

    const mapboxCustomControlContainer = customControlContainer.current;
    mapboxCustomControlContainer.append(hamburgerControlElem);
    // mapboxCustomControlContainer.append(homeControlElem);
    // mapboxCustomControlContainer.append(restoreControlElem);
    mapboxCustomControlContainer.append(mapboxNavigationElem);
    // mapboxCustomControlContainer.append(layerVisibilityControlElem);

    return () => {
      // clean ups
      if (hamburgerControl) hamburgerControl.onRemove();
      if (mapboxNavigation) mapboxNavigation.onRemove();
      if (layerVisibilityControl) layerVisibilityControl.onRemove();
      if (homeControl) homeControl.onRemove();
      if (restoreControl) restoreControl.onRemove();
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const measurementControl = new MeasureDistanceControl(
      measureMode,
      onClickMeasureMode
    );

    if (measurementControl) {
      const mapboxCustomControlContainer = document.querySelector(
        '#mapbox-custom-controls'
      );
      const measurementControlElem = measurementControl.onAdd(map);
      mapboxCustomControlContainer.append(measurementControlElem);
    }

    return () => {
      // clean ups
      if (measurementControl) {
        measurementControl.onRemove();
      }
    };
  }, [map, measureMode]);

  useEffect(() => {
    if (!map) return;

    const changeUnitControl = new ChangeUnitControl(
      mapScaleUnit,
      setMapScaleUnit
    );

    const mapboxCustomControlContainer = document.querySelector(
      '#mapbox-custom-controls'
    );
    const changeUnitControlElem = changeUnitControl.onAdd(map);
    mapboxCustomControlContainer.append(changeUnitControlElem);

    return () => {
      // clean ups
      if (changeUnitControl) {
        changeUnitControl.onRemove();
      }
    };
  }, [map, mapScaleUnit, measureMode]);

  useEffect(() => {
    if (!map) return;

    const clearMeasurementControl = clearMeasurementIcon
      ? new ClearMeasurementControl(onClickClearIcon)
      : null;

    if (clearMeasurementIcon) {
      const mapboxCustomControlContainer = document.querySelector(
        '#mapbox-custom-controls'
      );
      const clearMeasurementControlElem = clearMeasurementControl.onAdd(map);
      mapboxCustomControlContainer.append(clearMeasurementControlElem);
    }

    return () => {
      // clean ups
      if (clearMeasurementControl && clearMeasurementIcon) {
        clearMeasurementControl.onRemove();
      }
    };
  }, [map, clearMeasurementIcon, measureMode]);

  useEffect(() => {
    const unit = mapScaleUnit === 'km' ? 'metric' : 'imperial';
    if (!map) return;
    const scaleControl = new mapboxgl.ScaleControl({
      maxWidth: 80,
      unit: unit,
    });

    if (scaleControl) {
      map.addControl(scaleControl);
    }

    return () => {
      // clean ups
      if (scaleControl) map.removeControl(scaleControl);
    };
  }, [map, mapScaleUnit, measureMode]);

  return (
    <div
      id='mapbox-custom-controls'
      ref={customControlContainer}
      style={{ right: openDrawer ? '20.4rem' : '0.5rem' }}
    ></div>
  );
};

export const MapControls = ({
  openDrawer,
  setOpenDrawer,
  handleResetHome,
  handleResetToSelectedRegion,
}) => {
  const [measureMode, setMeasureMode] = useState(false);
  const [clearMeasurementIcon, setClearMeasurementIcon] = useState(false);
  const [clearMeasurementLayer, setClearMeasurementLayer] = useState(false);
  const [mapScaleUnit, setMapScaleUnit] = useState(scaleUnits.MILES);
  return (
    <>
      <DefaultMapControls
        openDrawer={openDrawer}
        measureMode={measureMode}
        onClickHamburger={() => {
          setOpenDrawer((openDrawer) => !openDrawer);
        }}
        onClickMeasureMode={() => {
          setMeasureMode((measureMode) => !measureMode);
        }}
        onClickClearIcon={() => {
          setClearMeasurementLayer(true);
        }}
        clearMeasurementIcon={clearMeasurementIcon}
        mapScaleUnit={mapScaleUnit}
        setMapScaleUnit={setMapScaleUnit}
        handleResetHome={handleResetHome}
        handleResetToSelectedRegion={handleResetToSelectedRegion}
      />
      <MeasurementLayer
        measureMode={measureMode}
        setMeasureMode={setMeasureMode}
        setClearMeasurementIcon={setClearMeasurementIcon}
        clearMeasurementLayer={clearMeasurementLayer}
        setClearMeasurementLayer={setClearMeasurementLayer}
        mapScaleUnit={mapScaleUnit}
      />
    </>
  );
};
