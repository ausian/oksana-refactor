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

const { Content } = Layout;

const App = ({ history }) => {
  const { mapContainerRef, isTilesLoading, destroyMap, setPreviewImageLayer, setTilesLayer } = useMap();

  const {
    isModalVisible, setIsModalVisible,
    imageCards, selectedCard,
    loading, isLoading, deleting,
    currentPage, totalCards, itemsPerPage, setItemsPerPage,
    deleteImage, uploadToServer, handleCardClick, handlePageChange,
    selectedUuid,
  } = useCards({ setPreviewImageLayer, setTilesLayer, destroyMap });

  const handleLogout = () => {
    localStorage.removeItem('authToken');
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
