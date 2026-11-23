import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Vote,
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  Shield,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Lock,
} from 'lucide-react';
import apiClient from '../api/client';
import { Election } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBanner } from '../components/ErrorBanner';

export const VoterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [elections, setElections] = useState<Election[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Election[]>('/api/elections');
      setElections(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to retrieve active campus elections.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner message="Fetching campus elections from immutable ledger..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in text-left">
      {/* Zero-Trust Header Banner */}
      <div className="glass-panel-elevated rounded-3xl p-8 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            <span>3NF Ballot Secrecy Active</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Official Campus Elections &amp; Ballots
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Every ballot cast is cryptographically decoupled from your institutional identity.
            The system records your participation timestamp to prevent double-voting, while the
            vote ledger preserves absolute ballot anonymity.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-slate-400">
            <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Ledger: PostgreSQL 15</span>
            </span>
            <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/5">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>Zero Identity Tracking</span>
            </span>
          </div>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Elections Directory */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>Active Election Registry</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/20 text-emerald-300">
                {elections.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Participate in open student body elections</p>
          </div>
        </div>

        {elections.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-slate-500 mb-4">
              <Vote className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No active elections</h3>
            <p className="mt-1 text-xs text-slate-400">
              There are currently no active or upcoming elections scheduled by the election commission.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {elections.map((election) => {
              const isOpen = election.status === 'open';
              const hasVoted = election.has_current_user_voted;

              return (
                <div
                  key={election.election_id}
                  className="glass-panel rounded-3xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group shadow-xl hover:shadow-2xl"
                >
                  <div className="p-6 space-y-4">
                    {/* Status Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                          isOpen
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-white/10'
                        }`}
                      >
                        {election.status}
                      </span>

                      {hasVoted ? (
                        <span className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Ballot Sealed</span>
                        </span>
                      ) : isOpen ? (
                        <span className="flex items-center space-x-1 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Vote Pending</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Election Title */}
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {election.title}
                      </h3>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-2 text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <span>{election.candidate_count || 0} Registered Candidates</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>Closes: {formatDate(election.end_time)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action footer */}
                  <div className="p-4 bg-navy-900/60 border-t border-white/5">
                    {hasVoted ? (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-slate-400 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/5 cursor-not-allowed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Ballot Verified &amp; Recorded</span>
                      </div>
                    ) : !isOpen ? (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-slate-500 font-semibold text-xs flex items-center justify-center space-x-2 border border-white/5 cursor-not-allowed">
                        <span>Voting Window Concluded</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/ballot/${election.election_id}`)}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-navy-950 font-extrabold text-xs shadow-glow-sm hover:shadow-glow flex items-center justify-center space-x-2 transition-all duration-300"
                      >
                        <Vote className="w-4 h-4" />
                        <span>Enter Official Ballot Booth</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
