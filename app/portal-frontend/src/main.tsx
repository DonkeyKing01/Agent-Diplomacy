import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { finishRuntimeConfigWithoutFetch } from '@/lib/config';
import PortalApp from './PortalApp';

async function initializeApp() {
  finishRuntimeConfigWithoutFetch();

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <PortalApp />
    </React.StrictMode>,
  );
}

initializeApp();
