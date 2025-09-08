import React, { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Typography,
  Button,
  TextField,
  Box,
  Stack,
  Chip,
  Alert,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  RectangleOutlined as RectangleIcon,
  Gesture as PolygonIcon,
  Clear as ClearIcon,
  MyLocation as LocationIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Edit as CoordinatesIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useMapbox } from '../../../context/mapContext';

// Styled ToggleButton to match your design
const StyledToggleButton = styled(ToggleButton)({
  // Add any custom styles here if needed
});

const SpatialSubsetManager = ({ onSpatialSubsetChange, spatialSubset }) => {
  const [activeTool, setActiveTool] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [coordinateInput, setCoordinateInput] = useState({
    north: '',
    south: '',
    east: '',
    west: '',
  });
  const [errors, setErrors] = useState({});
  const [showCoordinates, setShowCoordinates] = useState(false);

  const mapContext = useMapbox();
  const drawControlRef = useRef(null);
  const currentPolygonRef = useRef(null);

  // Initialize drawing controls
  useEffect(() => {
    if (!mapContext?.map || typeof window === 'undefined') return;

    const initializeDrawControls = async () => {
      try {
        const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default;

        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: {},
          modes: {
            ...MapboxDraw.modes,
            simple_select: {
              ...MapboxDraw.modes.simple_select,
              dragMove() {}, // Disable dragging
            },
          },
        });

        mapContext.map.addControl(draw, 'top-right');
        drawControlRef.current = draw;

        // Handle draw events
        mapContext.map.on('draw.create', handleDrawCreate);
        mapContext.map.on('draw.update', handleDrawUpdate);
        mapContext.map.on('draw.delete', handleDrawDelete);

        return () => {
          if (mapContext.map && draw) {
            mapContext.map.off('draw.create', handleDrawCreate);
            mapContext.map.off('draw.update', handleDrawUpdate);
            mapContext.map.off('draw.delete', handleDrawDelete);
            mapContext.map.removeControl(draw);
          }
        };
      } catch (error) {
        console.error('Failed to load Mapbox Draw:', error);
      }
    };

    initializeDrawControls();
  }, [mapContext?.map]);

  // Update bounds when spatialSubset prop changes
  useEffect(() => {
    if (spatialSubset !== bounds) {
      setBounds(spatialSubset);
      if (spatialSubset) {
        setCoordinateInput({
          north: spatialSubset.north.toFixed(4),
          south: spatialSubset.south.toFixed(4),
          east: spatialSubset.east.toFixed(4),
          west: spatialSubset.west.toFixed(4),
        });
      } else {
        setCoordinateInput({ north: '', south: '', east: '', west: '' });
      }
    }
  }, [spatialSubset, bounds]);

  const handleDrawCreate = (event) => {
    const feature = event.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      const coordinates = feature.geometry.coordinates[0];
      const newBounds = calculateBounds(coordinates);
      setBounds(newBounds);
      onSpatialSubsetChange(newBounds);
      currentPolygonRef.current = feature.id;
      setActiveTool(null);
    }
  };

  const handleDrawUpdate = (event) => {
    const feature = event.features[0];
    if (feature && feature.geometry.type === 'Polygon') {
      const coordinates = feature.geometry.coordinates[0];
      const newBounds = calculateBounds(coordinates);
      setBounds(newBounds);
      onSpatialSubsetChange(newBounds);
    }
  };

  const handleDrawDelete = () => {
    setBounds(null);
    onSpatialSubsetChange(null);
    currentPolygonRef.current = null;
    setActiveTool(null);
  };

  const calculateBounds = (coordinates) => {
    const lngs = coordinates.map((coord) => coord[0]);
    const lats = coordinates.map((coord) => coord[1]);
    return {
      west: Math.min(...lngs),
      east: Math.max(...lngs),
      south: Math.min(...lats),
      north: Math.max(...lats),
    };
  };

  const handleToolChange = (event, newTool) => {
    if (newTool !== null) {
      setActiveTool(newTool);
      if (drawControlRef.current) {
        clearSpatialSubset();
        if (newTool === 'rectangle') {
          // For rectangle, we'll use polygon mode and create rectangles
          drawControlRef.current.changeMode('draw_polygon');
        } else if (newTool === 'polygon') {
          drawControlRef.current.changeMode('draw_polygon');
        }
      }
    } else {
      setActiveTool(null);
      if (drawControlRef.current) {
        drawControlRef.current.changeMode('simple_select');
      }
    }
  };

  const clearSpatialSubset = () => {
    if (drawControlRef.current) {
      drawControlRef.current.deleteAll();
    }
    setBounds(null);
    onSpatialSubsetChange(null);
    setCoordinateInput({ north: '', south: '', east: '', west: '' });
    setActiveTool(null);
    setErrors({});
    currentPolygonRef.current = null;
  };

  const validateCoordinates = (coords) => {
    const newErrors = {};
    const { north, south, east, west } = coords;

    if (!north || !south || !east || !west) {
      newErrors.required = 'All coordinates are required';
      return newErrors;
    }

    const northNum = parseFloat(north);
    const southNum = parseFloat(south);
    const eastNum = parseFloat(east);
    const westNum = parseFloat(west);

    if (
      isNaN(northNum) ||
      isNaN(southNum) ||
      isNaN(eastNum) ||
      isNaN(westNum)
    ) {
      newErrors.format = 'Coordinates must be valid numbers';
      return newErrors;
    }

    if (northNum < -90 || northNum > 90 || southNum < -90 || southNum > 90) {
      newErrors.latitude = 'Latitude must be between -90 and 90';
    }

    if (eastNum < -180 || eastNum > 180 || westNum < -180 || westNum > 180) {
      newErrors.longitude = 'Longitude must be between -180 and 180';
    }

    if (northNum <= southNum) {
      newErrors.northSouth = 'North must be greater than South';
    }

    if (eastNum <= westNum) {
      newErrors.eastWest = 'East must be greater than West';
    }

    return newErrors;
  };

  const applyCoordinates = () => {
    const newErrors = validateCoordinates(coordinateInput);
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const newBounds = {
        north: parseFloat(coordinateInput.north),
        south: parseFloat(coordinateInput.south),
        east: parseFloat(coordinateInput.east),
        west: parseFloat(coordinateInput.west),
      };

      // Clear existing drawings
      if (drawControlRef.current) {
        drawControlRef.current.deleteAll();
      }

      // Create rectangle polygon on map
      createRectangleOnMap(newBounds);

      setBounds(newBounds);
      onSpatialSubsetChange(newBounds);
      setShowCoordinates(false);
    }
  };

  const createRectangleOnMap = (bounds) => {
    if (drawControlRef.current) {
      const { north, south, east, west } = bounds;
      const rectangle = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [west, north],
              [east, north],
              [east, south],
              [west, south],
              [west, north],
            ],
          ],
        },
      };

      const featureIds = drawControlRef.current.add(rectangle);
      currentPolygonRef.current = featureIds[0];
    }
  };

  const zoomToCurrentBounds = () => {
    if (bounds && mapContext?.map) {
      mapContext.map.fitBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        {
          padding: 50,
          duration: 1000,
        }
      );
    }
  };

  const handleCoordinateChange = (field, value) => {
    setCoordinateInput((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear errors when user starts typing
    if (errors[field] || errors.required || errors.format) {
      setErrors({});
    }
  };

  const formatBoundsDisplay = (bounds) => {
    if (!bounds) return null;
    return `${Math.abs(bounds.west).toFixed(1)}°W to ${Math.abs(bounds.east).toFixed(1)}°W, ${bounds.south.toFixed(1)}°S to ${bounds.north.toFixed(1)}°N`;
  };

  return (
    <Paper
      elevation={1}
      sx={{
        borderRadius: 2,
        width: '100%',
      }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography variant='subtitle2' sx={{ fontWeight: 'medium' }}>
            Spatial Subset
          </Typography>
          {bounds && (
            <Chip
              label='Active'
              size='small'
              color='primary'
              variant='outlined'
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          )}
        </Box>

        {/* Current Selection Display */}
        {bounds && (
          <Alert
            severity='info'
            sx={{ mb: 1.5, fontSize: '0.8rem' }}
            action={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title='Zoom to selection'>
                  <IconButton size='small' onClick={zoomToCurrentBounds}>
                    <LocationIcon fontSize='small' />
                  </IconButton>
                </Tooltip>
                <Tooltip title='Clear selection'>
                  <IconButton size='small' onClick={clearSpatialSubset}>
                    <ClearIcon fontSize='small' />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          >
            <Typography variant='caption' sx={{ fontWeight: 'medium' }}>
              {formatBoundsDisplay(bounds)}
            </Typography>
          </Alert>
        )}

        {/* Tool Selection */}
        <Stack
          direction='row'
          spacing={1}
          alignItems='center'
          sx={{ justifyContent: 'space-between' }}
        >
          {/* Toggle group for the drawing tools */}
          <ToggleButtonGroup
            value={activeTool}
            exclusive
            onChange={handleToolChange}
            aria-label='spatial drawing tool'
            size='small'
          >
            <Tooltip title='Rectangle'>
              <StyledToggleButton value='rectangle' aria-label='rectangle tool'>
                <RectangleIcon />
              </StyledToggleButton>
            </Tooltip>
            <Tooltip title='Polygon'>
              <StyledToggleButton value='polygon' aria-label='polygon tool'>
                <PolygonIcon />
              </StyledToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          {/* Coordinates button */}
          <Tooltip title='Enter Coordinates'>
            <Button
              variant={showCoordinates ? 'contained' : 'outlined'}
              size='small'
              startIcon={<CoordinatesIcon />}
              onClick={() => setShowCoordinates(!showCoordinates)}
              sx={{ textTransform: 'none' }}
            >
              Coordinates
            </Button>
          </Tooltip>
        </Stack>

        {/* Drawing Instructions */}
        {activeTool && (
          <Alert severity='info' sx={{ mt: 1.5, fontSize: '0.8rem' }}>
            {activeTool === 'rectangle'
              ? 'Click and drag to draw a rectangle, or click to draw a polygon shaped like a rectangle.'
              : 'Click on the map to start drawing a polygon. Double-click to finish.'}
          </Alert>
        )}

        {/* Coordinate Input */}
        <Collapse in={showCoordinates}>
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant='body2' sx={{ mb: 1, fontWeight: 'medium' }}>
              Bounding Box Coordinates
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 1,
                mb: 1,
              }}
            >
              <TextField
                label='North (°)'
                size='small'
                value={coordinateInput.north}
                onChange={(e) =>
                  handleCoordinateChange('north', e.target.value)
                }
                error={
                  !!(
                    errors.latitude ||
                    errors.northSouth ||
                    errors.format ||
                    errors.required
                  )
                }
                placeholder='e.g., 49.5'
              />
              <TextField
                label='South (°)'
                size='small'
                value={coordinateInput.south}
                onChange={(e) =>
                  handleCoordinateChange('south', e.target.value)
                }
                error={
                  !!(
                    errors.latitude ||
                    errors.northSouth ||
                    errors.format ||
                    errors.required
                  )
                }
                placeholder='e.g., 24.5'
              />
              <TextField
                label='West (°)'
                size='small'
                value={coordinateInput.west}
                onChange={(e) => handleCoordinateChange('west', e.target.value)}
                error={
                  !!(
                    errors.longitude ||
                    errors.eastWest ||
                    errors.format ||
                    errors.required
                  )
                }
                placeholder='e.g., -125.0'
              />
              <TextField
                label='East (°)'
                size='small'
                value={coordinateInput.east}
                onChange={(e) => handleCoordinateChange('east', e.target.value)}
                error={
                  !!(
                    errors.longitude ||
                    errors.eastWest ||
                    errors.format ||
                    errors.required
                  )
                }
                placeholder='e.g., -66.5'
              />
            </Box>

            {Object.keys(errors).length > 0 && (
              <Alert severity='error' sx={{ mb: 1, fontSize: '0.8rem' }}>
                {Object.values(errors)[0]}
              </Alert>
            )}

            <Button
              variant='contained'
              fullWidth
              size='small'
              onClick={applyCoordinates}
              disabled={Object.keys(errors).length > 0}
            >
              Apply Coordinates
            </Button>
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
};

export default SpatialSubsetManager;
