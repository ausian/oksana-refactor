import React from 'react';
import { Layout, Button, Card, Modal, Spin, Pagination } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import AtomSpinner from '../AtomSpinner/Atom';

const { Sider } = Layout;

const CardSidebar = ({
  imageCards,
  selectedUuid,
  onCardClick,
  onDelete,
  deleting,
  isLoading,
  currentPage,
  totalCards,
  itemsPerPage,
  onPageChange,
  onPageSizeChange,
  onUploadClick,
}) => (
  <Sider width={350} style={{ background: '#fff', overflow: 'auto' }}>
    <Button type="primary" onClick={onUploadClick} style={{ margin: '16px' }}>
      + Загрузить изображение
    </Button>

    {imageCards.length > 0 ? (
      imageCards.map((card) => {
        const hasTiles = !!card.tileManifest;
        return (
          <Card
            key={card.uuid}
            title={(
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                position: 'relative',
              }}>
                <span style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '16px',
                  marginRight: '40px',
                }}>
                  {card.name}
                </span>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    Modal.confirm({
                      title: `Удалить '${card.name}'?`,
                      content: 'Это действие нельзя отменить',
                      onOk: () => onDelete(card.uuid),
                      cancelText: 'Отмена',
                      okText: 'Удалить',
                      okButtonProps: {
                        danger: true,
                        loading: deleting === card.uuid,
                        disabled: deleting === card.uuid,
                      },
                    });
                  }}
                  disabled={deleting === card.uuid}
                  loading={deleting === card.uuid}
                  danger
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    padding: '0 8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                  }}
                />
              </div>
            )}
            style={{
              margin: '16px',
              cursor: 'pointer',
              border: card.uuid === selectedUuid ? '2px solid #1677ff' : undefined,
              height: 'auto',
              minHeight: '200px',
              position: 'relative',
              width: 'calc(100% - 32px)',
              maxWidth: '300px',
            }}
            onClick={() => onCardClick(card.uuid)}
            actions={[
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  // message.info('Отправление на предразметку пока не подключено');
                }}
              >
                Отправить на предразметку
              </Button>,
            ]}
          >
            {/* Блок с превью */}
            <div style={{ flex: 1, overflow: 'hidden', marginBottom: 12, position: 'relative' }}>
              {hasTiles && (
                <>
                  {(isLoading || !card.previewUrl) && (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', background: '#f5f5f5',
                    }}>
                      <AtomSpinner size={80} animationDuration={1000} />
                    </div>
                  )}
                  {card.previewUrl ? (
                    <img
                      src={card.previewUrl}
                      alt="Превью"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }}
                    />
                  ) : null}
                </>
              )}
              {!hasTiles && (
                <div style={{
                  width: '100%', height: '150px',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: '#f5f5f5',
                }}>
                  <AtomSpinner size={80} animationDuration={1000} />
                </div>
              )}
            </div>

            {/* Метаданные */}
            <p>Дата: {card.date}</p>
            <p>Формат: {card.format}</p>
            <p>Размер: {card.size}</p>
            <p>Размеры: {card.dimensions}</p>
            <p>Статус: {card.status}</p>
          </Card>
        );
      })
    ) : (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin spinning={isLoading} size="large">
          <p>Нет карточек или идёт загрузка...</p>
        </Spin>
      </div>
    )}

    <Pagination
      current={currentPage}
      total={totalCards}
      pageSize={itemsPerPage}
      onChange={onPageChange}
      style={{ margin: '26px', textAlign: 'center' }}
      showQuickJumper
      showSizeChanger
      onShowSizeChange={(current, size) => onPageSizeChange(size)}
    />
  </Sider>
);

export default CardSidebar;
