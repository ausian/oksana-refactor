import React from 'react';
import { Redirect } from 'react-router-dom';
import { withRouter } from 'react-router';

const AuthCheck = ({ children, history }) => {
  const API_BASE = '';
  const token = localStorage.getItem('authToken');
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsAuthenticated(false);
        setChecking(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/checktoken/check`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("\n\n\n\n +=—=+ ", response);
        const result = await response.json();

        if (!response.ok) {
          localStorage.removeItem('authToken');
          history.push('/login'); // Перенаправляем через history (v5)
          setIsAuthenticated(false);
          return;
        }

        const username = result.payload.sub;
        console.log("username = ", username);

        setIsAuthenticated(true);
      } catch (err) {
        setIsAuthenticated(false);
        history.push('/login');
      } finally {
        setChecking(false);
      }
    };

    verifyToken();
  }, [token, history]);

  if (checking) return <div>Проверка авторизации...</div>;
  if (!isAuthenticated) return <Redirect to="/login" />;

  return children; // Рендерим защищённый контент
};

export default withRouter(AuthCheck); // v5 требует withRouter для доступа к history
