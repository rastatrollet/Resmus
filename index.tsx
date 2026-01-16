
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Service worker registration removed as PWA is not fully configured yet

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element");
}

let root = (rootElement as any)._reactRootContainer;
if (!root) {
  root = ReactDOM.createRoot(rootElement);
  (rootElement as any)._reactRootContainer = root;
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
