import { MotionConfig } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Hud } from './components/Hud';
import { usePresenterKeys } from './hooks/usePresenterKeys';
import { HomePage } from './pages/HomePage';
import { PreviewPage } from './pages/PreviewPage';
import { ScreenPage } from './pages/ScreenPage';
import { WallPage } from './pages/WallPage';

export function App() {
  usePresenterKeys();
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wall" element={<WallPage />} />
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/screen/:id" element={<ScreenPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Hud />
      </BrowserRouter>
    </MotionConfig>
  );
}
