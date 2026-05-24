import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return user ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return !user ? children : <Navigate to="/" replace />;
}

function SplashScreen() {
  return (
    <div className="h-full flex items-center justify-center bg-base">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan flex items-center justify-center font-bold text-xl animate-pulse">P</div>
        <p className="text-muted text-sm tracking-widest uppercase font-mono">Loading…</p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><SocketProvider><ChatPage /></SocketProvider></PrivateRoute>} />
      <Route path="/group/:groupId" element={<PrivateRoute><SocketProvider><ChatPage /></SocketProvider></PrivateRoute>} />
      <Route path="/:userId" element={<PrivateRoute><SocketProvider><ChatPage /></SocketProvider></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </AuthProvider>
  );
}
