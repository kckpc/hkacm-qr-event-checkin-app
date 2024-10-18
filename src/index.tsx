import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Disable certificate validation in development mode
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);