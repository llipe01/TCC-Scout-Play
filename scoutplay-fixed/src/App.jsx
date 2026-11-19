import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { FeedProvider } from './contexts/FeedContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { Nav, NavDock } from './components';
import LoginPage from './pages/LoginPage';
import AthleteHome from './pages/AthleteHome';
import AthleteExplore from './pages/AthleteExplore';
import ProfilePage from './pages/ProfilePage';
import ScoutView from './pages/ScoutView';

function AppContent() {
  const { user, logout } = useAuth();
  const { navHidden } = useTheme();
  const [page, setPage] = useState('home');
  const dockVisible = !!user && navHidden;

  // Land on a tab that actually exists in the current role's menu
  // (e.g. scouts have no "home" tab, so without this the sidebar
  // would load with no item highlighted).
  useEffect(() => {
    if (user) {
      setPage(user.role === 'scout' ? 'dashboard' : 'home');
    }
  }, [user?.role]);

  // Marca o <body> para ajustar espaçamentos (conteúdo/toasts) quando o menu está oculto
  useEffect(() => {
    document.body.classList.toggle('nav-hidden', dockVisible);
    return () => document.body.classList.remove('nav-hidden');
  }, [dockVisible]);

  if (!user) {
    return <LoginPage />;
  }

  const isScout = user.role === 'scout';

  return (
    <div className="app-shell">
      {navHidden
        ? <NavDock role={user.role} page={page} setPage={setPage} />
        : <Nav role={user.role} page={page} setPage={setPage} logout={logout} />}
      <main className="main">
        {isScout ? (
          <ScoutView page={page} setPage={setPage} />
        ) : page === 'explore' ? (
          <AthleteExplore />
        ) : page === 'profile' ? (
          <ProfilePage role="athlete" />
        ) : (
          <AthleteHome setPage={setPage} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <FeedProvider>
            <AppContent />
          </FeedProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
