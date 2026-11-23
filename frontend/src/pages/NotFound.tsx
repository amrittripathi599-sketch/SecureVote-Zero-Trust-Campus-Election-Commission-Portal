import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-md w-full glass-panel-elevated rounded-3xl border border-white/10 p-8 text-center shadow-2xl space-y-6">
        <div className="mx-auto w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center text-emerald-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-white tracking-tight font-mono">404</h1>
          <p className="text-base font-bold text-slate-200">Cryptographic Resource Not Found</p>
          <p className="text-xs text-slate-400">
            The requested election tribunal endpoint or page does not exist or has been retired.
          </p>
        </div>
        <div>
          <Link
            to="/"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-navy-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 shadow-glow transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Return to Portal</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
