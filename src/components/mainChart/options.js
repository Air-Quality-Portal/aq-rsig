import 'chartjs-adapter-luxon';

export const ghgBlue = '#082A63';

export const options = {
  responsive: true,
  maintainAspectRatio: false,
  resizeDelay: 200,
  interaction: {
    intersect: false,
    mode: 'nearest',
    axis: 'x',
  },
  scales: {
    x: {
      title: {
        display: true,
      },
    },
    y: {
      title: {
        display: true,
      },
    },
  },
  layout: {
    padding: {
      top: 5,
      bottom: 5,
      left: 5,
      right: 15,
    },
  },
  stacked: false,
  hover: {
    mode: 'nearest',
    intersect: false,
  },
  plugins: {
    zoom: {
      zoom: {
        wheel: {
          enabled: true,
        },
        pinch: {
          enabled: true,
        },
        drag: {
          enabled: true,
        },
        mode: 'x',
      },
    },
    title: {
      display: true,
      padding: {
        top: 10,
        bottom: 20,
      },
      font: {
        size: 24,
        family: 'Inter',
      },
      color: ghgBlue,
    },
    legend: {
      display: true,
      position: 'top', // You can change the position to 'bottom', 'left', or 'right'
    },
    tooltip: {
      mode: 'nearest',
      intersect: false,
      backgroundColor: '#FFFFFF',
      titleColor: '#000',
      bodyColor: '#000',
      titleFontSize: 16,
      titleFontColor: '#0066ff',
      bodyFontColor: '#000',
      bodyFontSize: 14,
      displayColors: true,
      cornerRadius: 5,
      borderColor: '#DEDEDE',
      borderWidth: 1,
      padding: 8,
      caretSize: 0,
      boxPadding: 3,
    },
  },
};
