import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, User as UserIcon, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2 bg-brand-600 text-white rounded-xl shadow-md group-hover:bg-brand-700 transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold tracking-tight text-slate-900">SecureVote</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-brand-100 text-brand-800 rounded">
                  Zero-Trust
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Campus Election & Audit Portal</p>
            </div>
          </Link>

          {/* Navigation & User Profile */}
          {user ? (
            <div className="flex items-center space-x-4">
              <nav className="hidden md:flex items-center space-x-1">
                {user.role === 'voter' ? (
                  <Link
                    to="/dashboard"
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
                      location.pathname === '/dashboard'
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Elections</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/admin"
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
                        location.pathname === '/admin'
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Admin Console</span>
                    </Link>
                    <Link
                      to="/dashboard"
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center space-x-1.5 ${
                        location.pathname === '/dashboard'
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>All Elections</span>
                    </Link>
                  </>
                )}
              </nav>

              {/* User badge */}
              <div className="flex items-center pl-3 border-l border-slate-200 space-x-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-800 line-clamp-1">{user.full_name}</span>
                      <span
                        className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{user.roll_number}</span>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleLogout}
                  title="Sign out securely"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  aria-label="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm transition-colors"
            >
              Portal Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
