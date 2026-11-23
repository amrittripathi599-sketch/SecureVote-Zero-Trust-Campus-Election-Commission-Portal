import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  User,
  Vote,
  Lock,
} from 'lucide-react';
import apiClient from '../api/client';
import { Candidate, Election } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBanner } from '../components/ErrorBanner';

export const Ballot: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const navigate = useNavigate();

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    if (electionId) {
      loadBallotData(Number(electionId));
    }
  }, [electionId]);

  const loadBallotData = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [electionRes, candidatesRes, statusRes] = await Promise.all([
        apiClient.get<Election>(`/api/elections/${id}`),
        apiClient.get<Candidate[]>(`/api/elections/${id}/candidates`),
        apiClient.get<{ has_voted: boolean }>(`/api/votes/status/${id}`),
      ]);

      setElection(electionRes.data);
      setCandidates(candidatesRes.data);
      setHasVoted(statusRes.data.has_voted);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to initialize voting booth.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCastVote = async () => {
    if (!selectedCandidateId || !election) return;
    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post('/api/votes', {
        election_id: election.election_id,
        candidate_id: selectedCandidateId,
      });

      // Navigate to confirmation page preserving zero-trust secrecy
      navigate('/confirmation', {
        state: {
          electionTitle: election.title,
          timestamp: new Date().toISOString(),
        },
        replace: true,
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'An error occurred while submitting your vote. Please try again.'
      );
      setShowConfirmModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCandidate = candidates.find((c) => c.candidate_id === selectedCandidateId);

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner message="Entering isolated voting booth..." size="lg" />
      </div>
    );
  }

  if (!election) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <div className="glass-panel p-6 rounded-2xl text-rose-300 border-rose-500/30">
          Election not found or no longer available.
        </div>
        <Link to="/dashboard" className="mt-4 inline-flex items-center text-emerald-400 font-semibold text-sm">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  const isClosed = election.status !== 'open';
  const isVotingDisabled = hasVoted || isClosed;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 animate-fade-in text-left">
      {/* Back button */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> BACK TO DIRECTORY
        </Link>
      </div>

      {/* Header */}
      <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-3 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            OFFICIAL ELECTRONIC BALLOT
          </span>
          <span className="text-xs text-slate-400 font-mono">
            ELECTION #{election.election_id}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {election.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
          Select one approved nominee from the official commission slate below. Your vote is recorded
          under strict 3NF anonymity: your identity is not linked to your choice.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Warning banner if already voted or closed */}
      {hasVoted && (
        <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-300 flex items-start space-x-3 text-xs">
          <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Ballot Already Sealed:</span> You have already cast your ballot in this election.
            Zero-trust duplicate protection prohibits multiple submissions.
          </div>
        </div>
      )}

      {isClosed && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 flex items-start space-x-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Voting Closed:</span> The official election commission window for this election
            has concluded.
          </div>
        </div>
      )}

      {/* Candidates Selection Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-wide uppercase">
            Nominated Candidates ({candidates.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Select exactly 1</span>
        </div>

        {candidates.length === 0 ? (
          <div className="glass-panel rounded-3xl p-8 text-center text-slate-400 text-xs">
            No candidates have been nominated for this election yet.
          </div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => {
              const isSelected = selectedCandidateId === candidate.candidate_id;
              const manifestoFullUrl = candidate.manifesto_url
                ? candidate.manifesto_url.startsWith('http')
                  ? candidate.manifesto_url
                  : `${API_BASE_URL}${candidate.manifesto_url}`
                : null;

              return (
                <div
                  key={candidate.candidate_id}
                  onClick={() => !isVotingDisabled && setSelectedCandidateId(candidate.candidate_id)}
                  className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isVotingDisabled
                      ? 'opacity-50 glass-panel cursor-not-allowed'
                      : isSelected
                      ? 'glass-panel-elevated border-emerald-400/80 shadow-glow-sm cursor-pointer'
                      : 'glass-panel hover:border-slate-500 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Radio indicator */}
                    <div className="mt-1">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-500'
                            : 'border-slate-600 bg-slate-900'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-navy-950" />}
                      </div>
                    </div>

                    {/* Candidate info */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-white">{candidate.full_name}</span>
                        <span className="text-xs font-mono text-slate-400">({candidate.roll_number})</span>
                      </div>
                      <p className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-wide">
                        {candidate.position}
                      </p>
                      {candidate.slogan && (
                        <p className="text-xs text-slate-300 italic">"{candidate.slogan}"</p>
                      )}
                    </div>
                  </div>

                  {/* Manifesto download link */}
                  <div className="flex items-center space-x-3 sm:self-center pl-9 sm:pl-0">
                    {manifestoFullUrl ? (
                      <a
                        href={manifestoFullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/20 transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Manifesto (PDF)</span>
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No manifesto attached</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voting Action Bar */}
      <div className="sticky bottom-4 glass-panel-elevated rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/10">
        <div className="text-xs sm:text-sm text-slate-300">
          {selectedCandidate ? (
            <span className="font-semibold text-white">
              Selected Choice: <span className="text-emerald-400 font-bold">{selectedCandidate.full_name}</span> ({selectedCandidate.position})
            </span>
          ) : (
            <span className="text-slate-500 font-mono text-xs">Select a candidate above to unlock ballot seal</span>
          )}
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={!selectedCandidateId || isVotingDisabled || isSubmitting}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-xs text-navy-950 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-glow transition-all flex items-center justify-center space-x-2 cursor-pointer"
        >
          <Vote className="w-4 h-4" />
          <span>Cast Immutable Ballot</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel-elevated rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/15 space-y-5">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirm Official Ballot</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You are about to cast your vote for{' '}
              <strong className="text-emerald-400">{selectedCandidate.full_name}</strong> as{' '}
              <strong className="text-white">{selectedCandidate.position}</strong>.
            </p>

            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-white/10 text-[11px] text-slate-400 space-y-1 font-mono">
              <div className="font-bold text-emerald-400 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero-Trust Secrecy Protocol</span>
              </div>
              <p>
                Once committed to Azure PostgreSQL, the vote ledger is immutably sealed.
                Your choice cannot be viewed or revoked by anyone.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                Change Choice
              </button>
              <button
                type="button"
                onClick={handleCastVote}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-extrabold text-navy-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 rounded-xl shadow-glow transition-all flex items-center space-x-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-navy-950 border-t-transparent rounded-full animate-spin" />
                    <span>Committing Ballot...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm &amp; Seal Ballot</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
