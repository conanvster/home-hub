import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MapPage from "./pages/MapPage";
import SyncStatusPage from "./pages/SyncStatusPage";
import AdminPage from "./pages/AdminPage";
import KanbanPage from "./pages/KanbanPage";
import { useAuthStore } from "./store/useAuthStore";
import { IS_LOCAL } from "./config";

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (IS_LOCAL) return children;
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {!IS_LOCAL && (
        <>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </>
      )}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <MapPage />
          </PrivateRoute>
        }
      />
      {IS_LOCAL && (
        <Route path="/sync" element={<Navigate to="/?tab=admin" replace />} />
      )}
      {!IS_LOCAL && (
        <>
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/kanban"
            element={
              <PrivateRoute>
                <KanbanPage />
              </PrivateRoute>
            }
          />
        </>
      )}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
