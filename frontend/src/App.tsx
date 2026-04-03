import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { setToken } from "./api";
import LoginPage from "./pages/LoginPage";
import MainLayout from "./layout/MainLayout";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import TradingPage from "./pages/TradingPage";
import ChartsPage from "./pages/ChartsPage";
import StrategiesPage from "./pages/StrategiesPage";
import RiskPage from "./pages/RiskPage";
import SystemPage from "./pages/SystemPage";
import UsersPage from "./pages/UsersPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";

function Private({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("cq_token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/change-password"
          element={
            <Private>
              <ChangePasswordPage />
            </Private>
          }
        />
        <Route
          path="/"
          element={
            <Private>
              <MainLayout
                onLogout={() => {
                  setToken(null);
                }}
              />
            </Private>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="trading" element={<TradingPage />} />
          <Route path="charts" element={<ChartsPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="risk" element={<RiskPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
