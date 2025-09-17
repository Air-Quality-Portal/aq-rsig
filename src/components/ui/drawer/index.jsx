import { styled as styledmui, useTheme } from '@mui/material/styles';
import styled from 'styled-components';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Divider from '@mui/material/Divider';

import { DatasetGallery } from '../datasetGallery';

import { useEffect, useState } from 'react';

import './index.css';

const drawerWidth = '20rem';
const Main = styledmui('main', {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginRight: `-${drawerWidth}`,
  position: 'relative',
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  }),
}));

const DrawerHeader = styledmui('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-start',
}));

export function PersistentDrawerRight({
  open,
  setOpen,
  onLayerSelect,
  onRecordSelect,
  updateActiveDataset,
  selectedVizItems,
  vizItemMetaData,
  collectionId,
  metaDataTree,
  vizItemsMap,
  handleSelectedVizItems,
  hoveredVizItemId,
  setHoveredVizItemId,
  children,
}) {
  const theme = useTheme();

  const [selectedVizItemMetas, setSelectedVizItemMetas] = useState([]);
  const [location, setLocation] = useState('USA');
  const [numberOfVizItems, setNumberOfVizItems] = useState(0);

  const handleDrawerClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!vizItemMetaData || !selectedVizItems) return;
    if (selectedVizItems.length === 0) {
      setSelectedVizItemMetas([]);
      setLocation('USA');
      setNumberOfVizItems(0);
      return;
    }
  }, [vizItemMetaData, selectedVizItems]);

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Main open={open}>
        <DrawerHeader />
      </Main>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            height: 'fit-content',
            maxHeight: 'calc(100vh - var(--colorbar-height) - 10px)',
            marginTop: '5px',
            marginRight: '5px',
            borderRadius: '3px',
            boxSizing: 'border-box',
          },
        }}
        variant='persistent'
        anchor='right'
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            <ChevronRightIcon />
          </IconButton>
          <Typography variant='h6' sx={{ pl: 1 }}>
            Data Layers
          </Typography>
        </DrawerHeader>
        <Divider />

        <DatasetGallery
          onLayerSelect={onLayerSelect}
          onRecordSelect={onRecordSelect}
          updateActiveDataset={updateActiveDataset}
        />
      </Drawer>
    </Box>
  );
}
