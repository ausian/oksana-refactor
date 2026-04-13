import { useState, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import TileImage from 'ol/source/TileImage';
import ImageStatic from 'ol/source/ImageStatic';
import TileGrid from 'ol/tilegrid/TileGrid';
import Projection from 'ol/proj/Projection';
import { ScaleLine, FullScreen, Zoom } from 'ol/control';
import { getMaxZoomFromLevels, getDimsFromLevels, viewFit } from '../utils/mapHelpers';

const useMap = () => {
  const [isTilesLoading, setIsTilesLoading] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const destroyMap = () => {
    if (mapRef.current) {
      mapRef.current.setTarget(null);
      mapRef.current = null;
    }
  };

  const setPreviewImageLayer = (imageUrl, width, height) => {
    destroyMap();
    const extent = [0, 0, width, height];
    const projection = new Projection({ code: 'IMAGE_PIXELS', units: 'pixels', extent });
    const map = new Map({
      target: mapContainerRef.current,
      layers: [],
      view: new View({ center: [width / 2, height / 2], zoom: 0, minZoom: 0, maxZoom: 24, projection }),
    });
    map.addControl(new ScaleLine());
    map.addControl(new FullScreen());
    map.addControl(new Zoom());
    map.addLayer(new ImageLayer({
      source: new ImageStatic({ url: imageUrl, projection, imageExtent: extent }),
    }));
    mapRef.current = map;
    viewFit(map, extent);
  };

  const setTilesLayer = (tilesUuid, levels, tileSize = 256) => {
    const container = mapContainerRef.current;
    if (!container) return;
    setIsTilesLoading(true);
    destroyMap();
    const { width, height } = getDimsFromLevels(levels);
    const extent = [0, 0, width, height];
    const maxZoom = getMaxZoomFromLevels(levels);
    const projection = new Projection({ code: 'TILES_PIXELS', units: 'pixels', extent });
    const resolutions = Array.from({ length: maxZoom + 1 }, (_, z) => Math.pow(2, maxZoom - z));
    const tileGrid = new TileGrid({ extent, tileSize, minZoom: 0, maxZoom, resolutions });
    const map = new Map({
      target: container,
      view: new View({ center: [width / 2, height / 2], zoom: 0, minZoom: 0, maxZoom, projection }),
      layers: [],
    });
    mapRef.current = map;
    viewFit(map, extent);
    const tileSource = new TileImage({
      projection,
      tileGrid,
      tileUrlFunction: (tileCoord) => {
        if (!tileCoord) return undefined;
        const [z, x, y] = tileCoord;
        return `/tiles/${tilesUuid}/${z}/${y}/${x}`;
      },
      tileLoadFunction: (tile, src) => {
        const token = localStorage.getItem('authToken');
        if (!token) { tile.setState(3); return; }
        fetch(src, { method: 'GET', headers: { Authorization: `Bearer ${token}` } })
          .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
          .then(blob => { const img = new Image(); img.src = URL.createObjectURL(blob); tile.setImage(img); })
          .catch(() => tile.setState(3));
      },
      wrapX: false,
      crossOrigin: 'anonymous',
    });
    const tilesLayer = new TileLayer({ source: tileSource, visible: false });
    map.addControl(new ScaleLine());
    map.addControl(new FullScreen());
    map.addControl(new Zoom());
    map.addLayer(tilesLayer);
    const checkTileState = () => {
      if (tileSource.getState() !== 'loading') {
        tilesLayer.setVisible(true);
        setIsTilesLoading(false);
      }
    };
    checkTileState();
    const listenerKey = tileSource.on('change', checkTileState);
    return () => { tileSource.un(listenerKey); map.removeLayer(tilesLayer); };
  };

  return { mapContainerRef, isTilesLoading, destroyMap, setPreviewImageLayer, setTilesLayer };
};

export default useMap;
