import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import Draw, { createBox } from 'ol/interaction/Draw';
import Select from 'ol/interaction/Select';
import { click } from 'ol/events/condition';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {
  createAnnotationFeatureStyle,
  createFeatureFromBBox,
  detectionToBBox,
  featureToDetection,
} from '../utils/annotationHelpers';
import { fetchDetectionsRequest, saveDetectionsRequest } from '../services/api';
import { STATUS } from '../constants/status';

const useMapAnnotations = ({ mapRef, selectedCard, setImageCards }) => {
  const [annotationMode, setAnnotationMode] = useState(null);
  const [isAnnotationDirty, setIsAnnotationDirty] = useState(false);
  const [isSavingAnnotations, setIsSavingAnnotations] = useState(false);

  const annotationSourceRef = useRef(null);
  const annotationLayerRef = useRef(null);
  const drawInteractionRef = useRef(null);
  const selectInteractionRef = useRef(null);

  const disableAllAnnotationInteractions = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drawInteractionRef.current) {
      map.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }
    if (selectInteractionRef.current) {
      map.removeInteraction(selectInteractionRef.current);
      selectInteractionRef.current = null;
    }
  }, [mapRef]);

  const clearAnnotationLayer = useCallback(() => {
    const map = mapRef.current;
    disableAllAnnotationInteractions();

    if (annotationLayerRef.current && map) {
      map.removeLayer(annotationLayerRef.current);
    }

    annotationLayerRef.current = null;
    annotationSourceRef.current = null;
    setAnnotationMode(null);
  }, [disableAllAnnotationInteractions, mapRef]);

  const addDetectionsLayer = useCallback((detections, map, imageHeight) => {
    if (!map || !Number.isFinite(imageHeight)) return;

    if (annotationLayerRef.current) {
      map.removeLayer(annotationLayerRef.current);
    }

    const vectorSource = new VectorSource();
    (detections || []).forEach((detection) => {
      const feature = createFeatureFromBBox(
        detectionToBBox(detection),
        imageHeight,
        {
          id: detection?.id,
          sourceType: detection?.source || 'predicted',
        }
      );

      if (feature) vectorSource.addFeature(feature);
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: feature => createAnnotationFeatureStyle(feature),
      zIndex: 1000,
    });

    vectorLayer.set('isDetectionLayer', true);
    map.addLayer(vectorLayer);
    annotationSourceRef.current = vectorSource;
    annotationLayerRef.current = vectorLayer;
  }, []);

  const ensureAnnotationLayer = useCallback(() => {
    const map = mapRef.current;
    if (!map || !selectedCard) return false;

    if (!annotationSourceRef.current) {
      addDetectionsLayer(
        selectedCard.detections || [],
        map,
        Number(selectedCard.height)
      );
    }

    return Boolean(annotationSourceRef.current);
  }, [addDetectionsLayer, mapRef, selectedCard]);

  const enableDrawMode = useCallback(() => {
    if (!ensureAnnotationLayer()) return;

    const map = mapRef.current;
    disableAllAnnotationInteractions();

    const draw = new Draw({
      source: annotationSourceRef.current,
      type: 'Circle',
      geometryFunction: createBox(),
    });

    draw.on('drawend', (event) => {
      event.feature.set('sourceType', 'manual');
      event.feature.set('id', `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      event.feature.set('isSelectedForDelete', false);
      setIsAnnotationDirty(true);
    });

    map.addInteraction(draw);
    drawInteractionRef.current = draw;
    setAnnotationMode('draw');
  }, [disableAllAnnotationInteractions, ensureAnnotationLayer, mapRef]);

  const enableDeleteMode = useCallback(() => {
    if (!ensureAnnotationLayer()) return;

    const map = mapRef.current;
    disableAllAnnotationInteractions();

    const select = new Select({
      condition: click,
      layers: [annotationLayerRef.current],
      style: null,
    });

    select.on('select', (event) => {
      event.deselected.forEach(feature => feature.set('isSelectedForDelete', false));
      event.selected.forEach(feature => feature.set('isSelectedForDelete', true));

      const featureToRemove = event.selected?.[0];
      if (!featureToRemove) return;

      annotationSourceRef.current.removeFeature(featureToRemove);
      setIsAnnotationDirty(true);
      select.getFeatures().clear();
    });

    map.addInteraction(select);
    selectInteractionRef.current = select;
    setAnnotationMode('delete');
  }, [disableAllAnnotationInteractions, ensureAnnotationLayer, mapRef]);

  const cancelAnnotationMode = useCallback(() => {
    if (annotationSourceRef.current) {
      annotationSourceRef.current.getFeatures().forEach((feature) => {
        feature.set('isSelectedForDelete', false);
      });
    }
    disableAllAnnotationInteractions();
    setAnnotationMode(null);
  }, [disableAllAnnotationInteractions]);

  const saveAnnotations = useCallback(async () => {
    if (!selectedCard) return;

    try {
      setIsSavingAnnotations(true);
      const token = localStorage.getItem('authToken');
      const detectionsToSave = annotationSourceRef.current
        ? annotationSourceRef.current
          .getFeatures()
          .map(feature => featureToDetection(feature, Number(selectedCard.height)))
          .filter(Boolean)
        : [];

      await saveDetectionsRequest(selectedCard.uuid, detectionsToSave, token);

      let freshDetections = detectionsToSave;
      try {
        const response = await fetchDetectionsRequest(selectedCard.uuid, token);
        freshDetections = response.detections;
      } catch (readError) {
        console.warn('Не удалось перечитать detections после сохранения', readError);
      }

      setImageCards(prev => prev.map(card =>
        card.uuid === selectedCard.uuid
          ? {
            ...card,
            detections: freshDetections,
            detectionsTotal: freshDetections.length,
            status: freshDetections.length > 0 ? STATUS.PROCESSED : STATUS.NOT_ANNOTATED,
          }
          : card
      ));

      setIsAnnotationDirty(false);
      cancelAnnotationMode();
      message.success('Разметка сохранена');
    } catch (error) {
      console.error('Ошибка сохранения ручной разметки:', error);
      message.error(error.message || 'Не удалось сохранить разметку');
    } finally {
      setIsSavingAnnotations(false);
    }
  }, [cancelAnnotationMode, selectedCard, setImageCards]);

  useEffect(() => {
    disableAllAnnotationInteractions();
    setIsAnnotationDirty(false);

    if (!selectedCard || !mapRef.current) {
      clearAnnotationLayer();
      return;
    }

    if (selectedCard.tileManifest?.uuid && selectedCard.tileManifest?.levels) {
      addDetectionsLayer(
        selectedCard.detections || [],
        mapRef.current,
        Number(selectedCard.height)
      );
    }
  }, [
    addDetectionsLayer,
    clearAnnotationLayer,
    disableAllAnnotationInteractions,
    mapRef,
    selectedCard?.uuid,
    selectedCard?.detections,
    selectedCard?.tileManifest,
    selectedCard?.height,
  ]);

  useEffect(() => () => {
    clearAnnotationLayer();
  }, [clearAnnotationLayer]);

  return {
    annotationMode,
    isAnnotationDirty,
    isSavingAnnotations,
    enableDrawMode,
    enableDeleteMode,
    cancelAnnotationMode,
    saveAnnotations,
    clearAnnotationLayer,
  };
};

export default useMapAnnotations;
