import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/fonts.css';
import './i18n';
import * as titleExtractor from './utils/titleExtractor';

// titleExtractor'u global olarak erişilebilir yap
window.titleExtractor = titleExtractor;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
