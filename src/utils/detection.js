// Утилиты для нормализации данных предразметки/детекции.

// Приводит значение прогресса к целому проценту 0..100.
// Поддерживает как доли (0..1), так и проценты (0..100).
export function normalizePercent(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  if (numberValue >= 0 && numberValue <= 1) {
    return Math.min(100, Math.max(0, Math.round(numberValue * 100)));
  }
  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

// Приводит ответ backend со статистикой детекции к единому виду.
export function normalizeDetectionStats(data = {}) {
  const toNumberOrNull = (v) =>
    v === null || v === undefined ? null : Number(v);

  return {
    detections_total: Number(data?.detections_total ?? 0),
    classes: data?.classes || {},

    model_tracks_total: Number(data?.model_tracks_total ?? 0),
    active_model_tracks_total: Number(data?.active_model_tracks_total ?? 0),
    manual_tracks_total: Number(data?.manual_tracks_total ?? 0),
    deleted_tracks_total: Number(data?.deleted_tracks_total ?? 0),

    model_accuracy_percent: toNumberOrNull(data?.model_accuracy_percent),
    precision: toNumberOrNull(data?.precision),
    recall: toNumberOrNull(data?.recall),
  };
}
