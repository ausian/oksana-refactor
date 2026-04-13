import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  deleteImageRequest,
  fetchTilePreviewUrl,
  fetchCardsMetadata,
  fetchManifest,
  uploadImageRequest,
  startTileBuildRequest,
  fetchTileStatusRequest,
} from '../services/api';
import { getDimsFromLevels, getFallbackImageUrl } from '../utils/mapHelpers';

const useCards = ({ setPreviewImageLayer, setTilesLayer, destroyMap }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [imageCards, setImageCards] = useState([]);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [deleting, setDeleting] = useState(null);

  const selectedCard = imageCards.find(c => c.uuid === selectedUuid) ?? null;

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

  const loadAllCards = async () => {
    const token = localStorage.getItem('authToken');
    setIsLoading(true);
    try {
      const data = await fetchCardsMetadata(token, currentPage, itemsPerPage);
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
            uuid: item.uuid,
            name: item.name,
            date: item.last_updated ? new Date(item.last_updated).toLocaleDateString() : 'Не указано',
            format: item.format,
            size: `${sizeInMB} MB`,
            width: item.width,
            height: item.height,
            dimensions: `${item.height} × ${item.width} px`,
            quality: '—',
            status: 'Разбито на тайлы',
            tileJobId: null,
            tileManifest: manifestData,
            previewUrl: previewUrl || null,
          };
        })
      );
      setImageCards(cardsWithPreviews);
      localStorage.setItem('imageCards', JSON.stringify(data.items));
      setSelectedUuid(cardsWithPreviews.length > 0 ? cardsWithPreviews[0].uuid : null);
    } catch (error) {
      message.error(`Не удалось загрузить карточки: ${error.message}`);
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
      const data = await fetchTileStatusRequest(jobId, token);
      if (data?.levels && data?.uuid) {
        const previewUrl = await fetchTilePreviewUrl(data.uuid, token).catch(() => getFallbackImageUrl());
        return { ...data, previewUrl };
      }
      await sleep(intervalMs);
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
        c.uuid === uuid
          ? { ...c, status: 'Тайлы готовы', tileManifest: manifest, previewUrl: manifest.previewUrl || getFallbackImageUrl(), isLoading: false }
          : c
      ));
      setTilesLayer(manifest.uuid, manifest.levels, 256);
      setCurrentPage(1);
      setSelectedUuid(result.uuid);
    } catch (e) {
      message.error(`Не удалось загрузить файл: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (uuid) => {
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

  // Обновляем карту при смене выбранной карточки
  useEffect(() => {
    if (!selectedCard) { destroyMap(); return; }
    if (selectedCard.tileManifest?.levels && selectedCard.tileManifest?.uuid) {
      setTilesLayer(selectedCard.tileManifest.uuid, selectedCard.tileManifest.levels);
    } else if (selectedCard.imageUrl) {
      const w = Number(selectedCard.width) || 1024;
      const h = Number(selectedCard.height) || 768;
      setPreviewImageLayer(selectedCard.imageUrl, w, h);
    }
  }, [selectedUuid]);

  // Корректируем страницу при удалении
  useEffect(() => {
    const totalPages = Math.ceil(totalCards / itemsPerPage);
    if (currentPage > totalPages) setCurrentPage(totalPages || 1);
  }, [totalCards, itemsPerPage, currentPage]);

  // Загрузка при монтировании и смене страницы
  useEffect(() => { loadAllCards(); }, []);
  useEffect(() => { loadAllCards(); }, [currentPage]);

  // Сохранение/восстановление из localStorage
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

  return {
    isModalVisible, setIsModalVisible,
    imageCards, selectedUuid, selectedCard,
    loading, isLoading, deleting,
    currentPage, totalCards, itemsPerPage, setItemsPerPage,
    deleteImage, uploadToServer, handleCardClick, handlePageChange,
  };
};

export default useCards;
