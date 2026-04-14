import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AnalyticsPage from './pages/AnalyticsPage';
import App from './App';
import { GlobalGazeSystem } from './components/GlobalGazeSystem';

export default function Router() {
  return (
    <BrowserRouter>
      <GlobalGazeSystem />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/app" element={<App />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
