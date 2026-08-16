import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import WorkspaceLayout from './layouts/WorkspaceLayout';
import ProjectLayout from './layouts/ProjectLayout';
import Home from './pages/Home';
import ProjectHome from './pages/ProjectHome';
import TranscriptViewer from './pages/TranscriptViewer';
import Login from './pages/Login';
import Insights from './pages/Insights';
import Tags from './pages/Tags';
import Search from './pages/Search';
import AuditLog from './pages/AuditLog';
import PIIReview from './pages/PIIReview';
import SettingsPage from './pages/SettingsPage';
import { AuthProvider, useAuth } from './AuthContext';
import { ToastProvider } from './components/Toast';
import { Spinner } from './components/Spinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0a0a0a', color: '#888', gap: 8,
      }}>
        <Spinner size="sm" />
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Workspace-level routes */}
          <Route path="/" element={<ProtectedRoute><WorkspaceLayout /></ProtectedRoute>}>
            <Route index element={<Home />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          
          {/* Project-level routes */}
          <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectLayout /></ProtectedRoute>}>
            <Route index element={<ProjectHome />} />
            <Route path="recordings/:recordingId" element={<TranscriptViewer />} />
            <Route path="recordings/:recordingId/pii" element={<PIIReview />} />
            <Route path="insights" element={<Insights />} />
            <Route path="search" element={<Search />} />
            <Route path="tags" element={<Tags />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="settings" element={<SettingsPage projectMode />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
