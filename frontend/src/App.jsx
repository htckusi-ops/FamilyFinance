import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import ChildDashboard from './pages/ChildDashboard';
import ParentDashboard from './pages/ParentDashboard';
import PointsPage from './pages/PointsPage';
import AllowancePage from './pages/AllowancePage';
import FleaMarketPage from './pages/FleaMarketPage';
import FleaDayPage from './pages/FleaDayPage';
import RewardsPage from './pages/RewardsPage';
import SettingsPage from './pages/SettingsPage';
import BathPage from './pages/BathPage';
import FinanceOverviewPage from './pages/FinanceOverviewPage';
import ParentNav from './components/ParentNav';
import ChildNav from './components/ChildNav';

function AppRoutes() {
  const { user } = useAuth();

  if (!user) return <Routes><Route path="*" element={<LoginPage />} /></Routes>;

  if (user.role === 'child') {
    return (
      <div className="main-content">
        <ChildNav />
        <Routes>
          <Route path="/" element={<ChildDashboard />} />
          <Route path="/points" element={<PointsPage childId={user.id} />} />
          <Route path="/flea" element={<FleaMarketPage childId={user.id} />} />
          <Route path="/bath" element={<BathPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="main-content">
      <ParentNav />
      <Routes>
        <Route path="/" element={<ParentDashboard />} />
        <Route path="/points" element={<PointsPage />} />
        <Route path="/allowance" element={<AllowancePage />} />
        <Route path="/flea" element={<FleaMarketPage />} />
        <Route path="/flea/day/:id" element={<FleaDayPage />} />
        <Route path="/rewards" element={<RewardsPage />} />
        <Route path="/bath" element={<BathPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/finance" element={<FinanceOverviewPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
