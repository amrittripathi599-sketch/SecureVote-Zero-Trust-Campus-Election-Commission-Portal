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
      <div className="py-20">
        <LoadingSpinner message="Fetching campus elections from immutable ledger..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Zero-Trust Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-navy-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-brand-500/20 border border-brand-400/30 rounded-full text-brand-300 text-xs font-semibold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            <span>3NF Ballot Secrecy & Concurrency Guard</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Campus Elections & Ballots
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Every ballot cast is cryptographically decoupled from your institutional identity.
            The system records your participation timestamp to prevent double-voting, while the
            vote ledger preserves absolute ballot anonymity.
          </p>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Elections List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Available Ballots
          </h2>
          <span className="text-sm font-medium text-slate-500">
            {elections.length} {elections.length === 1 ? 'Election' : 'Elections'} listed
          </span>
        </div>

        {elections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <Vote className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No active elections</h3>
            <p className="mt-1 text-sm text-slate-500">
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
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-6 space-y-4">
                    {/* Status Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                          isOpen
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {election.status}
                      </span>

                      {hasVoted ? (
                        <span className="flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                          <span>Ballot Recorded</span>
                        </span>
                      ) : isOpen ? (
                        <span className="flex items-center space-x-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Action Required</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Election Title */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {election.title}
                      </h3>
                    </div>

                    {/* Meta info */}
                    <div className="space-y-2 text-xs text-slate-500">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>{election.candidate_count || 0} Registered Candidates</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span>Closes: {formatDate(election.end_time)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action footer */}
                  <div className="p-4 bg-slate-50/70 border-t border-slate-100">
                    {hasVoted ? (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-500 font-medium text-sm flex items-center justify-center space-x-2 cursor-not-allowed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Vote Successfully Recorded</span>
                      </div>
                    ) : !isOpen ? (
                      <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-400 font-medium text-sm flex items-center justify-center space-x-2 cursor-not-allowed">
                        <span>Voting Concluded</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(`/ballot/${election.election_id}`)}
                        className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-sm flex items-center justify-center space-x-2 transition-colors"
                      >
                        <Vote className="w-4 h-4" />
                        <span>Enter Ballot Booth</span>
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
