import { Navigate, Route, Routes } from 'react-router-dom';
import DirectoryPage from './pages/DirectoryPage';
import ScraperControl from './pages/ScraperControl';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DirectoryPage />} />
      <Route path="/scraper-control" element={<ScraperControl />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
