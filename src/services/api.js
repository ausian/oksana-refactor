const API_BASE = '';

export const deleteImageRequest = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/ingest/${uuid}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
    mode: 'cors',
  });
  if (!response.ok) throw new Error(`Не удалось удалить изображение: ${response.statusText}`);
};

export const fetchTilePreviewUrl = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/tiles/${uuid}/preview`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
    mode: 'cors',
  });
  if (!response.ok) throw new Error(`Failed to fetch tile preview for ${uuid}: ${response.status}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const fetchCardsMetadata = async (token, currentPage, itemsPerPage) => {
  const offset = (currentPage - 1) * itemsPerPage;
  const response = await fetch(`${API_BASE}/metadata?limit=${itemsPerPage}&offset=${offset}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
    mode: 'cors',
  });
  if (!response.ok) throw new Error(`Ошибка метаданных: ${response.status}`);
  return response.json();
};

export const fetchManifest = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/tiles/${uuid}/manifest`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
    mode: 'cors',
  });
  if (!response.ok) throw new Error(`Manifest load error: ${response.status}`);
  return response.json();
};

export const uploadImageRequest = async (file, token) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/ingest/images/ingest?storage=s3&on_conflict=error`, {
    method: 'POST',
    headers: { accept: 'application/json', Authorization: `Bearer ${token}` },
    body: formData,
    mode: 'cors',
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HTTP ошибка ${response.status}: ${errorText}`);
  }
  return response.json();
};

export const startTileBuildRequest = async (uuid, token) => {
  const url = `${API_BASE}/tiles/${uuid}/build?tile_size=256&fmt=webp&lossless=false`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', Authorization: `Bearer ${token}` },
    mode: 'cors',
  });
  if (!response.ok) {
    const t = await response.text().catch(() => '');
    throw new Error(`Ошибка запуска билда: ${response.status} ${t}`);
  }
  const ct = response.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await response.json();
    const job = data?.job_id || data?.task_id || data?.uuid || (typeof data === 'string' ? data : null);
    if (!job) throw new Error('Не удалось извлечь job id из ответа build');
    return job;
  }
  const text = (await response.text()).trim();
  if (!text) throw new Error('Пустой ответ build');
  return text;
};

export const fetchTileStatusRequest = async (jobId, token) => {
  const response = await fetch(`${API_BASE}/tiles/${jobId}/result`, {
    method: 'GET',
    headers: { accept: 'application/json', Authorization: `Bearer ${token}` },
    mode: 'cors',
  });
  console.log(`Запрос к серверу: jobId=${jobId}, статус=${response.status}`);
  return response.json();
};

export const fetchStatisticsSummary = async (token) => {
  const response = await fetch(`${API_BASE}/statistics/summary`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    mode: 'cors',
    cache: 'no-store',
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(responseText || `Ошибка статистики: ${response.status}`);
  return JSON.parse(responseText);
};

export const fetchDetectionsRequest = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/detections/${uuid}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    mode: 'cors',
    cache: 'no-store',
  });

  if (response.status === 404) {
    return { exists: false, detections: [], detectionsTotal: 0 };
  }
  if (!response.ok) throw new Error(`Ошибка предразметки: ${response.status}`);

  const detections = await response.json();
  return {
    exists: true,
    detections,
    detectionsTotal: Array.isArray(detections) ? detections.length : 0,
  };
};

export const saveDetectionsRequest = async (uuid, detections, token) => {
  const response = await fetch(`${API_BASE}/detections/${uuid}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(detections),
    mode: 'cors',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Ошибка сохранения разметки: ${response.status} ${errorText}`);
  }
};

export const startDetectionRequest = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/detections/${uuid}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({ confidence: 0.6 }),
    mode: 'cors',
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Ошибка отправки на предразметку: ${response.status}`);
  return response.json();
};

export const fetchDetectionTaskStatusRequest = async (jobId, token) => {
  const response = await fetch(`${API_BASE}/detections/tasks/${jobId}/result`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    mode: 'cors',
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Ошибка статуса предразметки: ${response.status}`);
  return response.json();
};

export const approveAnnotationsRequest = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/detections/9876test/${uuid}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    mode: 'cors',
    cache: 'no-store',
  });
  const text = await response.text().catch(() => '');
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data?.detail || text || `Ошибка отправки на проверку: ${response.status}`);
  return data;
};

export const startFinalZipExportRequest = async (uuid, token) => {
  const response = await fetch(`${API_BASE}/detections/${uuid}/export`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    mode: 'cors',
    cache: 'no-store',
  });
  const text = await response.text().catch(() => '');
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data?.detail || text || `Ошибка запуска final.zip: ${response.status}`);
  return data;
};

export const fetchFinalZipTaskStatusRequest = async (taskId, token) => {
  const response = await fetch(`${API_BASE}/detections/export/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Cache-Control': 'no-cache',
    },
    mode: 'cors',
    cache: 'no-store',
  });
  const text = await response.text().catch(() => '');
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data?.detail || text || `Ошибка статуса final.zip: ${response.status}`);
  return data;
};
