import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertTriangle, ArrowRight } from 'lucide-react';
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
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-brand-600 text-white rounded-2xl shadow-lg ring-4 ring-brand-100">
            <ShieldCheck className="w-10 h-10" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          SecureVote Portal
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Zero-Trust Campus Election & Immutability Audit System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl sm:px-10 border border-slate-100">
          {sessionExpired && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>Your session has expired. Please sign in again.</span>
            </div>
          )}

          <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="rollNumber" className="block text-sm font-medium text-slate-700">
                Institutional Roll Number
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-5 w-5" />
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm font-mono uppercase transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 w-5" />
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
                  className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl focus:ring-brand-500 focus:border-brand-500 sm:text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Credentials...</span>
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

          {/* Quick Demo Selector for Evaluators */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              Faculty / Evaluator Demo Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount('ADMIN001', 'Admin@123')}
                className="px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors text-left"
              >
                <div className="font-semibold">Mr. Amrit Tripathi (Admin)</div>
                <div className="text-[11px] font-mono text-purple-500">ADMIN001</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('STU001', 'Voter@123')}
                className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors text-left"
              >
                <div className="font-semibold">Student Voter 1</div>
                <div className="text-[11px] font-mono text-emerald-500">STU001</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('STU002', 'Voter@123')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors text-left"
              >
                <div className="font-semibold">Student Voter 2</div>
                <div className="text-[11px] font-mono text-slate-500">STU002</div>
              </button>

              <button
                type="button"
                onClick={() => fillDemoAccount('STU004', 'Voter@123')}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors text-left"
              >
                <div className="font-semibold">Student Voter 4</div>
                <div className="text-[11px] font-mono text-slate-500">STU004</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
