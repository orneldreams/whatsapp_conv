import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import OverviewPage from "./pages/OverviewPage";
import DisciplesPage from "./pages/DisciplesPage";
import DiscipleProfilePage from "./pages/DiscipleProfilePage";
import ConversationPage from "./pages/ConversationPage";
import SuiviPage from "./pages/SuiviPage";
import DiscussionsPage from "./pages/DiscussionsPage";
import ConfigurationPage from "./pages/ConfigurationPage";
import BotPage from "./pages/BotPage";
import NotFoundPage from "./pages/NotFoundPage";

function App() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/forgot-password"
        element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OverviewPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profil"
        element={
          <ProtectedRoute>
            <ProfilePage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/disciples"
        element={
          <ProtectedRoute>
            <DisciplesPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/disciples/:id"
        element={
          <ProtectedRoute>
            <DiscipleProfilePage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/disciples/:id/conversation"
        element={
          <ProtectedRoute>
            <ConversationPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/suivi"
        element={
          <ProtectedRoute>
            <SuiviPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/discussions"
        element={
          <ProtectedRoute>
            <DiscussionsPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuration"
        element={
          <ProtectedRoute>
            <ConfigurationPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/bot"
        element={
          <ProtectedRoute>
            <BotPage onLogout={logout} />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
