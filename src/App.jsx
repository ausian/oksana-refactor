import React from 'react';
import { Layout, ConfigProvider } from 'antd';
import ru from 'antd/lib/locale/ru_RU';
import 'antd/dist/antd.css';
import 'ol/ol.css';

import AppHeader from './components/AppHeader';
import CardSidebar from './components/CardSidebar';
import MapArea from './components/MapArea';
import UploadModal from './components/UploadModal';

import useMap from './hooks/useMap';
import useCards from './hooks/useCards';
import useMapAnnotations from './hooks/useMapAnnotations';

const { Content } = Layout;

const App = ({ history }) => {
  const { mapContainerRef, mapRef, isTilesLoading, destroyMap, setPreviewImageLayer, setTilesLayer } = useMap();

  const {
    isModalVisible, setIsModalVisible,
    imageCards, setImageCards, selectedCard,
    loading, isLoading, deleting, stats, statsLoading,
    detectLoading, detectProgress,
    tileBuildLoading, tileBuildProgress,
    isApproving, finalZipLoading, finalZipProgress,
    showAccuracyState,
    currentPage, totalCards, itemsPerPage, setItemsPerPage,
    deleteImage, uploadToServer, handleCardClick, handlePageChange,
    handleDetectClick, handleApproveClick, handleFinalZipClick,
    handleShowModelAccuracy, getCardProgressOverlay,
    selectedUuid,
  } = useCards({ setPreviewImageLayer, setTilesLayer, destroyMap });

  const {
    annotationMode,
    isAnnotationDirty,
    isSavingAnnotations,
    enableDrawMode,
    enableDeleteMode,
    cancelAnnotationMode,
    saveAnnotations,
    clearAnnotationLayer,
  } = useMapAnnotations({ mapRef, selectedCard, setImageCards });

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    clearAnnotationLayer();
    destroyMap();
    history.push('/login');
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) uploadToServer(file);
  };

  return (
    <ConfigProvider locale={ru}>
      <Layout style={{ height: '100vh' }}>
        <AppHeader onLogout={handleLogout} />
        <Layout>
          <CardSidebar
            imageCards={imageCards}
            selectedUuid={selectedUuid}
            onCardClick={handleCardClick}
            onDelete={deleteImage}
            deleting={deleting}
            isLoading={isLoading}
            currentPage={currentPage}
            totalCards={totalCards}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onPageSizeChange={setItemsPerPage}
            onUploadClick={() => setIsModalVisible(true)}
            stats={stats}
            statsLoading={statsLoading}
            detectLoading={detectLoading}
            detectProgress={detectProgress}
            onDetectClick={handleDetectClick}
            tileBuildLoading={tileBuildLoading}
            tileBuildProgress={tileBuildProgress}
            isApproving={isApproving}
            onApproveClick={handleApproveClick}
            finalZipLoading={finalZipLoading}
            finalZipProgress={finalZipProgress}
            onFinalZipClick={handleFinalZipClick}
            showAccuracyState={showAccuracyState}
            onShowModelAccuracy={handleShowModelAccuracy}
            getCardProgressOverlay={getCardProgressOverlay}
          />
          <Layout style={{ padding: '24px' }}>
            <Content>
              <MapArea
                selectedCard={selectedCard}
                mapContainerRef={mapContainerRef}
                isTilesLoading={isTilesLoading}
                onDrop={handleFileDrop}
                annotationMode={annotationMode}
                isAnnotationDirty={isAnnotationDirty}
                isSavingAnnotations={isSavingAnnotations}
                onDrawAnnotations={enableDrawMode}
                onDeleteAnnotations={enableDeleteMode}
                onSaveAnnotations={saveAnnotations}
                onCancelAnnotations={cancelAnnotationMode}
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
