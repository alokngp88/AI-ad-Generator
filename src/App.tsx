import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AdPoster from './pages/AdPoster';
import Reels from './pages/Reels';
import Stories from './pages/Stories';
import AuthGuard from './components/AuthGuard';

export default function App() {
  return (
    <AuthGuard>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/poster" replace />} />
            <Route path="poster" element={<AdPoster />} />
            <Route path="reels" element={<Reels />} />
            <Route path="stories" element={<Stories />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthGuard>
  );
}
