import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpacityIcon from '@mui/icons-material/Opacity';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Popover from '@mui/material/Popover';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const LayerCard = ({
  dataset,
  index,
  onOpacityChange,
  onRemove,
  isDragging,
  isTopLayer,
  topRasterDataset,
}) => {
  const { id, name, type, opacity = 100 } = dataset;
  const [anchorEl, setAnchorEl] = useState(null);
  const [localOpacity, setLocalOpacity] = useState(opacity);

  const handleOpacityClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleOpacityClose = () => {
    setAnchorEl(null);
  };

  const handleSliderChange = (event, newValue) => {
    setLocalOpacity(newValue);
    onOpacityChange(id, newValue);
  };
  const formatNumber = (num) => {
    if (num === 0) return '0';
    const absNum = Math.abs(num);
    if (absNum >= 1e6 || absNum <= 1e-3) {
      return num.toExponential(2); // e.g., 1.23e6
    }
    return num.toLocaleString(); // 1,234, 12.34
  };



  const getStaticLegend = (dataset) => {
    const { type, stops } = dataset;
    switch (type) {
      case 'raster': {
        // Turn into gradient string with evenly spaced stops
        const gradient = `linear-gradient(to right, ${stops
          .map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`)
          .join(', ')})`;

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
            {/* Gradient bar */}
            <Box
              sx={{
                width: '100%',
                height: 12,
                background: gradient,
                borderRadius: 1,
              }}
            />

            {/* Min and Max labels below */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {formatNumber(dataset.rescale_values[0])}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {formatNumber(dataset.rescale_values[1])}
              </Typography>
            </Box>

          </Box>
        );
      }

      case 'feature': // For AQS
        return null;

      case 'point-cloud': {
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              width: '100%',
              alignItems: 'flex-start',
              padding: 1,
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: 70,
              }}
            >
              {[
                { color: 'red', position: 22, label: '0', width: 60 }, 
                { color: 'green', position: 82, label: '0.0127', width: 60 },
                { color: 'yellow', position: 142, label: '0.254', width: 60 },
                { color: 'blue', position: 202, label: '1.523', width: 50 },
              ].map((item) => (
                <Box key={item.label}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: item.position,
                      top: 40,
                      width: item.width,
                      height: 5,
                      backgroundColor: item.color,
                      border: '1px solid rgba(0,0,0,0.2)',
                    }}
                  />

                  <Typography
                    variant='caption'
                    sx={{
                      position: 'absolute',
                      left: item.position + 8,
                      top: 60,
                      fontSize: '0.65rem',
                      color: 'text.primary',
                      fontWeight: 'medium',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'left bottom',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              ))}

              <Typography
                variant='caption'
                sx={{
                  position: 'absolute',
                  left: 80,
                  top: 73,
                  fontSize: '0.55rem',
                  color: 'text.primary',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                Backscatter (km⁻¹ sr⁻¹)
              </Typography>
            </Box>
          </Box>
        );
      }

      case 'netcdf-2d': // For Tropess 
      {
        const gradient = `linear-gradient(to right, ${stops
          .map((c, i) => `${c} ${(i / (stops.length - 1)) * 100}%`)
          .join(', ')})`;
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
            {/* Gradient bar */}
            <Box
              sx={{
                width: '100%',
                height: 12,
                background: gradient,
                borderRadius: 1,
              }}
            />
            {/* Min and Max labels below */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {formatNumber(dataset.rescale_values[0])}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {formatNumber(dataset.rescale_values[1])}
              </Typography>
            </Box>
          </Box>
        );
      }

      default:
        return null;
    }
  };

  const open = Boolean(anchorEl);

  return (
    <Draggable draggableId={id || `dataset-${index}`} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          variant='outlined'
          sx={{
            mb: 1,
            opacity: isDragging || snapshot.isDragging ? 0.5 : 1,
            backgroundColor: snapshot.isDragging
              ? 'action.hover'
              : 'background.paper',
            transition: 'background-color 0.2s ease',
            border: isTopLayer ? '2px solid #2196f3' : '1px solid #e0e0e0',
          }}
        >
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box
                {...provided.dragHandleProps}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'grab',
                  color: 'text.secondary',
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <DragIndicatorIcon fontSize='small' />
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant='body2'
                  sx={{ fontWeight: 'medium' }}
                  noWrap
                >
                  {name}
                  {/* Show indicator for the top raster dataset */}
                  {type === 'raster' &&
                    topRasterDataset &&
                    dataset.id === topRasterDataset.id && (
                      <Typography
                        component='span'
                        sx={{
                          ml: 1,
                          fontSize: '0.7rem',
                          color: 'primary.main',
                          fontWeight: 'bold',
                        }}
                      >
                        (Active)
                      </Typography>
                    )}
                </Typography>
                {/* REMOVED: All type/position info text for ALL layer types */}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size='small'
                  onClick={handleOpacityClick}
                  sx={{
                    p: 0.5,
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  <OpacityIcon fontSize='small' />
                </IconButton>
                <Typography
                  variant='caption'
                  sx={{ fontSize: '0.75rem', minWidth: '35px' }}
                >
                  {localOpacity}%
                </Typography>
              </Box>

              <IconButton
                size='small'
                onClick={() => onRemove(id)}
                sx={{
                  p: 0.5,
                  color: 'error.main',
                  '&:hover': {
                    backgroundColor: 'error.light',
                    color: 'error.dark',
                  },
                }}
              >
                <DeleteIcon fontSize='small' />
              </IconButton>
            </Box>

            <Box sx={{ width: '100%' }}>{getStaticLegend(dataset)}</Box>

            <Popover
              open={open}
              anchorEl={anchorEl}
              onClose={handleOpacityClose}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'center',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'center',
              }}
            >
              <Box sx={{ p: 2, width: 200 }}>
                <Typography variant='body2' gutterBottom>
                  Opacity: {localOpacity}%
                </Typography>
                <Slider
                  value={localOpacity}
                  onChange={handleSliderChange}
                  aria-labelledby='opacity-slider'
                  min={0}
                  max={100}
                  size='small'
                />
              </Box>
            </Popover>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
};

export function RecordDetailView({
  record,
  layers,
  allActiveDatasets = [],
  allActiveLayers,
  onLayerOpacityChange,
  onLayerRemove,
  onLayerReorder,
  onClose,
}) {
  const [isDragging, setIsDragging] = useState(false);

  // Find the top-rendering raster dataset (last raster in the array)
  const topRasterDataset = [...allActiveDatasets]
    .reverse()
    .find((d) => d.type === 'raster');

  const handleDragStart = () => {
    setIsDragging(true);
  };

  // Simplified drag end handler that works with the reversed visual array
  const handleDragEnd = (result) => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

    // If dropped in the same position
    if (result.destination.index === result.source.index) {
      return;
    }

    // Handle reordering with reversed visual array
    if (onLayerReorder) {
      // Work with the reversed array for visual consistency
      const reversedDatasets = [...allActiveDatasets].reverse();
      const reorderedItems = Array.from(reversedDatasets);
      const [reorderedItem] = reorderedItems.splice(result.source.index, 1);
      reorderedItems.splice(result.destination.index, 0, reorderedItem);

      // Convert back to original order for the backend
      const finalOrder = reorderedItems.reverse();

      console.log(
        'Drag reorder from RecordDetailView:',
        finalOrder.map((item) => item.name)
      );
      onLayerReorder(finalOrder);
    }
  };

  const handleOpacityChange = (datasetId, opacity) => {
    if (onLayerOpacityChange) {
      onLayerOpacityChange(datasetId, opacity);
    }
  };

  const handleRemove = (datasetId) => {
    if (onLayerRemove) {
      onLayerRemove(datasetId);
    }
  };

  if (allActiveDatasets.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={4}
      sx={{
        mt: 2,
        borderRadius: 2,
        maxHeight: '320px',
        overflow: 'scroll',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          pb: 1,
          position: 'relative',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton
          aria-label='close'
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 4,
            top: 4,
            color: (theme) => theme.palette.grey[500],
          }}
          size='small'
        >
          <CloseIcon fontSize='small' />
        </IconButton>

        <Typography variant='subtitle1' sx={{ fontWeight: 'medium' }}>
          Active Datasets
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          Drag to reorder
        </Typography>
      </Box>

      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Droppable droppableId='datasets'>
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: 1.5,
                pt: 1,
              }}
            >
              {console.log('AllActive Layers:::', allActiveLayers)}
              {console.log('AllActive Datasets:::', allActiveDatasets)}

              {/* Handle datasets with multiple layers (like Tropess) vs single layer datasets */}
              {[...allActiveDatasets].reverse().map((dataset, datasetIndex) => {
                const layersForDataset = allActiveLayers[dataset.id];

                // If dataset has multiple layers (like Tropess), show each layer separately
                if (
                  layersForDataset &&
                  Array.isArray(layersForDataset) &&
                  layersForDataset.length > 1
                ) {
                  return layersForDataset.map((layer, layerIndex) => (
                    <LayerCard
                      key={`${dataset.id}-${layer.id || layerIndex}`}
                      dataset={{
                        ...dataset,
                        name: `${dataset.name} (Level ${layerIndex + 1})`, // Add level indicator
                        layerId: layer.id, // Store the individual layer ID
                      }}
                      index={datasetIndex * 10 + layerIndex} // Unique index for drag operations
                      onOpacityChange={handleOpacityChange}
                      onRemove={(id) => {
                        // For multi-layer datasets, remove the whole dataset when any layer is removed
                        handleRemove(dataset.id);
                      }}
                      isDragging={isDragging}
                      isTopLayer={datasetIndex === 0 && layerIndex === 0} // Top dataset's first layer
                      topRasterDataset={topRasterDataset}
                    />
                  ));
                } else {
                  // Single layer dataset - show as before
                  return (
                    <LayerCard
                      key={dataset.id}
                      dataset={dataset}
                      index={datasetIndex} // Use dataset index for drag operations
                      onOpacityChange={handleOpacityChange}
                      onRemove={handleRemove}
                      isDragging={isDragging}
                      isTopLayer={datasetIndex === 0} // Top of the visual list
                      topRasterDataset={topRasterDataset}
                    />
                  );
                }
              })}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
    </Paper>
  );
}

export { RecordDetailView as LayerDetailsView };