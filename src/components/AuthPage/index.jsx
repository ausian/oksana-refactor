import React, { useState } from 'react';
import { Layout, Form, Input, Button, message } from 'antd';
import { ConfigProvider } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'; // Импорт иконок
import ru from 'antd/lib/locale/ru_RU';
import 'antd/dist/antd.css';
import { useHistory } from 'react-router-dom';
import BackgroundSVG from './background.svg';
import styles from './AuthPage.module.css';

const API_BASE = '';

const { Header, Content } = Layout;

const AuthPage = () => {
  const history = useHistory();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // состояние для видимости пароля

  // Проверяем, есть ли токен при загрузке страницы
  React.useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      history.push('/'); // Уже авторизован — переходим на главную
    }
  }, [history]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Отправляем запрос на сервер
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Неверный логин или пароль');
      }

      // **Теперь токен берётся из заголовка `Authorization`** (а не из тела)
      const authHeader = response.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        throw new Error('Не удалось получить токен из заголовка');
      }

      // кейс когда берем токен из хедера
      const token = authHeader.replace('Bearer ', '');
      localStorage.setItem('authToken', token); // Сохраняем в localStorage
      console.log("\n\n\n\n", token);
      // кейс когда берем токен из тела запроса
      // const data = await response.json();
      // localStorage.setItem('authToken', data.token);

      message.success('Авторизация успешна!');
      history.push('/'); // Перенаправляем на главную

    } catch (error) {
      console.error(error);
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    history.push('/login');
  };

  return (
    <div className={styles.container} style={{ backgroundImage: `url(${BackgroundSVG})` }}>
      <ConfigProvider locale={ru}>
        <Layout className={styles['auth-layout']}>
          {/* <Header className={styles['auth-header']}>
            <div className={styles['auth-title']}>Tracks — Авторизация</div>
            {localStorage.getItem('authToken') && (
              <Button
                type="primary"
                onClick={() => {
                  localStorage.removeItem('authToken');
                  history.push('/login');
                  //onClick={handleLogout}
                  style={{ float: 'right', marginRight: 20 }}
                }}
              >
                Выйти
              </Button>
            )}
          </Header> */}
          <Content className={styles['auth-content']}>
            {/* Блок с логотипом и названием */}
            <div className={styles['auth-header-content']}>
              <div className={styles['auth-title']}>Track</div>
            </div>
            <div className={styles['auth-form-container']}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
              >
                <Form.Item
                  label="Логин"
                  name="username"
                  rules={[{ required: true, message: 'Введите логин!' }]}
                >
                  <Input
                    placeholder="Ваш логин"
                    className={styles['auth-input']}
                  />
                </Form.Item>
                <Form.Item
                  label="Пароль"
                  name="password"
                  rules={[{ required: true, message: 'Введите пароль!' }]}
                  className={styles['auth-input-password']}
                >
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ваш пароль"
                    suffix={
                      <Button
                        type="text"
                        onClick={(e) => {
                          e.preventDefault();
                          togglePasswordVisibility();
                        }}
                        style={{
                          marginLeft: '15px',
                          padding: 0,
                          border: 'none',
                          background: 'transparent'
                        }}
                      >
                        {showPassword ? (
                          <EyeOutlined />
                        ) : (
                          <EyeInvisibleOutlined />
                        )}
                      </Button>
                    }
                    className={styles['auth-input']}
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    loading={loading}
                    style={{ background: '#1677ff' }}
                    className={styles['auth-input']}
                  >
                    Войти
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </Content>
        </Layout>
      </ConfigProvider>
    </div>
  );
};

export default AuthPage;
