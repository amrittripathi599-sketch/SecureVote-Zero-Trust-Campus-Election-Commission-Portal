import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Server,
  FileCheck2,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner } from '../components/ErrorBanner';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [rollNumber, setRollNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Switcher mode: 'admin' | 'students'
  const [demoRole, setDemoRole] = useState<'admin' | 'students'>('admin');

  const queryParams = new URLSearchParams(location.search);
  const sessionExpired = queryParams.get('session_expired');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !password.trim()) {
      setErrorMessage('Please enter both your institutional roll number and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const user = await login(rollNumber.trim(), password);
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setErrorMessage(
          err.response.data?.detail || 'Too many failed login attempts. Account temporarily throttled for 10 minutes.'
        );
      } else if (err.response?.status === 401) {
        setErrorMessage('Authentication failed: Invalid roll number or password.');
      } else {
        setErrorMessage(
          err.response?.data?.detail || 'Unable to connect to the authentication service. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoAccount = (demoRoll: string, demoPass: string) => {
    setRollNumber(demoRoll);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[350px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10">
        
        {/* Left Column: Official Tribunal Briefing & Telemetry */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center space-x-2.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>OFFICIAL ELECTION PORTAL</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Cryptographic Voting,{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Absolute Secrecy.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              Campus Election Commission zero-trust portal. Ballots are cryptographically decoupled from
              voter identity using strict 3NF database architecture, backed by real-time immutable PostgreSQL triggers.
            </p>
          </div>

          {/* Institutional Trust Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center space-x-2.5 text-emerald-400 font-semibold text-xs mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>3NF Voter Anonymity</span>
              </div>
              <p className="text-[12px] text-slate-400 leading-normal">
                Zero database linkage between voter identity and candidate selections.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center space-x-2.5 text-blue-400 font-semibold text-xs mb-1">
                <FileCheck2 className="w-4 h-4" />
                <span>Immutable Audit Ledger</span>
              </div>
              <p className="text-[12px] text-slate-400 leading-normal">
                PostgreSQL BEFORE UPDATE/DELETE triggers guarantee unalterable vote logs.
              </p>
            </div>
          </div>

          {/* Live System Telemetry Terminal Box */}
          <div className="p-4 rounded-2xl bg-navy-900/90 border border-white/10 font-mono text-[11px] space-y-2 text-slate-400 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 text-slate-500 text-[10px]">
              <span className="flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>COMMISSION TELEMETRY</span>
              </span>
              <span className="text-emerald-400 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>SYNCED</span>
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Database Engine:</span>
              <span className="text-emerald-300 font-semibold">Azure PostgreSQL 15 (ACI)</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Immutability Engine:</span>
              <span className="text-blue-300">PostgreSQL Strict Triggers</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Chief Officer:</span>
              <span className="text-amber-300 font-bold">Mr. Amrit Tripathi</span>
            </div>
          </div>
        </div>

        {/* Right Column: High-End Security Login Card */}
        <div className="lg:col-span-6">
          <div className="glass-panel-elevated p-7 sm:p-9 rounded-3xl relative">
            <div className="text-left mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Authentication Terminal
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                  SHA-256 Verified
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
                Sign In to Portal
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your institutional student or faculty commission credentials.
              </p>
            </div>

            {sessionExpired && (
              <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Your session expired for security reasons. Please sign in again.</span>
              </div>
            )}

            <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="rollNumber" className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
                  Institutional ID / Roll Number
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="rollNumber"
                    name="rollNumber"
                    type="text"
                    autoComplete="username"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. STU001 or ADMIN001"
                    className="glass-input block w-full pl-10 pr-3.5 py-3 rounded-xl text-xs font-mono tracking-wider uppercase placeholder:text-slate-600 focus:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
                  Master Password
                </label>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="glass-input block w-full pl-10 pr-10 py-3 rounded-xl text-xs placeholder:text-slate-600 focus:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-xs font-extrabold tracking-wide text-navy-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 shadow-glow hover:shadow-glow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="flex items-center space-x-2">
                      <span className="w-4 h-4 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Cryptographic Credentials...</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-2">
                      <span>Authorize & Enter Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* High-End Quick Access Drawer for Evaluators */}
            <div className="mt-7 pt-5 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-slate-400 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>One-Click Evaluator Access</span>
                </span>
                
                {/* Segmented Tab */}
                <div className="flex p-0.5 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-medium">
                  <button
                    type="button"
                    onClick={() => setDemoRole('admin')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      demoRole === 'admin'
                        ? 'bg-purple-600 text-white font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Commission
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoRole('students')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      demoRole === 'students'
                        ? 'bg-emerald-600 text-white font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Voters
                  </button>
                </div>
              </div>

              {demoRole === 'admin' ? (
                <div
                  onClick={() => fillDemoAccount('ADMIN001', 'Admin@123')}
                  className="group cursor-pointer p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-purple-900/30 to-slate-900 border border-purple-500/30 hover:border-purple-400 transition-all flex items-center justify-between text-left"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
                      AT
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">Mr. Amrit Tripathi</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Chief Officer
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-purple-300">ADMIN001 &bull; Admin@123</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-purple-400 group-hover:text-purple-300 flex items-center space-x-1">
                    <span>Fill</span>
                    <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => fillDemoAccount('STUD001', 'Password@123')}
                    className="cursor-pointer p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all text-left group"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 truncate">
                      Student Voter 1
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400">STUD001</div>
                  </div>

                  <div
                    onClick={() => fillDemoAccount('STUD002', 'Password@123')}
                    className="cursor-pointer p-2.5 rounded-xl bg-slate-900/80 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all text-left group"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 truncate">
                      Student Voter 2
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-400">STUD002</div>
                  </div>

                  <div
                    onClick={() => fillDemoAccount('STUD003', 'Password@123')}
                    className="cursor-pointer p-2.5 rounded-xl bg-slate-900/80 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all text-left group"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 truncate">
                      Student Voter 3
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-400">STUD003</div>
                  </div>

                  <div
                    onClick={() => fillDemoAccount('STU004', 'Voter@123')}
                    className="cursor-pointer p-2.5 rounded-xl bg-slate-900/80 border border-white/5 hover:border-emerald-500/40 hover:bg-emerald-950/20 transition-all text-left group"
                  >
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 truncate">
                      Student Voter 4
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 group-hover:text-emerald-400">STU004</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
