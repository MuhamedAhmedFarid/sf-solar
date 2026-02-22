
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { AdminPortal } from './components/AdminPortal';
import { ClientPortal } from './components/ClientPortal';
import { PayrollPortal } from './components/PayrollPortal';
import { RepPortal } from './components/RepPortal';
import { LeadBoardPage } from './components/LeadBoardPage';
import { UserRole, AuthState } from './types';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    role: null,
    user: null,
    authenticated: false
  });

  const [targetRole, setTargetRole] = useState<UserRole>(null);
  const [pathname, setPathname] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : ''
  );

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Check for stored session on mount
  useEffect(() => {
    const stored = localStorage.getItem('sf_auth');
    if (stored) {
      setAuth(JSON.parse(stored));
    }
  }, []);

  const handleSelectRole = (role: UserRole) => {
    setTargetRole(role);
  };

  const handleLoginSuccess = (role: UserRole, user: any) => {
    const newAuth = { role, user, authenticated: true };
    setAuth(newAuth);
    localStorage.setItem('sf_auth', JSON.stringify(newAuth));
  };

  const handleLogout = () => {
    setAuth({ role: null, user: null, authenticated: false });
    setTargetRole(null);
    localStorage.removeItem('sf_auth');
  };

  // Main UI routing (direct-access lead board has no auth)
  const renderContent = () => {
    if (pathname === '/lead-board' || targetRole === 'LEADERBOARD') {
      return <LeadBoardPage />;
    }
    if (auth.authenticated) {
      switch (auth.role) {
        case 'ADMIN': return <AdminPortal user={auth.user} onLogout={handleLogout} />;
        case 'CLIENT': return <ClientPortal client={auth.user} onLogout={handleLogout} />;
        case 'PAYROLL': return <PayrollPortal onLogout={handleLogout} />;
        case 'REP': return <RepPortal rep={auth.user} onLogout={handleLogout} />;
        default: return <LandingPage onSelectRole={handleSelectRole} />;
      }
    }

    if (targetRole) {
      return (
        <LoginPage 
          role={targetRole} 
          onSuccess={handleLoginSuccess} 
          onCancel={() => setTargetRole(null)} 
        />
      );
    }

    return <LandingPage onSelectRole={handleSelectRole} />;
  };

  return (
    <div className="min-h-screen bg-solar-bg">
      {renderContent()}
    </div>
  );
};

export default App;
