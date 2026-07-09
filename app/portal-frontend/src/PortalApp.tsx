import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import React from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import PlayerPortalOnlyPage from './PlayerPortalOnlyPage';
import PublicPortalOnlyPage from './PublicPortalOnlyPage';

const queryClient = new QueryClient();

const PortalApp: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" richColors />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/public" replace />} />
          <Route path="/public" element={<PublicPortalOnlyPage />} />
          <Route path="/player/:nationId" element={<PlayerPortalOnlyPage />} />
          <Route path="*" element={<Navigate to="/public" replace />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default PortalApp;
