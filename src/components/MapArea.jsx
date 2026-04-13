import React from 'react';
import AtomSpinner from './AtomSpinner/Atom';

const MapArea = ({ selectedCard, mapContainerRef, isTilesLoading, onDrop }) => {
  if (!selectedCard) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <p>Загрузите изображение, чтобы увидеть его на карте</p>
      </div>
    );
  }

  return (
    <div
      className="map-container"
      style={{ width: '100%', height: 'calc(100vh - 120px)', position: 'relative' }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ebe6e6',
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
        }}
      />
      {isTilesLoading && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.85)',
          zIndex: 1000,
          backdropFilter: 'blur(2px)',
        }}>
          <AtomSpinner size={100} animationDuration={1200} />
        </div>
      )}
    </div>
  );
};

export default MapArea;
