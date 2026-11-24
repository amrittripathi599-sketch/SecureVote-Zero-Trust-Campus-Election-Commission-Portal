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
import { ShieldCheck, Database, Lock, Cpu } from 'lucide-react';

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
        <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100 bg-mesh-grid relative selection:bg-emerald-500/30 selection:text-emerald-200">
          <Navbar />
          
          <main className="flex-1 relative z-10">
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

          {/* Official Footer */}
          <footer className="relative z-10 py-8 border-t border-white/5 bg-navy-900/80 backdrop-blur-md text-xs text-slate-400">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200">SecureVote Campus Portal</span>
                    <span className="block text-[11px] text-slate-400">Student Election Commission &bull; Official Voting Platform</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Confidential Ballot</span>
                  </span>
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Verified Vote Count</span>
                  </span>
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                    <Database className="w-3.5 h-3.5 text-purple-400" />
                    <span>Tamper-Proof Audit</span>
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
                <span>&copy; {new Date().getFullYear()} Campus Election Commission. All rights reserved.</span>
                <span className="mt-2 sm:mt-0">Official Student Voting Portal &bull; Designed for Campus Democracy</span>
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
