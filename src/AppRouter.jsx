import React from 'react';
import { BrowserRouter, Switch, Route, Redirect } from 'react-router-dom';
import App from './App';
import AuthPage from './components/AuthPage';
import AuthCheck from './components/AuthCheck';

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/login" component={AuthPage} />

        <Route path="/" render={(routeProps) => (
          <AuthCheck {...routeProps}>
            <App {...routeProps} />
          </AuthCheck>
        )} />

        {/* Перенаправление для всех остальных путей */}
        <Route path="*" render={() => (
          <Redirect to={localStorage.getItem('authToken') ? '/' : '/login'} />
        )} />
      </Switch>
    </BrowserRouter>
  );
};

export default AppRouter;
