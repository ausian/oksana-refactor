import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import AppRouter from "./AppRouter";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppRouter />);
