import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, Clock, Vote, ShieldCheck, Sparkles } from 'lucide-react';
import apiClient from '../api/client';
import { ErrorBanner } from '../components/ErrorBanner';

export const CreateElection: React.FC = () => {
  const navigate = useNavigate();

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const formatDatetimeForInput = (d: Date) => {
    const pad = (n: number) => (n < 10 ? `0${n}` : n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(formatDatetimeForInput(now));
  const [endTime, setEndTime] = useState(formatDatetimeForInput(nextWeek));
  const [status, setStatus] = useState<'draft' | 'open'>('open');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Please provide a title for the campus election.');
      return;
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (endDate <= startDate) {
      setError('Election end time must be chronologically after the start time.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/api/admin/elections', {
        title: title.trim(),
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status,
      });

      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create new election.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-fade-in text-left">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> BACK TO COMMISSION CONSOLE
        </Link>
      </div>

      <div className="glass-panel-elevated rounded-3xl p-6 sm:p-10 space-y-6 relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-emerald-400">
            <Vote className="w-6 h-6" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Schedule New Campus Election
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Configure the polling timeline, official position, and zero-trust ballot lifecycle.
          </p>
        </div>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-2">
              Election Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Computer Science Department Senate 2026"
              className="glass-input w-full px-4 py-3 rounded-xl text-xs placeholder:text-slate-600 focus:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-2">
                Voting Opens (Start Time)
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-xs font-mono focus:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-2">
                Voting Closes (Deadline)
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-xs font-mono focus:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-2">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="glass-input w-full px-4 py-3 rounded-xl text-xs focus:text-white"
            >
              <option value="open" className="bg-navy-950 text-white">Open (Immediate student participation enabled)</option>
              <option value="draft" className="bg-navy-950 text-white">Draft (Private setup mode)</option>
            </select>
          </div>

          <div className="p-4 bg-slate-900/80 rounded-2xl border border-white/10 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-white flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Immutable Election Genesis:</span>
            </div>
            <p>
              Once created, election creation is committed to the append-only audit trail in Azure PostgreSQL with Chief Officer credentials and timestamp.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <Link
              to="/admin"
              className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 text-navy-950 font-extrabold text-xs rounded-xl shadow-glow transition-all flex items-center space-x-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Publishing Election...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Publish Election</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
