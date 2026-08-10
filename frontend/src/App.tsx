import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import WorkspaceLayout from './layouts/WorkspaceLayout';
import ProjectLayout from './layouts/ProjectLayout';
import Home from './pages/Home';
import ProjectHome from './pages/ProjectHome';
import TranscriptViewer from './pages/TranscriptViewer';
import Login from './pages/Login';
import Placeholder from './pages/Placeholder';
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
            <Route path="search" element={<Placeholder title="Search" />} />
            <Route path="chat" element={<Placeholder title="Chat" />} />
            <Route path="dashboards" element={<Placeholder title="Dashboards" />} />
            <Route path="docs" element={<Placeholder title="Docs" />} />
            <Route path="settings" element={<Placeholder title="Settings" />} />
          </Route>
          
          {/* Project-level routes */}
          <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectLayout /></ProtectedRoute>}>
            <Route index element={<ProjectHome />} />
            <Route path="recordings/:recordingId" element={<TranscriptViewer />} />
            <Route path="insights" element={<Placeholder title="Insights" />} />
            <Route path="search" element={<Placeholder title="Search" />} />
            <Route path="tags" element={<Placeholder title="Tags" />} />
            <Route path="audit" element={<Placeholder title="Audit Log" />} />
            <Route path="settings" element={<Placeholder title="Project Settings" />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
