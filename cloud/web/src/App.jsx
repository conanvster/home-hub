import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import MapPage from "./pages/MapPage";
import AdminPage from "./pages/AdminPage";
import KanbanPage from "./pages/KanbanPage";
import HAPage from "./pages/HAPage";
import ChatPage from "./pages/ChatPage";
import InvitePage from "./pages/InvitePage";
import ProfilePage from "./pages/ProfilePage";
import { useAuthStore } from "./store/useAuthStore";
import { IS_LOCAL } from "./config";

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (IS_LOCAL) return children;
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  if (IS_LOCAL) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/kanban" replace />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/ha" element={<HAPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/kanban" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/invite" element={<InvitePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<PrivateRoute><MapPage /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
