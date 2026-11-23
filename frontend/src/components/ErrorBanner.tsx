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
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  };

  const iconStyles = {
    error: 'text-rose-600',
    warning: 'text-amber-600',
    info: 'text-sky-600',
  };

  return (
    <div
      role="alert"
      className={`flex items-start justify-between p-4 mb-4 border rounded-xl shadow-sm ${variantStyles[variant]} transition-all animate-fade-in`}
    >
      <div className="flex items-start space-x-3">
        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[variant]}`} />
        <div className="text-sm font-medium leading-relaxed">{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
