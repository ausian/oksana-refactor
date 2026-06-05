import { useState, useEffect } from 'react';
import { message } from 'antd';
import {
  deleteImageRequest,
  fetchCardsMetadata,
  fetchManifestForCard,
  fetchStoredPreview,
  fetchDetectionSummaryRequest,
  uploadImageRequest,
  startTileBuildRequest,
  fetchTileStatusRequest,
  fetchStatisticsSummary,
  fetchDetectionsRequest,
  startDetectionRequest,
  fetchDetectionTaskStatusRequest,
  approveAnnotationsRequest,
  startFinalZipExportRequest,
  fetchFinalZipTaskStatusRequest,
} from '../services/api';
import { toNullableNumber } from '../utils/mapHelpers';
import { normalizePercent, normalizeDetectionStats } from '../utils/detection';
import { STATUS } from '../constants/status';

export { STATUS };

// Сводка детекции по карточке: классы, треки, метрики точности.
// Толерантная: при любой ошибке возвращает пустую статистику.
async function fetchDetectionsForCard(uuid, token) {
  const empty = {
    exists: false,
    detections: [],
    ...normalizeDetectionStats({}),
  };
  if (!uuid) return empty;
  try {
    const data = await fetchDetectionSummaryRequest(uuid, token);
    const stats = normalizeDetectionStats(data);
    return {
      exists: Boolean(data?.exists) && stats.detections_total > 0,
      detections: [],
      ...stats,
    };
  } catch (error) {
    console.error(`Ошибка проверки summary предразметки uuid=${uuid}:`, error);
    return empty;
  }
}

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
  const [tileBuildLoading, setTileBuildLoading] = useState({});
  const [tileBuildProgress, setTileBuildProgress] = useState({});
  const [isApproving, setIsApproving] = useState({});
  const [finalZipLoading, setFinalZipLoading] = useState({});
  const [finalZipProgress, setFinalZipProgress] = useState({});
  const [finalZipTaskId, setFinalZipTaskId] = useState(null);
  const [showAccuracyState, setShowAccuracyState] = useState({});

  const selectedCard = imageCards.find(c => c.uuid === selectedUuid) ?? null;

  // ---- Статусы карточки ----
  const getInitialStatusFromMetadata = (item) => {
    if (item.is_added_to_dataset) return STATUS.ADDED_TO_DATASET;
    if (item.is_on_review) return STATUS.PENDING_REVIEW;
    return STATUS.LOADING;
  };

  const getResolvedCardStatus = (card, { hasDetections, hasManifest }) => {
    if (card?.isAddedToDataset) return STATUS.ADDED_TO_DATASET;
    if (card?.isOnReview) return STATUS.PENDING_REVIEW;
    if (hasDetections) return STATUS.PROCESSED;
    if (hasManifest) return STATUS.NOT_ANNOTATED;
    return STATUS.LOADING;
  };

  // Единая логика percent + label для progress overlay на превью карточки.
  // Приоритет: детекция -> тайлинг -> final.zip.
  const getCardProgressOverlay = (card) => {
    if (!card?.uuid) return { percent: undefined, label: '' };
    const uuid = card.uuid;
    if (detectProgress?.[uuid] !== undefined) {
      return { percent: detectProgress[uuid], label: 'Предразметка изображения' };
    }
    if (tileBuildProgress?.[uuid] !== undefined) {
      return { percent: tileBuildProgress[uuid], label: 'Разбиение изображения на тайлы' };
    }
    if (finalZipProgress?.[uuid] !== undefined) {
      return { percent: finalZipProgress[uuid], label: 'Добавление в датасет' };
    }
    return { percent: undefined, label: '' };
  };

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

  // Фоновое обновление статусов карточек + manifest.
  const hydrateCardsStatusAndManifest = async (cards, token) => {
    await Promise.all(
      cards.map(async (card) => {
        const [detectionInfo, manifestData] = await Promise.all([
          fetchDetectionsForCard(card.uuid, token),
          fetchManifestForCard(card.uuid, token),
        ]);
        const hasDetections = detectionInfo.exists;
        const hasManifest = !!manifestData;
        setImageCards(prev => prev.map(c => {
          if (c.uuid !== card.uuid) return c;
          const nextStatus = getResolvedCardStatus(c, { hasDetections, hasManifest });
          return {
            ...c,
            status: nextStatus,
            detectionsTotal: detectionInfo.detections_total,
            detectionClasses: detectionInfo.classes,
            modelTracksTotal: detectionInfo.model_tracks_total,
            activeModelTracksTotal: detectionInfo.active_model_tracks_total,
            manualTracksTotal: detectionInfo.manual_tracks_total,
            deletedTracksTotal: detectionInfo.deleted_tracks_total,
            modelAccuracyPercent: detectionInfo.model_accuracy_percent,
            precision: detectionInfo.precision,
            recall: detectionInfo.recall,
            tileManifest: manifestData,
            isLoading: false,
          };
        }));
      })
    );
  };

  // Фоновая догрузка preview (из storage, не зависит от тайлов).
  const hydrateCardPreviews = async (cards, token) => {
    await Promise.all(
      cards.map(async (card) => {
        if (!card?.uuid) return;
        setImageCards(prev => prev.map(c =>
          c.uuid === card.uuid ? { ...c, previewLoading: true, previewError: null } : c
        ));
        const previewUrl = await fetchStoredPreview(card.uuid, token);
        setImageCards(prev => prev.map(c =>
          c.uuid === card.uuid
            ? { ...c, previewUrl, previewLoading: false, previewError: previewUrl ? null : 'Preview not found', isLoading: false }
            : c
        ));
      })
    );
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

  // Прогрессивная загрузка карточек:
  // 1) быстро показываем метаданные; 2) фоном гидрируем статусы/manifest; 3) фоном грузим preview.
  const load_all_cards = async () => {
    const token = localStorage.getItem('authToken');
    setIsLoading(true);
    try {
      const metaData = await fetchCardsMetadata(token, currentPage, itemsPerPage);
      const { items, total } = metaData;

      const baseCards = items.map((item) => {
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
          status: getInitialStatusFromMetadata(item),
          isOnReview: Boolean(item.is_on_review),
          isAddedToDataset: Boolean(item.is_added_to_dataset),
          quality: '—',
          tileJobId: null,
          tileManifest: null,
          previewUrl: null,
          previewLoading: true,
          previewError: null,
          detectionsTotal: 0,
          detections: [],
          detectionClasses: {},
          modelTracksTotal: 0,
          activeModelTracksTotal: 0,
          manualTracksTotal: 0,
          deletedTracksTotal: 0,
          modelAccuracyPercent: null,
          precision: null,
          recall: null,
          showModelAccuracy: false,
          isLoading: true,
          tileBuildMs: item.tile_build_ms ?? null,
          detectMs: item.detect_ms ?? null,
        };
      });

      setImageCards(baseCards);
      setTotalCards(total);
      setStats(prev => ({ ...prev, totalProjects: total }));
      setSelectedUuid(prev =>
        prev && baseCards.some(c => c.uuid === prev)
          ? prev
          : (baseCards.length > 0 ? baseCards[0].uuid : null)
      );

      loadStatistics({ totalProjects: total }).catch(error => {
        console.warn('Не удалось загрузить статистику:', error);
      });
      hydrateCardsStatusAndManifest(baseCards, token).catch(error => {
        console.warn('Не удалось обновить статусы карточек:', error);
      });
      hydrateCardPreviews(baseCards, token).catch(error => {
        console.warn('Не удалось догрузить preview карточек:', error);
      });
    } catch (error) {
      console.error('Ошибка загрузки карточек:', error);
      message.error(`Не удалось загрузить карточки: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const pollTileStatusUntilReady = async (jobId, opts = {}) => {
    const token = localStorage.getItem('authToken');
    const { intervalMs = 1000, timeoutMs = 100 * 60 * 1000, abortFlag = { aborted: false }, onProgress } = opts;
    const startedAt = Date.now();
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
      if (abortFlag?.aborted) throw new Error('Опрос тайлов прерван');
      if (Date.now() - startedAt > timeoutMs) throw new Error('Таймаут ожидания готовности тайлов');
      const data = await fetchTileStatusRequest(jobId, token);
      const progress = normalizePercent(data.progress_percent ?? data.percent ?? data.progress);
      if (progress !== null) onProgress?.(progress);
      if (data?.status === 'failed') throw new Error('Ошибка загрузки тайлов');
      if (data?.levels && data?.uuid) {
        onProgress?.(100);
        return data;
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
        previewUrl: null, previewLoading: true, previewError: null,
        detections: [], detectionsTotal: 0, detectionClasses: {},
      };
      setImageCards(prev => [newCard, ...prev]);
      hydrateCardPreviews([newCard], token).catch(error => {
        console.warn('Не удалось загрузить preview новой карточки:', error);
      });
      setTotalCards(prev => prev + 1);
      setStats(prev => ({ ...prev, totalProjects: prev.totalProjects + 1 }));
      setSelectedUuid(result.uuid);
      message.success('Файл успешно загружен!');
      setIsModalVisible(false);
      setLoading(false);

      const uuid = result.uuid;
      const tileBuildStartedAt = Date.now();
      setTileBuildLoading(prev => ({ ...prev, [uuid]: true }));
      setTileBuildProgress(prev => ({ ...prev, [uuid]: 0 }));
      setImageCards(prev => prev.map(c => c.uuid === uuid ? { ...c, status: STATUS.TILES_BUILDING } : c));

      const jobId = await startTileBuildRequest(uuid, token);
      setImageCards(prev => prev.map(c => c.uuid === uuid ? { ...c, tileJobId: jobId } : c));

      const manifest = await pollTileStatusUntilReady(jobId, {
        abortFlag: { aborted: false },
        onProgress: progress => setTileBuildProgress(prev => ({ ...prev, [uuid]: progress })),
      });
      await loadStatistics();
      const elapsedTileBuildMs = Date.now() - tileBuildStartedAt;
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid
          ? { ...c, status: STATUS.NOT_ANNOTATED, tileManifest: manifest, isLoading: false, tileBuildMs: elapsedTileBuildMs }
          : c
      ));
      setTilesLayer(manifest.uuid, manifest.levels, manifest.tile_size || 256);
      setTileBuildLoading(prev => { const next = { ...prev }; delete next[uuid]; return next; });
      setTileBuildProgress(prev => { const next = { ...prev }; delete next[uuid]; return next; });
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
            ? { ...c, detections, detectionsTotal, status: exists ? STATUS.PROCESSED : c.status }
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
    const { intervalMs = 1000, timeoutMs = 100 * 60 * 1000, abortFlag = { aborted: false }, onProgress } = opts;
    const startedAt = Date.now();
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
      if (abortFlag?.aborted) throw new Error('Опрос предразметки прерван');
      if (Date.now() - startedAt > timeoutMs) throw new Error('Таймаут ожидания предразметки');
      const data = await fetchDetectionTaskStatusRequest(jobId, token);
      const progress = normalizePercent(data.progress_percent ?? data.percent ?? data.progress);
      if (progress !== null) onProgress?.(progress);
      if (data.status === 'completed') {
        onProgress?.(100);
        return data;
      }
      if (data.status === 'failed') throw new Error('Задача предразметки завершилась ошибкой');
      await sleep(intervalMs);
    }
  };

  const handleDetectClick = async (uuid) => {
    if (detectLoading[uuid]) return;
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
      const freshSummary = await fetchDetectionsForCard(uuid, token);
      const detectionResponse = await fetchDetectionsRequest(uuid, token);

      setImageCards(prev => prev.map(c =>
        c.uuid === uuid
          ? {
            ...c,
            status: STATUS.PROCESSED,
            detectionsTotal: manifest.result?.detections_total ?? detectionResponse.detectionsTotal,
            detectMs: elapsedDetectMs,
            detections: detectionResponse.detections,
            modelTracksTotal: freshSummary.model_tracks_total,
            activeModelTracksTotal: freshSummary.active_model_tracks_total,
            manualTracksTotal: freshSummary.manual_tracks_total,
            deletedTracksTotal: freshSummary.deleted_tracks_total,
            modelAccuracyPercent: freshSummary.model_accuracy_percent,
            precision: freshSummary.precision,
            recall: freshSummary.recall,
            showModelAccuracy: false,
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
      setDetectLoading(prev => { const next = { ...prev }; delete next[uuid]; return next; });
      setDetectProgress(prev => { const next = { ...prev }; delete next[uuid]; return next; });
    }
  };

  // Показ метрик точности модели по карточке.
  const handleShowModelAccuracy = async (uuid) => {
    const token = localStorage.getItem('authToken');
    try {
      const summary = await fetchDetectionsForCard(uuid, token);
      if (
        summary.model_accuracy_percent === null ||
        summary.model_accuracy_percent === undefined ||
        !Number.isFinite(Number(summary.model_accuracy_percent))
      ) {
        message.warning('Недостаточно данных для определения точности');
        return;
      }
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid
          ? {
            ...c,
            modelTracksTotal: summary.model_tracks_total,
            activeModelTracksTotal: summary.active_model_tracks_total,
            manualTracksTotal: summary.manual_tracks_total,
            deletedTracksTotal: summary.deleted_tracks_total,
            modelAccuracyPercent: summary.model_accuracy_percent,
            precision: summary.precision,
            recall: summary.recall,
            showModelAccuracy: true,
          }
          : c
      ));
      setShowAccuracyState(prev => {
        const next = { ...prev, [uuid]: true };
        localStorage.setItem('showAccuracyState', JSON.stringify(next));
        return next;
      });
      message.success(
        `Точность модели: F1 = ${summary.model_accuracy_percent}%, ` +
        `Precision = ${summary.precision}%, Recall = ${summary.recall}%.`
      );
    } catch (error) {
      console.error('Ошибка определения точности:', error);
      message.error(error.message || 'Не удалось определить точность модели');
    }
  };

  const handleApproveClick = async (uuid) => {
    const card = imageCards.find(c => c.uuid === uuid);
    if (!card) { message.warning('Карточка не найдена'); return; }
    if (isApproving[uuid]) return;
    if (card.status !== STATUS.PROCESSED) {
      message.warning("Сначала нужно выполнить предразметку. Статус должен быть 'Обработано'");
      return;
    }
    setIsApproving(prev => ({ ...prev, [uuid]: true }));
    const token = localStorage.getItem('authToken');
    try {
      const data = await approveAnnotationsRequest(uuid, token);
      message.success(data.message || 'Разметка отправлена на проверку');
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid ? { ...c, status: STATUS.PENDING_REVIEW, isOnReview: true } : c
      ));
      await loadStatistics();
    } catch (error) {
      console.error('Ошибка апрува разметки:', error);
      message.error(error.message || 'Не удалось отправить разметку на проверку');
    } finally {
      setIsApproving(prev => { const next = { ...prev }; delete next[uuid]; return next; });
    }
  };

  const pollFinalZipTaskUntilReady = async (taskId, uuid, opts = {}) => {
    const token = localStorage.getItem('authToken');
    const { intervalMs = 1000, timeoutMs = 100 * 60 * 1000, abortFlag = { aborted: false }, onProgress } = opts;
    const startedAt = Date.now();
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (true) {
      if (abortFlag?.aborted) throw new Error('Опрос формирования final.zip прерван');
      if (Date.now() - startedAt > timeoutMs) throw new Error('Таймаут ожидания формирования final.zip');
      const data = await fetchFinalZipTaskStatusRequest(taskId, token);
      const progress = normalizePercent(data.progress);
      if (progress !== null) onProgress?.(progress);
      switch (data.status) {
        case 'processing': await sleep(intervalMs); break;
        case 'completed': onProgress?.(100); return data;
        case 'failed': throw new Error(data.error || data.detail || 'Формирование final.zip завершилось ошибкой');
        default:
          console.warn('Неизвестный статус формирования final.zip:', data.status);
          await sleep(intervalMs);
      }
    }
  };

  const handleFinalZipClick = async (uuid) => {
    const card = imageCards.find(c => c.uuid === uuid);
    if (!card || finalZipLoading[uuid]) return;
    if (card.status !== STATUS.PROCESSED) {
      message.warning('Сначала нужна обработанная и сохранённая разметка');
      return;
    }
    const token = localStorage.getItem('authToken');
    try {
      setFinalZipLoading(prev => ({ ...prev, [uuid]: true }));
      setFinalZipProgress(prev => ({ ...prev, [uuid]: 0 }));
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid ? { ...c, status: STATUS.FINAL_ZIP_BUILDING } : c
      ));
      const data = await startFinalZipExportRequest(uuid, token);
      if (!data.task_id) throw new Error('Backend не вернул task_id для формирования final.zip');
      setFinalZipTaskId(data.task_id);
      const result = await pollFinalZipTaskUntilReady(data.task_id, uuid, {
        onProgress: progress => setFinalZipProgress(prev => ({ ...prev, [uuid]: progress })),
      });
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid
          ? { ...c, status: STATUS.ADDED_TO_DATASET, isAddedToDataset: true, finalZipResult: result.result_details || result.result || result }
          : c
      ));
      message.success('Изображение добавлено в датасет');
    } catch (error) {
      console.error('Ошибка формирования final.zip:', error);
      setImageCards(prev => prev.map(c =>
        c.uuid === uuid ? { ...c, status: STATUS.ERROR } : c
      ));
      message.error(error.message || 'Не удалось добавить в датасет');
    } finally {
      setFinalZipLoading(prev => { const next = { ...prev }; delete next[uuid]; return next; });
      setFinalZipProgress(prev => { const next = { ...prev }; delete next[uuid]; return next; });
      setFinalZipTaskId(null);
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
  useEffect(() => { load_all_cards(); }, []);
  useEffect(() => { load_all_cards(); }, [currentPage]);

  // Восстановление состояния отображения точности
  useEffect(() => {
    const savedAccuracyState = localStorage.getItem('showAccuracyState');
    if (savedAccuracyState) {
      try {
        setShowAccuracyState(JSON.parse(savedAccuracyState));
      } catch (e) {
        console.error('Ошибка парсинга showAccuracyState', e);
      }
    }
  }, []);

  return {
    isModalVisible, setIsModalVisible,
    imageCards, setImageCards, selectedUuid, selectedCard,
    loading, isLoading, deleting, stats, statsLoading,
    detectLoading, detectProgress, detectError,
    tileBuildLoading, tileBuildProgress,
    isApproving, finalZipLoading, finalZipProgress, finalZipTaskId,
    showAccuracyState,
    currentPage, totalCards, itemsPerPage, setItemsPerPage,
    deleteImage, uploadToServer, handleCardClick, handlePageChange,
    handleDetectClick, handleApproveClick, handleFinalZipClick,
    handleShowModelAccuracy, getCardProgressOverlay,
  };
};

export default useCards;
