import React from 'react';
import { Layout, Button } from 'antd';
import { PoweroffOutlined } from '@ant-design/icons';

const { Header } = Layout;

const AppHeader = ({ onLogout }) => (
  <Header className="header" style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    backgroundColor: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  }}>
    <div className="title-container">Tracks</div>
    <Button
      type="primary"
      icon={<PoweroffOutlined />}
      onClick={onLogout}
      style={{ backgroundColor: '#1890ff', borderColor: '#1890ff', fontSize: '14px' }}
    >
      Выйти
    </Button>
  </Header>
);

export default AppHeader;
