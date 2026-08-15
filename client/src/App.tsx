import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import FolderDetail from './pages/FolderDetail';
import MeetingRoom from './pages/MeetingRoom';
import HistoryDetail from './pages/HistoryDetail';
import SearchConsole from './pages/SearchConsole';
import Login from './pages/Login';
import { api } from './services/api';
import { Loader2 } from 'lucide-react';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await api.getCurrentUser();
        setAuthenticated(true);
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };
    verifyAuth();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  return authenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/folder/:id" element={<AuthGuard><FolderDetail /></AuthGuard>} />
        <Route path="/meeting/:id" element={<AuthGuard><MeetingRoom /></AuthGuard>} />
        <Route path="/history/:id" element={<AuthGuard><HistoryDetail /></AuthGuard>} />
        <Route path="/search" element={<AuthGuard><SearchConsole /></AuthGuard>} />
      </Routes>
    </Router>
  );
}

export default App;
