import React from 'react';
import { Layout, Button, Card, Modal, Spin, Pagination, Tag } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import AtomSpinner from '../AtomSpinner/Atom';
import DetectionProgressOverlay from '../DetectionProgressOverlay';
import { formatDuration } from '../../utils/mapHelpers';
import { STATUS, getStatusColor } from '../../constants/status';

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
  stats,
  statsLoading,
  detectLoading,
  detectProgress,
  onDetectClick,
  tileBuildLoading,
  tileBuildProgress,
  isApproving,
  onApproveClick,
  finalZipLoading,
  finalZipProgress,
  onFinalZipClick,
  showAccuracyState,
  onShowModelAccuracy,
  getCardProgressOverlay,
}) => (
  <Sider width={350} style={{ background: '#fff', overflow: 'auto' }}>
    <div
      style={{
        margin: '12px 12px 8px',
        padding: '10px 10px',
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Сводка</div>
      <div style={{ display: 'grid', rowGap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#595959' }}>Всего проектов</span>
          <span style={{ fontWeight: 600 }}>
            {statsLoading ? <Spin size="small" /> : stats.totalProjects}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#595959' }}>Среднее время разбивки</span>
          <span style={{ fontWeight: 600 }}>
            {statsLoading ? <Spin size="small" /> : formatDuration(stats.avgTileBuildMs)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#595959' }}>Среднее время предразметки</span>
          <span style={{ fontWeight: 600 }}>
            {statsLoading ? <Spin size="small" /> : formatDuration(stats.avgDetectMs)}
          </span>
        </div>
      </div>
    </div>

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
              {(() => {
                const overlay = getCardProgressOverlay(card);
                return <DetectionProgressOverlay percent={overlay.percent} label={overlay.label} />;
              })()}
            </div>

            {/* Метаданные */}
            <p>Дата: {card.date}</p>
            <p>Формат: {card.format}</p>
            <p>Размер: {card.size}</p>
            <p>Размеры: {card.dimensions}</p>
            <p>
              Статус:
              <Tag
                color={getStatusColor(card.status)}
                style={{ marginLeft: 8, textTransform: 'uppercase', fontWeight: 'bold' }}
              >
                {card.status}
              </Tag>
            </p>
            <p>Всего объектов: {card.detectionsTotal ?? 0}</p>
            <p>Найдено моделью: {card.modelTracksTotal ?? 0}</p>
            <p>Добавлено треков: {card.manualTracksTotal ?? 0}</p>
            <p>Удалено треков: {card.deletedTracksTotal ?? 0}</p>
            {showAccuracyState?.[card.uuid] && card.modelAccuracyPercent != null && (
              <p style={{ fontWeight: 700 }}>Точность F1: {card.modelAccuracyPercent}%</p>
            )}
            {showAccuracyState?.[card.uuid] && card.precision != null && (
              <p style={{ fontWeight: 700 }}>Precision: {card.precision}%</p>
            )}
            {showAccuracyState?.[card.uuid] && card.recall != null && (
              <p style={{ fontWeight: 700 }}>Recall: {card.recall}%</p>
            )}
            <Button
              icon={<UploadOutlined />}
              loading={!!detectLoading?.[card.uuid]}
              disabled={!!detectLoading?.[card.uuid]}
              onClick={(e) => {
                e.stopPropagation();
                onDetectClick(card.uuid);
              }}
              style={{ marginTop: 8, display: 'block' }}
            >
              Обработать
            </Button>
            <Button
              disabled={
                !!detectLoading?.[card.uuid] ||
                !!tileBuildLoading?.[card.uuid] ||
                !!finalZipLoading?.[card.uuid] ||
                card.status === STATUS.LOADING ||
                card.status === STATUS.TILES_BUILDING
              }
              onClick={(e) => {
                e.stopPropagation();
                onShowModelAccuracy(card.uuid);
              }}
              style={{ marginTop: 8, display: 'block' }}
            >
              Определить точность
            </Button>
            <Button
              loading={!!isApproving?.[card.uuid]}
              disabled={
                card.status !== STATUS.PROCESSED ||
                !!isApproving?.[card.uuid] ||
                !!detectLoading?.[card.uuid] ||
                !!finalZipLoading?.[card.uuid]
              }
              onClick={(e) => {
                e.stopPropagation();
                onApproveClick(card.uuid);
              }}
              title={
                card.status !== STATUS.PROCESSED
                  ? "Сначала нужно выполнить предразметку. Статус карточки должен быть 'Обработано'"
                  : isApproving?.[card.uuid]
                    ? 'Отправка в процессе...'
                    : 'Отправить текущую разметку на проверку'
              }
              style={{ marginTop: 8, display: 'block' }}
            >
              Отправить на проверку
            </Button>
            <Button
              loading={!!finalZipLoading?.[card.uuid]}
              disabled={
                card.status !== STATUS.PROCESSED ||
                !!finalZipLoading?.[card.uuid] ||
                !!detectLoading?.[card.uuid] ||
                !!isApproving?.[card.uuid]
              }
              onClick={(e) => {
                e.stopPropagation();
                onFinalZipClick(card.uuid);
              }}
              title={
                card.status !== STATUS.PROCESSED
                  ? 'Сначала должна быть готовая обработанная разметка'
                  : finalZipLoading?.[card.uuid]
                    ? 'Добавление в датасет выполняется...'
                    : 'Добавить изображение в итоговый обучающий датасет'
              }
              style={{ marginTop: 8, display: 'block' }}
            >
              {finalZipLoading?.[card.uuid]
                ? `В датасет ${finalZipProgress?.[card.uuid] ?? 0}%`
                : 'Добавить в датасет'}
            </Button>
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
