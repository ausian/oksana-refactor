import { useState, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import TileImage from 'ol/source/TileImage';
import ImageStatic from 'ol/source/ImageStatic';
import TileGrid from 'ol/tilegrid/TileGrid';
import Projection from 'ol/proj/Projection';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { Style, Stroke } from 'ol/style';
import { ScaleLine, FullScreen, Zoom, Rotate } from 'ol/control';
import { getMaxZoomFromLevels, getDimsFromLevels, viewFit } from '../utils/mapHelpers';

// Создаёт слой сетки поверх изображения.
// step — шаг линий в пикселях исходного изображения (по умолчанию 256).
const createGridLayer = (width, height, step = 256) => {
  const features = [];
  for (let x = step; x < width; x += step) {
    features.push(new Feature(new LineString([[x, 0], [x, height]])));
  }
  for (let y = step; y < height; y += step) {
    features.push(new Feature(new LineString([[0, y], [width, y]])));
  }
  return new VectorLayer({
    source: new VectorSource({ features }),
    style: new Style({
      stroke: new Stroke({ color: 'rgba(255,255,255,0.25)', width: 1 }),
    }),
    zIndex: 10,
  });
};

const useMap = () => {
  const [isTilesLoading, setIsTilesLoading] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileSourceCleanupRef = useRef(null);
  const pendingTileLoadsRef = useRef(0);

  const cleanupTileSourceListeners = () => {
    if (typeof tileSourceCleanupRef.current === 'function') {
      tileSourceCleanupRef.current();
      tileSourceCleanupRef.current = null;
    }
    pendingTileLoadsRef.current = 0;
  };

  const destroyMap = () => {
    cleanupTileSourceListeners();
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
    map.addControl(new Rotate());
    map.addLayer(new ImageLayer({
      source: new ImageStatic({ url: imageUrl, projection, imageExtent: extent }),
    }));
    map.addLayer(createGridLayer(width, height));
    mapRef.current = map;
    map.updateSize();
    viewFit(map, extent);
  };

  const setTilesLayer = (tilesUuid, levels, tileSize = 256) => {
    const container = mapContainerRef.current;
    if (!container) return;
    destroyMap();
    setIsTilesLoading(true);
    const { width, height } = getDimsFromLevels(levels);
    const extent = [0, 0, width, height];
    const maxZoom = getMaxZoomFromLevels(levels);
    const projection = new Projection({ code: 'TILES_PIXELS', units: 'pixels', extent });
    const resolutions = Array.from({ length: maxZoom + 1 }, (_, z) => Math.pow(2, maxZoom - z));
    const tileGrid = new TileGrid({ extent, tileSize, minZoom: 0, maxZoom, resolutions });
    const map = new Map({
      target: container,
      loadTilesWhileAnimating: true,
      loadTilesWhileInteracting: true,
      view: new View({ center: [width / 2, height / 2], zoom: 0, minZoom: 0, maxZoom, projection }),
      layers: [],
    });
    mapRef.current = map;
    map.updateSize();
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
          .then(blob => {
            const image = new Image();
            const objectUrl = URL.createObjectURL(blob);
            image.onload = () => {
              if (typeof tile.setImage === 'function') {
                tile.setImage(image);
              } else {
                tile.getImage().src = objectUrl;
              }
              URL.revokeObjectURL(objectUrl);
            };
            image.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              tile.setState(3);
            };
            image.src = objectUrl;
          })
          .catch(() => tile.setState(3));
      },
      wrapX: false,
    });
    const tilesLayer = new TileLayer({ source: tileSource, visible: false });
    map.addControl(new ScaleLine());
    map.addControl(new FullScreen());
    map.addControl(new Zoom());
    map.addControl(new Rotate());
    map.addLayer(tilesLayer);
    map.addLayer(createGridLayer(width, height));

    const handleTileLoadStart = () => {
      pendingTileLoadsRef.current += 1;
      setIsTilesLoading(true);
    };
    const handleTileLoadFinish = () => {
      pendingTileLoadsRef.current = Math.max(pendingTileLoadsRef.current - 1, 0);
      if (pendingTileLoadsRef.current === 0) {
        setIsTilesLoading(false);
        tilesLayer.setVisible(true);
      }
    };

    tileSource.on('tileloadstart', handleTileLoadStart);
    tileSource.on('tileloadend', handleTileLoadFinish);
    tileSource.on('tileloaderror', handleTileLoadFinish);

    tileSourceCleanupRef.current = () => {
      tileSource.un('tileloadstart', handleTileLoadStart);
      tileSource.un('tileloadend', handleTileLoadFinish);
      tileSource.un('tileloaderror', handleTileLoadFinish);
    };

    window.setTimeout(() => {
      if (pendingTileLoadsRef.current === 0) {
        tilesLayer.setVisible(true);
        setIsTilesLoading(false);
      }
    }, 0);
  };

  return { mapContainerRef, mapRef, isTilesLoading, destroyMap, setPreviewImageLayer, setTilesLayer };
};

export default useMap;
