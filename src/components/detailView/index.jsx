import React, { useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
// import CloseIcon from '@mui/icons-material/Close'; // No longer needed here
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import OpacityIcon from '@mui/icons-material/Opacity';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Popover from '@mui/material/Popover';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

import { StaticLegend } from './Legend'; 

const extractPressureLevel = (layerId) => {
  const match = layerId?.match(/-lev-([\d.]+)$/);
  return match ? parseFloat(match[1]) : null;
};

// --- 'formatNumber' and 'StaticLegend' components have been removed ---

const DatasetCard = ({
  dataset,
  index,
  layersForDataset,
  onOpacityChange,
  onLevelVisibilityChange,
  onRemove,
  isTopLayer,
}) => {
  const { id, name, opacity = 100, units } = dataset;
  const [opacityAnchorEl, setOpacityAnchorEl] = useState(null);
  const [levelsAnchorEl, setLevelsAnchorEl] = useState(null);
  const [previousOpacity, setPreviousOpacity] = useState(100);

  const handleOpacityClick = (event) => setOpacityAnchorEl(event.currentTarget);
  const handleOpacityClose = () => setOpacityAnchorEl(null);
  const handleLevelsMenuClick = (event) => setLevelsAnchorEl(event.currentTarget);
  const handleLevelsMenuClose = () => setLevelsAnchorEl(null);

  const handleSliderChange = (event, newValue) => {
    onOpacityChange(id, newValue);
  };

  const handleVisibilityToggle = () => {
    if (opacity > 0) {
      // Hide layer - store current opacity and set to 0
      setPreviousOpacity(opacity);
      onOpacityChange(id, 0);
    } else {
      // Show layer - restore previous opacity (or 100 if previous was also 0)
      onOpacityChange(id, previousOpacity > 0 ? previousOpacity : 100);
    }
  };

  const isVisible = opacity > 0;

  let pressureLevels = [];
  if (dataset.type === 'netcdf-2d') {
    if (layersForDataset && layersForDataset.length > 0) {
      pressureLevels = layersForDataset
        .map((layer) => extractPressureLevel(layer.id))
        .filter((level) => level !== null)
        .sort((a, b) => b - a);
    } else {
      pressureLevels = [250, 550, 850, 1000]; // Default levels if no layers are present
    }
  }

  const isOpacityOpen = Boolean(opacityAnchorEl);
  const isLevelsMenuOpen = Boolean(levelsAnchorEl);

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          variant='outlined'
          sx={{
            mb: 1,
            backgroundColor: snapshot.isDragging
              ? 'action.hover'
              : 'background.paper',
            border: isTopLayer ? '2px solid #2196f3' : '1px solid #e0e0e0',
          }}
        >
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box
                {...provided.dragHandleProps}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'grab',
                  color: 'text.secondary',
                  '&:active': { cursor: 'grabbing' },
                  mt: 0.25,
                }}
              >
                <DragIndicatorIcon fontSize='small' />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant='body2' sx={{ fontWeight: 'medium' }}>
                  {name}
                </Typography>
              </Box>
              <IconButton size='small' onClick={handleOpacityClick}>
                <OpacityIcon fontSize='small' />
              </IconButton>
              <IconButton size='small' onClick={handleVisibilityToggle}>
                {isVisible ? (
                  <VisibilityIcon fontSize='small' />
                ) : (
                  <VisibilityOffIcon fontSize='small' />
                )}
              </IconButton>
              <IconButton size='small' onClick={() => onRemove(id)}>
                <DeleteIcon fontSize='small' />
              </IconButton>
            </Box>
            <Box sx={{ pt: 1, pl: '32px' }}>
              {/* --- 2. NO CHANGE NEEDED HERE --- */}
              {/* This component call remains identical */}
              <StaticLegend dataset={dataset} />
              <Box
                sx={{
                  mt: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between', // Align items on the same row
                  gap: 1,
                }}
              >
                {units && (
                  <Typography
                    variant='caption'
                    sx={{
                      fontSize: '0.65rem', // Slightly smaller font size
                      color: 'text.secondary',
                      flexShrink: 1, // Allow text to shrink
                    }}
                  >
                    Units: {units}
                  </Typography>
                )}
                {pressureLevels.length > 0 && (
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={handleLevelsMenuClick}
                    endIcon={<ArrowDropDownIcon />}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', py: '2px', px: '6px' }} // Smaller button and padding
                  >
                    Levels
                  </Button>
                )}
                <Menu
                  anchorEl={levelsAnchorEl}
                  open={isLevelsMenuOpen}
                  onClose={handleLevelsMenuClose}
                  PaperProps={{
                    style: {
                      maxHeight: 200, // Limit height
                    },
                  }}
                >
                  {pressureLevels.map((level) => {
                    const isVisible =
                      dataset.levelVisibility?.[level] ?? true;
                    return (
                      <MenuItem
                        key={level}
                        onClick={() => onLevelVisibilityChange(id, level)}
                        dense // Make menu items denser
                      >
                        <Checkbox checked={isVisible} size='small' />
                        <ListItemText primary={`${level} hPa`} sx={{ fontSize: '0.8rem' }} /> {/* Smaller text in menu */}
                      </MenuItem>
                    );
                  })}
                </Menu>
              </Box>
            </Box>
            <Popover
              open={isOpacityOpen}
              anchorEl={opacityAnchorEl}
              onClose={handleOpacityClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Box sx={{ p: 2, width: 200 }}>
                <Typography>Opacity: {Math.round(opacity)}%</Typography>
                <Slider value={opacity} onChange={handleSliderChange} />
              </Box>
            </Popover>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
};

export function RecordDetailView({
  allActiveDatasets = [],
  allActiveLayers,
  onLayerOpacityChange,
  onLevelVisibilityChange,
  onLayerRemove,
  onLayerReorder,
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnd = (result) => {
    setIsDragging(false);
    if (
      !result.destination ||
      result.destination.index === result.source.index
    ) {
      return;
    }

    if (onLayerReorder) {
      const reversedDatasets = [...allActiveDatasets].reverse();
      const [reorderedItem] = reversedDatasets.splice(result.source.index, 1);
      reversedDatasets.splice(result.destination.index, 0, reorderedItem);
      onLayerReorder(reversedDatasets.reverse());
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
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          pb: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant='h6'>Active Datasets</Typography>
        <Typography variant='caption' color='text.secondary'>
          Drag to reorder layers
        </Typography>
      </Box>
      <DragDropContext
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
      >
        <Droppable droppableId='datasets'>
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={{ flex: 1, overflowY: 'auto', p: 1.5, pt: 1 }}
            >
              {[...allActiveDatasets].reverse().map((dataset, index) => {
                const layersForDataset = allActiveLayers[dataset.id] || [];
                return (
                  <DatasetCard
                    key={dataset.id}
                    dataset={dataset}
                    index={index}
                    layersForDataset={layersForDataset}
                    onOpacityChange={onLayerOpacityChange}
                    onLevelVisibilityChange={onLevelVisibilityChange}
                    onRemove={onLayerRemove}
                    isTopLayer={index === 0}
                  />
                );
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