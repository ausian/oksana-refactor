export const getMaxZoomFromLevels = (levels) => {
  const zs = Object.keys(levels || {}).map(k => Number(k)).filter(n => Number.isFinite(n));
  return zs.length ? Math.max(...zs) : 0;
};

export const getDimsFromLevels = (levels) => {
  const maxZ = getMaxZoomFromLevels(levels);
  const lvl = levels?.[String(maxZ)] || levels?.[maxZ];
  if (lvl && Number.isFinite(lvl.width) && Number.isFinite(lvl.height)) {
    return { width: lvl.width, height: lvl.height };
  }
  const any = Object.values(levels || {})[0];
  if (any && Number.isFinite(any.width) && Number.isFinite(any.height)) {
    return { width: any.width, height: any.height };
  }
  return { width: 1024, height: 768 };
};

export const getFallbackImageUrl = () => '/Default1.png';

export const viewFit = (map, extent) => {
  const view = map.getView();
  view.fit(extent, {
    size: map.getSize(),
    padding: [20, 20, 20, 20],
    nearest: true,
  });
};
