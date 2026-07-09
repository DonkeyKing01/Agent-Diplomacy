import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from '@/game/GameContext';
import Index from './pages/Index';
import MapPage from './pages/MapPage';
import ControlPage from './pages/ControlPage';
import MessagesPage from './pages/MessagesPage';
import HistoryPage from './pages/HistoryPage';
import DataPage from './pages/DataPage';
import PublicPortalPage from './pages/PublicPortalPage';
import PlayerPortalPage from './pages/PlayerPortalPage';

const queryClient = new QueryClient();

const AdminRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/map" element={<MapPage />} />
    <Route path="/control" element={<ControlPage />} />
    <Route path="/messages" element={<MessagesPage />} />
    {/* 智能体设置为游戏内覆盖面板；/agents 直达时默认落在战略地图并打开设置 */}
    <Route path="/agents" element={<MapPage />} />
    <Route path="/history" element={<HistoryPage />} />
    <Route path="/data" element={<DataPage />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" richColors />
      <HashRouter>
        <Routes>
          <Route path="/public" element={<PublicPortalPage />} />
          <Route path="/player/:nationId" element={<PlayerPortalPage />} />
          <Route
            path="*"
            element={
              <GameProvider>
                <AdminRoutes />
              </GameProvider>
            }
          />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
export { AdminRoutes };
