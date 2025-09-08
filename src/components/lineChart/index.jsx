import { useEffect } from 'react';
import { useChart } from '../../context/chartContext';

export const LineChart = ({ datasets = [] }) => {
  const { chart } = useChart();
  const lineColors = ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56'];

  console.log('Rendering LineChart with datasets:', datasets);

  useEffect(() => {
    if (!chart) return;

    if (datasets.length === 0) {
      chart.data.labels = [];
      chart.data.datasets = [];
      chart.update();
      return;
    }

    const chartJsDatasets = datasets.slice(0, 2).map((dataset, index) => ({
      label: dataset.parameterName,
      data: dataset.data,
      borderColor: lineColors[index % lineColors.length],
      backgroundColor: `${lineColors[index % lineColors.length]}20`,
      yAxisID: index === 0 ? 'yLeft' : 'yRight',
    }));
    
    const chartJsScales = {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date'
        }
      },
      yLeft: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: datasets[0]?.units || 'Primary Axis',
        }
      }
    };

    if (datasets.length > 1) {
      chartJsScales.yRight = {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: datasets[1]?.units || 'Secondary Axis',
        },
        grid: {
          drawOnChartArea: false,
        },
      };
    }
    
    chart.data.labels = datasets[0].labels;
    chart.data.datasets = chartJsDatasets;
    chart.options.scales = chartJsScales;
    chart.options.interaction.mode = 'index';
    chart.options.interaction.intersect = false;
    
    chart.update();

  }, [chart, datasets]);

  return null;
};