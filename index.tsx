
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Register Service Worker for PWA capabilities
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      // Use relative path to avoid origin mismatch issues in preview environments
      navigator.serviceWorker.register('./service-worker.js')
        .then(registration => {

          // Suppress known origin mismatch errors in preview environments
          // console.log('SW registration failed (non-critical): ', registrationError.message);
        });
    } catch (e) {
      // Ignore initial registration errors
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
