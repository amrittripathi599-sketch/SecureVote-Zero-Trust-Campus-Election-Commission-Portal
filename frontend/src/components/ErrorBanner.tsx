import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onDismiss,
  variant = 'error',
}) => {
  if (!message) return null;

  const variantStyles = {
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    info: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
  };

  const iconStyles = {
    error: 'text-rose-400',
    warning: 'text-amber-400',
    info: 'text-cyan-400',
  };

  return (
    <div
      role="alert"
      className={`flex items-start justify-between p-4 mb-4 border rounded-2xl shadow-lg backdrop-blur-md ${variantStyles[variant]} transition-all animate-fade-in text-left`}
    >
      <div className="flex items-start space-x-3">
        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[variant]}`} />
        <div className="text-xs sm:text-sm font-medium leading-relaxed">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
