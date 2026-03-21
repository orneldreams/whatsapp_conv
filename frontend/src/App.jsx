import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import api from "./api/client";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import OverviewPage from "./pages/OverviewPage";
import DisciplesPage from "./pages/DisciplesPage";
import DiscipleProfilePage from "./pages/DiscipleProfilePage";
import SuiviPage from "./pages/SuiviPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import BotPage from "./pages/BotPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function validateSession() {
      const password = localStorage.getItem("dashboardPassword");

      if (!password) {
        setChecking(false);
        return;
      }

      try {
        await api.get("/api/auth/check");
        setIsAuthenticated(true);
      } catch (_error) {
        localStorage.removeItem("dashboardPassword");
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    }

    validateSession();
  }, []);

  function handleLogin() {
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem("dashboardPassword");
    setIsAuthenticated(false);
  }

  if (checking) {
    return <div className="p-6 text-sm text-theme-text2">Verification de session...</div>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <OverviewPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/disciples"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <DisciplesPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/disciples/:id"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <DiscipleProfilePage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/suivi"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <SuiviPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuration"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <ConfigurationPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bot"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated}>
            <BotPage onLogout={handleLogout} />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
