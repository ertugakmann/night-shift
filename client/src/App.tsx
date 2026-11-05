import { MotionConfig } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Hud } from './components/Hud';
import { useDemoScreen } from './hooks/useDemoScreen';
import { usePresenterKeys } from './hooks/usePresenterKeys';
import { Moments } from './moments/Moments';
import { useSoundCues } from './sound/useSoundCues';
import { HomePage } from './pages/HomePage';
import { PreviewPage } from './pages/PreviewPage';
import { ScreenPage } from './pages/ScreenPage';
import { WallPage } from './pages/WallPage';

export function App() {
  usePresenterKeys();
  useDemoScreen();
  useSoundCues();
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
        <Moments />
        <Hud />
      </BrowserRouter>
    </MotionConfig>
  );
}
