import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { Login } from './pages/Login';
import { VoterDashboard } from './pages/VoterDashboard';
import { Ballot } from './pages/Ballot';
import { Confirmation } from './pages/Confirmation';
import { AdminDashboard } from './pages/AdminDashboard';
import { CreateElection } from './pages/CreateElection';
import { Results } from './pages/Results';
import { NotFound } from './pages/NotFound';

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-brand-100 selection:text-brand-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<Login />} />

              {/* Root redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Voter routes (Protected) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <VoterDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ballot/:electionId"
                element={
                  <ProtectedRoute>
                    <Ballot />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/confirmation"
                element={
                  <ProtectedRoute>
                    <Confirmation />
                  </ProtectedRoute>
                }
              />

              {/* Admin-only routes (RoleRoute) */}
              <Route
                path="/admin"
                element={
                  <RoleRoute allowedRole="admin">
                    <AdminDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/elections/new"
                element={
                  <RoleRoute allowedRole="admin">
                    <CreateElection />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/results/:electionId"
                element={
                  <RoleRoute allowedRole="admin">
                    <Results />
                  </RoleRoute>
                }
              />

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="py-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">
                SecureVote &bull; Zero-Trust Campus Election & Audit Portal
              </span>
              <span className="text-slate-400 font-mono">
                CS Semester Project &bull; 3NF Anonymous Ledger
              </span>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
