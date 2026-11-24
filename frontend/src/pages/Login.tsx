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
  FileCheck2,
  ShieldAlert,
  CheckCircle2,
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
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryParams = new URLSearchParams(location.search);
  const sessionExpired = queryParams.get('session_expired');

  const handleKeyModifier = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim() || !password.trim()) {
      setErrorMessage('Please enter both your institutional ID and password.');
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
        setErrorMessage('Authentication failed: Invalid institutional ID or password.');
      } else {
        setErrorMessage(
          err.response?.data?.detail || 'Unable to connect to the authentication service. Please try again.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[350px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10">
        
        {/* Left Column: Official Commission Briefing */}
        <div className="lg:col-span-6 space-y-6 text-left">
          <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>CAMPUS ELECTION COMMISSION &bull; STUDENT PORTAL</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Student Council Elections,{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Confidential &amp; Secure.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              Welcome to the official university election portal. Vote for your student council
              representatives with complete confidence. Your ballot is strictly private, 
              anonymous, and securely recorded.
            </p>
          </div>

          {/* Institutional Trust Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center space-x-2.5 text-emerald-400 font-semibold text-xs mb-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>100% Anonymous Ballots</span>
              </div>
              <p className="text-[12px] text-slate-400 leading-normal">
                Your personal identity is never attached to your candidate selection.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-colors">
              <div className="flex items-center space-x-2.5 text-blue-400 font-semibold text-xs mb-1.5">
                <FileCheck2 className="w-4 h-4" />
                <span>Verified Vote Count</span>
              </div>
              <p className="text-[12px] text-slate-400 leading-normal">
                Every vote is counted accurately and protected against modification.
              </p>
            </div>
          </div>

          {/* Institutional Commission Verification Card */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-xs space-y-2.5 text-slate-300 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="flex items-center space-x-2 font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                <span>ELECTION COMMISSION</span>
              </span>
              <span className="text-emerald-400 flex items-center space-x-1.5 text-[11px] font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SECURE CONNECTION</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Chief Election Officer:</span>
              <span className="text-amber-300 font-bold font-mono">Mr. Amrit Tripathi</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Election Cycle:</span>
              <span className="text-emerald-300 font-medium">2026–2027 Student Senate</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Polling Status:</span>
              <span className="text-blue-300 font-medium text-[11px]">Voting Active</span>
            </div>
          </div>
        </div>

        {/* Right Column: Genuine Institutional Login Card */}
        <div className="lg:col-span-6">
          <div className="glass-panel-elevated p-8 sm:p-10 rounded-3xl relative">
            <div className="text-left mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                  Voter Identification
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                  Encrypted
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1.5">
                Sign In to Vote
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your student roll number or administrator credentials.
              </p>
            </div>

            {sessionExpired && (
              <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>Your session expired. Please sign in again.</span>
              </div>
            )}

            <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="rollNumber" className="block text-xs font-semibold text-slate-300 mb-1.5 text-left">
                  Student ID / Roll Number
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
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-300 text-left">
                    Password
                  </label>
                  {capsLockOn && (
                    <span className="text-[10px] font-mono font-semibold text-amber-400 flex items-center space-x-1 animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>CAPS LOCK ON</span>
                    </span>
                  )}
                </div>
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
                    onKeyDown={handleKeyModifier}
                    onKeyUp={handleKeyModifier}
                    placeholder="••••••••••••"
                    className="glass-input block w-full pl-10 pr-10 py-3 rounded-xl text-xs placeholder:text-slate-600 focus:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
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
                      <span>Signing in...</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-2">
                      <span>Sign In to Vote</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Official Institutional Disclaimer & Security Assurance */}
            <div className="mt-8 pt-5 border-t border-white/10 text-center space-y-2">
              <div className="flex items-center justify-center space-x-1.5 text-[11px] font-mono text-emerald-400">
                <Lock className="w-3 h-3" />
                <span>Official Student Voting System</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                Please use your university-assigned roll number and password. For voting assistance or login issues, contact the election desk.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
