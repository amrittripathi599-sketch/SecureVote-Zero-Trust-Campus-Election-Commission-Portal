import React from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Lock, ArrowRight, Home } from 'lucide-react';

export const Confirmation: React.FC = () => {
  const location = useLocation();
  const state = location.state as { electionTitle?: string; timestamp?: string } | null;

  // If accessed directly without state, redirect to dashboard
  if (!state) {
    return <Navigate to="/dashboard" replace />;
  }

  const formattedTime = state.timestamp
    ? new Date(state.timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : new Date().toLocaleString();

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 sm:p-12 text-center space-y-6 animate-fade-in">
        {/* Animated Badge Icon */}
        <div className="mx-auto w-20 h-20 bg-emerald-100/80 border-4 border-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Cryptographically Verified</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Your Vote Has Been Recorded
          </h1>
          <p className="text-sm font-medium text-slate-500">
            {state.electionTitle || 'Campus Election 2026'}
          </p>
        </div>

        {/* 3NF Ballot Secrecy Guarantee Card */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-left space-y-3">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
            <Lock className="w-4 h-4 text-brand-600" />
            <span>Zero-Trust Ballot Secrecy Enforced</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            In compliance with campus election privacy architecture (3NF), your candidate choice is
            <strong> NEVER</strong> displayed on this screen nor stored alongside your student roll number.
            Your ballot was committed directly to the immutable votes ledger with zero user linkage.
          </p>
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Commit Timestamp:</span>
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* Return Button */}
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center w-full py-3 px-6 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-md transition-all space-x-2"
          >
            <Home className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
