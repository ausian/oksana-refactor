import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import AppRouter from "./App_vinokurova";
// import AppRouter from "./App_test";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppRouter />);
