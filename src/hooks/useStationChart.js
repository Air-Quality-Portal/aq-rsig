import { useState, useCallback } from 'react';

// (Your fetchStationTimeSeries and processTimeseriesForChartJs functions go here)
export async function fetchStationTimeSeries(stationCode) {
  const timeseriesUrl = `https://dev.openveda.cloud/api/features/collections/public.aqs_sites_gases/items?station_code=${stationCode}`;
  const response = await fetch(timeseriesUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

export function processTimeseriesForChartJs(geojsonData, stationCode, city) {
  if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
    return [];
  }
  const allDataPoints = geojsonData.features
    .map((feature) => {
      const { properties } = feature;
      const value = parseFloat(properties.value);
      return {
        date: new Date(properties.datetime),
        value: isNaN(value) ? null : value,
        parameter: properties.parameter,
        units: properties.units_of_measure,
      };
    })
    .sort((a, b) => a.date - b.date);

  const groupedByParameter = {};
  allDataPoints.forEach((point) => {
    if (!groupedByParameter[point.parameter]) {
      groupedByParameter[point.parameter] = [];
    }
    groupedByParameter[point.parameter].push(point);
  });

  const datasets = Object.keys(groupedByParameter)
    .map((param) => {
      const parameterData = groupedByParameter[param].filter(
        (p) => p.value !== null
      );
      if (parameterData.length === 0) return null;

      const data = parameterData.map((p) => p.value);
      const labels = parameterData.map((p) =>
        p.date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      );
      const units = parameterData[0]?.units || '';

      return {
        parameterName: param,
        data,
        labels,
        units,
      };
    })
    .filter(Boolean);

  return datasets;
}
// --- End of data processing functions ---


export function useStationChart() {
  const [selectedStation, setSelectedStation] = useState(null);
  const [chartDatasets, setChartDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const showStationChart = useCallback(async (stationFeature) => {
    if (!stationFeature?.properties) return;
    const station = {
      station_code: stationFeature.properties.station_code,
      city: stationFeature.properties.city,
    };
    setSelectedStation(station);
    setIsVisible(true);
    setIsLoading(true);
    setError(null);
    setChartDatasets([]);

    try {
      const timeseriesData = await fetchStationTimeSeries(station.station_code);
      const processedDatasets = processTimeseriesForChartJs(
        timeseriesData,
        station.station_code,
        station.city
      );
      setChartDatasets(processedDatasets);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hideStationChart = useCallback(() => {
    setSelectedStation(null);
    setChartDatasets([]);
    setError(null);
    setIsLoading(false);
    setIsVisible(false);
  }, []);

  return {
    selectedStation,
    chartDatasets,
    isLoading,
    error,
    showStationChart,
    hideStationChart,
    isVisible,
  };
}