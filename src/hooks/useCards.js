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
  fetchStatisticsSummary,
  fetchDetectionsRequest,
  startDetectionRequest,
  fetchDetectionTaskStatusRequest,
} from '../services/api';
import { getFallbackImageUrl, toNullableNumber } from '../utils/mapHelpers';
import { STATUS } from '../constants/status';

export { STATUS };

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
  const [stats, setStats] = useState({ totalProjects: 0, avgTileBuildMs: null, avgDetectMs: null });
  const [statsLoading, setStatsLoading] = useState(false);
  const [detectLoading, setDetectLoading] = useState({});
  const [detectProgress, setDetectProgress] = useState({});
  const [detectError, setDetectError] = useState(null);

  const selectedCard = imageCards.find(c => c.uuid === selectedUuid) ?? null;

  const loadStatistics = async ({ totalProjects } = {}) => {
    const token = localStorage.getItem('authToken');
    setStatsLoading(true);
    try {
      const data = await fetchStatisticsSummary(token);
      setStats(prev => ({
        totalProjects: Number.isFinite(Number(totalProjects)) ? Number(totalProjects) : prev.totalProjects,
        avgTileBuildMs: toNullableNumber(data.avg_tile_time),
        avgDetectMs: toNullableNumber(data.avg_detect_time),
      }));
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setStatsLoading(false);
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
      setTotalCards(prev => Math.max(prev - 1, 0));
      setStats(prev => ({ ...prev, totalProjects: Math.max((prev.totalProjects || 0) - 1, 0) }));
      await loadStatistics();
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
          let detectionData = { exists: false, detections: [], detectionsTotal: 0 };
          try {
            detectionData = await fetchDetectionsRequest(item.uuid, token);
          } catch (error) {
            console.error('Ошибка проверки предразметки:', error);
          }
          try {
            manifestData = await fetchManifest(item.uuid, token);
            if (manifestData) previewUrl = await fetchTilePreviewUrl(item.uuid, token);
          } catch (err) {
            console.error('Manifest/preview error:', err.message);
          }
          const status = detectionData.exists
            ? STATUS.PROCESSED
            : manifestData
              ? STATUS.NOT_ANNOTATED
              : STATUS.LOADING;
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
            status,
            tileJobId: null,
            tileManifest: manifestData,
            previewUrl: previewUrl || null,
            detections: detectionData.detections,
            detectionsTotal: detectionData.detectionsTotal,
            tileBuildMs: item.tile_build_ms ?? null,
            detectMs: item.detect_ms ?? null,
          };
        })
      );
      setImageCards(cardsWithPreviews);
      setStats(prev => ({ ...prev, totalProjects: data.total }));
      localStorage.setItem('imageCards', JSON.stringify(data.items));
      setSelectedUuid(cardsWithPreviews.length > 0 ? cardsWithPreviews[0].uuid : null);
      await loadStatistics({ totalProjects: data.total });
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
        status: STATUS.UPLOADED_NO_TILES, quality: '—',
        isLoading: true, tileJobId: null, tileManifest: null,
        detections: [], detectionsTotal: 0,
      };
      setImageCards(prev => [newCard, ...prev]);
      setTotalCards(prev => prev + 1);
      setStats(prev => ({ ...prev, totalProjects: prev.totalProjects + 1 }));
      setSelectedUuid(result.uuid);
      message.success('Файл успешно загружен!');
      setIsModalVisible(false);
      setLoading(false);
      const uuid = result.uuid;
      const tileBuildStartedAt = Date.now();
      setImageCards(prev => prev.map(c => c.uuid === uuid ? { ...c, status: STATUS.PREPARING } : c));
      const jobId = await startTileBuildRequest(uuid, token);
      setImageCards(prev => prev.map(c => c.uuid === uuid ? { ...c, tileJobId: jobId } : c));
      const manifest = await pollTileStatusUntilReady(jobId, { abortFlag: { aborted: false } });
      await loadStatistics();
      const elapsedTileBuildMs = Date.now() - tileBuildStartedAt;
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid
          ? {
            ...c,
            status: STATUS.NOT_ANNOTATED,
            tileManifest: manifest,
            previewUrl: manifest.previewUrl || getFallbackImageUrl(),
            isLoading: false,
            tileBuildMs: elapsedTileBuildMs,
          }
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
    const token = localStorage.getItem('authToken');
    fetchDetectionsRequest(uuid, token)
      .then(({ exists, detections, detectionsTotal }) => {
        setImageCards(prev => prev.map(c =>
          c.uuid === uuid
            ? {
              ...c,
              detections,
              detectionsTotal,
              status: exists ? STATUS.PROCESSED : c.status,
            }
            : c
        ));
      })
      .catch((error) => {
        console.error('Ошибка загрузки предразметки:', error);
        setImageCards(prev => prev.map(c =>
          c.uuid === uuid ? { ...c, detectionsTotal: 0, detections: [] } : c
        ));
      });
  };

  const pollDetectStatusUntilReady = async (jobId, opts = {}) => {
    const token = localStorage.getItem('authToken');
    const {
      intervalMs = 1000,
      timeoutMs = 100 * 60 * 1000,
      abortFlag = { aborted: false },
      onProgress,
    } = opts;
    const startedAt = Date.now();
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const setProgress = (value) => {
      const progress = Number(value);
      if (!Number.isFinite(progress)) return;
      onProgress?.(Math.min(100, Math.max(0, Math.round(progress))));
    };

    while (true) {
      if (abortFlag?.aborted) throw new Error('Опрос предразметки прерван');
      if (Date.now() - startedAt > timeoutMs) throw new Error('Таймаут ожидания предразметки');

      const data = await fetchDetectionTaskStatusRequest(jobId, token);
      setProgress(data.progress_percent);
      if (data.status === 'completed') {
        setProgress(100);
        return data;
      }
      if (data.status === 'failed') throw new Error('Задача предразметки завершилась ошибкой');
      await sleep(intervalMs);
    }
  };

  const handleDetectClick = async (uuid) => {
    setDetectLoading(prev => ({ ...prev, [uuid]: true }));
    setDetectProgress(prev => ({ ...prev, [uuid]: 0 }));
    setDetectError(null);
    const token = localStorage.getItem('authToken');
    const startedAt = Date.now();

    try {
      const result = await startDetectionRequest(uuid, token);
      const manifest = await pollDetectStatusUntilReady(result.task_id, {
        abortFlag: { aborted: false },
        onProgress: progress => setDetectProgress(prev => ({ ...prev, [uuid]: progress })),
      });
      const elapsedDetectMs = Date.now() - startedAt;
      const detectionResponse = await fetchDetectionsRequest(uuid, token);

      setImageCards(prev => prev.map(c =>
        c.uuid === uuid
          ? {
            ...c,
            status: STATUS.PROCESSED,
            detectionsTotal: manifest.result?.detections_total ?? detectionResponse.detectionsTotal,
            detectMs: elapsedDetectMs,
            detections: detectionResponse.detections,
          }
          : c
      ));
      await loadStatistics();
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Ошибка предразметки:', error);
      setDetectError(error.message);
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid ? { ...c, status: STATUS.DETECT_ERROR, detectionsTotal: 0 } : c
      ));
      message.error(error.message || 'Не удалось выполнить предразметку');
    } finally {
      setDetectLoading(prev => {
        const next = { ...prev };
        delete next[uuid];
        return next;
      });
      setDetectProgress(prev => {
        const next = { ...prev };
        delete next[uuid];
        return next;
      });
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
    imageCards, setImageCards, selectedUuid, selectedCard,
    loading, isLoading, deleting, stats, statsLoading, detectLoading, detectProgress, detectError,
    currentPage, totalCards, itemsPerPage, setItemsPerPage,
    deleteImage, uploadToServer, handleCardClick, handlePageChange, handleDetectClick,
  };
};

export default useCards;
