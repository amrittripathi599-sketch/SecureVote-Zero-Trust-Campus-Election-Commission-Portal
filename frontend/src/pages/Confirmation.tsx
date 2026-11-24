import React, { useState } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Home,
  Copy,
  Check,
  Hash,
  Clock,
  Database,
} from 'lucide-react';

export const Confirmation: React.FC = () => {
  const location = useLocation();
  const state = location.state as { electionTitle?: string; timestamp?: string } | null;
  const [copied, setCopied] = useState(false);

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

  // Deterministic mock transaction proof based on timestamp
  const mockReceiptHash = `0x${Array.from(state.timestamp || '2026-11-23')
    .map((c) => c.charCodeAt(0).toString(16))
    .join('')
    .padEnd(40, 'a7e93f')
    .slice(0, 42)}`;

  const copyReceipt = () => {
    navigator.clipboard.writeText(mockReceiptHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden animate-fade-in text-left">
      {/* Ambient glow behind seal */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[450px] bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-xl w-full glass-panel-elevated rounded-3xl p-8 sm:p-12 text-center space-y-6 relative z-10 shadow-2xl border border-white/10">
        {/* Animated Badge Icon */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-60"></div>
          <div className="relative w-20 h-20 bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 rounded-full flex items-center justify-center text-navy-950 shadow-glow">
            <CheckCircle2 className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Official Vote Cast</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Your Ballot Has Been Recorded
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-medium">
            {state.electionTitle || 'Campus Election 2026'}
          </p>
        </div>

        {/* Voting Confirmation Reference Box */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-left space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-white/5">
            <span className="flex items-center space-x-1.5">
              <Hash className="w-3.5 h-3.5 text-emerald-400" />
              <span>OFFICIAL VOTING CONFIRMATION CODE</span>
            </span>
            <button
              onClick={copyReceipt}
              className="text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="text-[10px]">Copy Code</span>
                </>
              )}
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-navy-950 border border-white/5 text-[11px] text-emerald-300 break-all select-all">
            {mockReceiptHash}
          </div>

          <div className="pt-2 flex items-center justify-between text-[10px] text-slate-500">
            <span className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>Timestamp: {formattedTime}</span>
            </span>
            <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Vote Verified</span>
            </span>
          </div>
        </div>

        {/* Ballot Privacy Notice */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2 text-xs">
          <div className="flex items-center space-x-2 text-white font-bold">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Ballot Privacy Guarantee</span>
          </div>
          <p className="text-[12px] text-slate-400 leading-relaxed">
            Your vote has been recorded anonymously. For complete privacy, your student ID is never
            stored with your candidate selection. Thank you for participating in campus elections!
          </p>
        </div>

        {/* Return Button */}
        <div className="pt-2">
          <Link
            to="/dashboard"
            className="w-full inline-flex items-center justify-center py-3 px-6 rounded-xl font-bold text-xs text-navy-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 shadow-glow transition-all space-x-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Elections Directory</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
