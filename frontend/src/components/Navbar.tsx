import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  LogOut,
  User as UserIcon,
  LayoutDashboard,
  ShieldAlert,
  Activity,
  CheckCircle2,
} from 'lucide-react';
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
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Official Emblem & Branding */}
          <Link to="/" className="flex items-center space-x-3.5 group">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 p-[1px] shadow-glow-sm group-hover:shadow-glow transition-all duration-300">
                <div className="w-full h-full bg-navy-950/90 rounded-[11px] flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6 transform group-hover:scale-105 transition-transform" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-navy-950"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  SECURE<span className="text-emerald-400 font-light">VOTE</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Zero-Trust v2.4
                </span>
              </div>
              <p className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                Campus Election Commission &bull; Audit Tribunal
              </p>
            </div>
          </Link>

          {/* User & Navigation controls */}
          {user ? (
            <div className="flex items-center space-x-3 sm:space-x-5">
              <nav className="hidden md:flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900/60 border border-white/5">
                {user.role === 'voter' ? (
                  <Link
                    to="/dashboard"
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-2 ${
                      location.pathname === '/dashboard'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Ballot Booth</span>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/admin"
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-2 ${
                        location.pathname === '/admin'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Commission Console</span>
                    </Link>
                    <Link
                      to="/dashboard"
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-2 ${
                        location.pathname === '/dashboard'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Elections Directory</span>
                    </Link>
                  </>
                )}
              </nav>

              {/* Status indicator */}
              <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Commission Network Active</span>
              </div>

              {/* User Executive Pill */}
              <div className="flex items-center pl-2 sm:pl-4 border-l border-white/10 space-x-3">
                <div className="flex items-center space-x-3 p-1.5 sm:pr-3 rounded-xl bg-slate-900/80 border border-white/10">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      user.role === 'admin'
                        ? 'bg-gradient-to-tr from-amber-500 to-purple-600 text-white shadow-sm'
                        : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-sm'
                    }`}
                  >
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                  </div>

                  <div className="hidden sm:block text-left leading-tight">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-slate-100 max-w-[130px] truncate">
                        {user.full_name}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {user.role === 'admin' ? 'Chief Officer' : 'Voter'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{user.roll_number}</span>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Sign out securely"
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active Election Window</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
