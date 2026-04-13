// src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Layout, ConfigProvider, message } from 'antd';
import ru from 'antd/lib/locale/ru_RU';
import 'antd/dist/antd.css';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import TileImage from 'ol/source/TileImage';
import ImageStatic from 'ol/source/ImageStatic';
import TileGrid from 'ol/tilegrid/TileGrid';
import Projection from 'ol/proj/Projection';
import { ScaleLine, FullScreen, Zoom } from 'ol/control';
import 'ol/ol.css';

import AppHeader from './components/AppHeader';
import CardSidebar from './components/CardSidebar';
import MapArea from './components/MapArea';
import UploadModal from './components/UploadModal';

import {
  deleteImageRequest,
  fetchTilePreviewUrl,
  fetchCardsMetadata,
  fetchManifest,
  uploadImageRequest,
  startTileBuildRequest,
  fetchTileStatusRequest,
} from './services/api';
import { getMaxZoomFromLevels, getDimsFromLevels, getFallbackImageUrl, viewFit } from './utils/mapHelpers';

const { Content } = Layout;

const App = ({ history }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [imageCards, setImageCards] = useState([]);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [defaultImageLayer, setDefaultImageLayer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTilesLoading, setIsTilesLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [deleting, setDeleting] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const selectedCard = imageCards.find(c => c.uuid === selectedUuid) ?? null;

  const destroyMap = () => {
    if (mapRef.current) {
      mapRef.current.setTarget(null);
      mapRef.current = null;
    }
    if (defaultImageLayer) {
      setDefaultImageLayer(null);
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
    map.addLayer(new ImageLayer({ source: new ImageStatic({ url: imageUrl, projection, imageExtent: extent }) }));
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
      projection, tileGrid,
      tileUrlFunction: (tileCoord) => {
        if (!tileCoord) return undefined;
        const [z, x, y] = tileCoord;
        return `/tiles/${tilesUuid}/${z}/${y}/${x}`;
      },
      tileLoadFunction: (tile, src) => {
        const token = localStorage.getItem('authToken');
        if (!token) { tile.setState(3); return; }
        fetch(src, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.blob(); })
          .then(blob => { const img = new Image(); img.src = URL.createObjectURL(blob); tile.setImage(img); })
          .catch(() => tile.setState(3));
      },
      wrapX: false, crossOrigin: 'anonymous',
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

  const handleLogout = async () => {
    try {
      localStorage.removeItem('authToken');
      destroyMap();
      history.push('/login');
    } catch (err) {
      console.error('Ошибка при выходе:', err);
      message.error('Не удалось выйти из системы');
    }
  };

  const deleteImage = async (uuid) => {
    setDeleting(uuid);
    const token = localStorage.getItem('authToken');
    try {
      await deleteImageRequest(uuid, token);
      setImageCards(prev => {
        const next = prev.filter(c => c.uuid !== uuid);
        if (selectedUuid === uuid) setSelectedUuid(next.length > 0 ? next[0].uuid : null);
        return next;
      });
      setCurrentPage(prev => Math.ceil((imageCards.length - 1) / itemsPerPage) || 1);
      message.success('Изображение успешно удалено');
    } catch (error) {
      message.error(error.message);
    } finally {
      setDeleting(null);
    }
  };

  const load_all_cards = async () => {
    const token = localStorage.getItem('authToken');
    setIsLoading(true);
    try {
      const data = await fetchCardsMetadata(token, currentPage, itemsPerPage);
      console.log('Полученные карточки:', data.items);
      setTotalCards(data.total);
      const cardsWithPreviews = await Promise.all(
        data.items.map(async (item) => {
          let manifestData = null;
          let previewUrl = null;
          try {
            manifestData = await fetchManifest(item.uuid, token);
            if (manifestData) previewUrl = await fetchTilePreviewUrl(item.uuid, token);
          } catch (err) {
            console.error('Manifest/preview error:', err.message);
          }
          const sizeInMB = item.size_bytes ? (item.size_bytes / (1024 * 1024)).toFixed(2) : '—';
          return {
            uuid: item.uuid, name: item.name,
            date: item.last_updated ? new Date(item.last_updated).toLocaleDateString() : 'Не указано',
            format: item.format, size: `${sizeInMB} MB`,
            width: item.width, height: item.height,
            dimensions: `${item.height} × ${item.width} px`,
            quality: '—', status: 'Разбито на тайлы',
            tileJobId: null, tileManifest: manifestData, previewUrl: previewUrl || null,
          };
        })
      );
      setImageCards(cardsWithPreviews);
      localStorage.setItem('imageCards', JSON.stringify(data.items));
      setTotalCards(data.total);
      setSelectedUuid(cardsWithPreviews.length > 0 ? cardsWithPreviews[0].uuid : null);
    } catch (error) {
      console.error('Ошибка загрузки карточек:', error);
      message.error(`Не удалось загрузить файл: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const pollTileStatusUntilReady = async (jobId, opts = {}) => {
    const token = localStorage.getItem('authToken');
    const { intervalMs = 1000, timeoutMs = 10 * 60 * 1000, abortFlag = { aborted: false } } = opts;
    const startedAt = Date.now();
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
      if (abortFlag?.aborted) throw new Error('Опрос тайлов прерван');
      if (Date.now() - startedAt > timeoutMs) throw new Error('Таймаут ожидания готовности тайлов');
      try {
        const data = await fetchTileStatusRequest(jobId, token);
        console.log('Данные ответа:', JSON.stringify(data, null, 2));
        if (data?.levels && data?.uuid) {
          let previewUrl = await fetchTilePreviewUrl(data.uuid, token).catch(() => null);
          if (!previewUrl) previewUrl = getFallbackImageUrl();
          return { ...data, previewUrl };
        }
        await sleep(intervalMs);
      } catch (error) {
        setIsTilesLoading(false);
        throw error;
      }
    }
  };

  const uploadToServer = async (file) => {
    const token = localStorage.getItem('authToken');
    setLoading(true);
    try {
      const result = await uploadImageRequest(file, token);
      const sizeInMB = result.size_bytes ? (result.size_bytes / (1024 * 1024)).toFixed(2) : '—';
      const newCard = {
        uuid: result.uuid, name: result.name,
        date: result.last_updated ? new Date(result.last_updated).toLocaleDateString() : 'Не указано',
        format: result.format, size: `${sizeInMB} MB`,
        height: result.height, width: result.width,
        dimensions: `${result.height} × ${result.width} px`,
        status: 'Загружено (без тайлов)', quality: '—',
        isLoading: true, tileJobId: null, tileManifest: null,
      };
      setImageCards(prev => [newCard, ...prev]);
      setSelectedUuid(result.uuid);
      message.success('Файл успешно загружен!');
      setIsModalVisible(false);
      setLoading(false);
      const uuid = result.uuid;
      setImageCards(prev => prev.map(c => c.uuid === uuid ? { ...c, status: 'Процесс разбивания на тайлы' } : c));
      const jobId = await startTileBuildRequest(uuid, token);
      setImageCards(prev => prev.map(c => c.uuid === uuid ? { ...c, tileJobId: jobId } : c));
      const manifest = await pollTileStatusUntilReady(jobId, { abortFlag: { aborted: false } });
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid ? { ...c, status: 'Тайлы готовы', tileManifest: manifest, previewUrl: manifest.previewUrl || getFallbackImageUrl(), isLoading: false } : c
      ));
      setTilesLayer(manifest.uuid, manifest.levels, 256);
      setIsTilesLoading(false);
      setCurrentPage(1);
      setSelectedUuid(result.uuid);
    } catch (e) {
      console.error(e);
      message.error(`Не удалось загрузить файл: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTileCardClick = (uuid) => {
    setSelectedUuid(uuid);
    const card = imageCards.find(c => c.uuid === uuid);
    if (card?.tileManifest?.levels) {
      const { width, height } = getDimsFromLevels(card.tileManifest.levels);
      setPreviewImageLayer(card.previewUrl || getFallbackImageUrl(), width, height);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedUuid(null);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) uploadToServer(file);
  };

  useEffect(() => {
    if (!selectedCard) return destroyMap();
    if (selectedCard.tileManifest?.levels && selectedCard.tileManifest?.uuid) {
      setTilesLayer(selectedCard.tileManifest.uuid, selectedCard.tileManifest.levels);
    } else if (selectedCard.imageUrl) {
      const w = Number(selectedCard.width) || 1024;
      const h = Number(selectedCard.height) || 768;
      setPreviewImageLayer(selectedCard.imageUrl, w, h);
    }
  }, [selectedUuid]);

  useEffect(() => {
    const totalPages = Math.ceil(totalCards / itemsPerPage);
    if (currentPage > totalPages) setCurrentPage(totalPages || 1);
  }, [totalCards, itemsPerPage, currentPage]);

  useEffect(() => { load_all_cards(); }, []);
  useEffect(() => { load_all_cards(); }, [currentPage]);

  useEffect(() => {
    const savedCards = localStorage.getItem('imageCards');
    const savedPage = localStorage.getItem('currentPage');
    if (savedCards) setImageCards(JSON.parse(savedCards));
    if (savedPage) setCurrentPage(Number(savedPage));
    const handleBeforeUnload = () => {
      localStorage.setItem('imageCards', JSON.stringify(imageCards));
      localStorage.setItem('currentPage', currentPage.toString());
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <ConfigProvider locale={ru}>
      <Layout style={{ height: '100vh' }}>
        <AppHeader onLogout={handleLogout} />
        <Layout>
          <CardSidebar
            imageCards={imageCards}
            selectedUuid={selectedUuid}
            onCardClick={handleTileCardClick}
            onDelete={deleteImage}
            deleting={deleting}
            isLoading={isLoading}
            currentPage={currentPage}
            totalCards={totalCards}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onPageSizeChange={setItemsPerPage}
            onUploadClick={() => setIsModalVisible(true)}
          />
          <Layout style={{ padding: '24px' }}>
            <Content>
              <MapArea
                selectedCard={selectedCard}
                mapContainerRef={mapContainerRef}
                isTilesLoading={isTilesLoading}
                onDrop={handleFileDrop}
              />
            </Content>
          </Layout>
        </Layout>
        <UploadModal
          visible={isModalVisible}
          loading={loading}
          onCancel={() => setIsModalVisible(false)}
          onUpload={uploadToServer}
          onDrop={handleFileDrop}
        />
      </Layout>
    </ConfigProvider>
  );
};

export default App;
