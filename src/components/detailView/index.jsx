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

  const getStaticLegend = (type) => {
    switch (type) {
      case 'raster': // For OMI (Updated Legend)
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: 12,
                // New gradient: Blue -> Green -> Yellow -> Red
                background:
                  'linear-gradient(to right, #2c7bb6, #abd9e9, #ffffbf, #fdae61, #d7191c)',
                borderRadius: 1,
              }}
            />
            <Typography
              variant='caption'
              sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
            >
              Low to High
            </Typography>
          </Box>
        );

      case 'feature': // For AQS
        return null;

      case 'point-cloud':
        const legendItems = [
          { color: 'red', label: '0 - 500' },
          { color: 'green', label: '500 - 10,000' },
          { color: 'yellow', label: '10,000 - 60,000' },
          { color: 'blue', label: '> 60,000' },
        ];
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 0.2,
            }}
          >
            {legendItems.map((item) => (
              <Box
                key={item.label}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.1 }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    backgroundColor: item.color,
                    borderRadius: '2px',
                  }}
                />
                <Typography
                  variant='caption'
                  sx={{ fontSize: '0.5rem', color: 'text.secondary' }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        );

      case 'netcdf-2d': // For Tropess
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              width: '100%',
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: 12,
                background: 'linear-gradient(to right, #FFFFFF, #B22222)',
                borderRadius: 1,
                border: '1px solid #ccc',
              }}
            />
            <Typography
              variant='caption'
              sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
            >
              Low to High
            </Typography>
          </Box>
        );

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
                  {type === 'raster' && topRasterDataset && dataset.id === topRasterDataset.id && (
                    <Typography component="span" sx={{ ml: 1, fontSize: '0.7rem', color: 'primary.main', fontWeight: 'bold' }}>
                      (Active)
                    </Typography>
                  )}
                </Typography>
                <Typography
                  variant='caption'
                  sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
                >
                  {type} • Position {index + 1} {isTopLayer ? '(Top)' : ''}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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

            <Box sx={{ width: '100%' }}>{getStaticLegend(type)}</Box>

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
  onLayersChange,
  onLayerOpacityChange,
  onLayerRemove,
  onLayerReorder,
  onClose,
}) {
  const [isDragging, setIsDragging] = useState(false);

  // Find the top-rendering raster dataset (last raster in the array)
  const topRasterDataset = [...allActiveDatasets].reverse().find(d => d.type === 'raster');

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

      console.log('Drag reorder from RecordDetailView:', finalOrder.map(item => item.name));
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
          {allActiveDatasets.length}{' '}
          {allActiveDatasets.length === 1 ? 'dataset' : 'datasets'} • Drag to
          reorder • Top items render on top
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
                if (layersForDataset && Array.isArray(layersForDataset) && layersForDataset.length > 1) {
                  return layersForDataset.map((layer, layerIndex) => (
                    <LayerCard
                      key={`${dataset.id}-${layer.id || layerIndex}`}
                      dataset={{
                        ...dataset,
                        name: `${dataset.name} (Level ${layerIndex + 1})`, // Add level indicator
                        layerId: layer.id // Store the individual layer ID
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