import React from 'react';
import { Modal, Button, Upload } from 'antd';

const UploadModal = ({ visible, loading, onCancel, onUpload, onDrop }) => (
  <Modal
    title="Локальная загрузка изображения"
    open={visible}
    onCancel={onCancel}
    footer={[
      <Button key="back" onClick={onCancel} disabled={loading}>
        Закрыть
      </Button>,
    ]}
  >
    <div
      style={{
        border: '2px dashed #ccc',
        padding: '20px',
        textAlign: 'center',
        cursor: 'pointer',
      }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <p>Перетащите файл сюда или нажмите на кнопку ниже</p>
      <Upload
        accept="image/*"
        showUploadList={false}
        disabled={loading}
        customRequest={({ file, onSuccess, onError }) => {
          onUpload(file)
            .then(() => onSuccess('ok'))
            .catch((err) => onError(err));
        }}
      >
        <Button loading={loading}>+ Выбрать файл</Button>
      </Upload>
    </div>
  </Modal>
);

export default UploadModal;
