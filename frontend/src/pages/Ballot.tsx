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
      <div className="py-20">
        <LoadingSpinner message="Entering isolated voting booth..." size="lg" />
      </div>
    );
  }

  if (!election) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
          Election not found or no longer available.
        </div>
        <Link to="/dashboard" className="mt-4 inline-flex items-center text-brand-600 font-semibold">
          <ArrowLeft className="w-4 h-4 mr-1" /> Return to Dashboard
        </Link>
      </div>
    );
  }

  const isClosed = election.status !== 'open';
  const isVotingDisabled = hasVoted || isClosed;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Elections
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
            Official Ballot
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Election ID: #{election.election_id}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {election.title}
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Select one candidate from the approved nominees below. You may inspect their policy manifesto
          before casting your immutable ballot.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Warning banner if already voted or closed */}
      {hasVoted && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-800 flex items-start space-x-3">
          <CheckCircle className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Ballot Already Cast:</span> You have already participated in this
            election. In accordance with zero-trust integrity, multiple ballots are strictly prohibited.
          </div>
        </div>
      )}

      {isClosed && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Election Closed:</span> The official voting period for this election has
            concluded. New votes are rejected by the immutable ledger.
          </div>
        </div>
      )}

      {/* Candidates Selection Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-800">Nominated Candidates ({candidates.length})</h2>

        {candidates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
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
                  className={`p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isVotingDisabled
                      ? 'opacity-60 bg-slate-50 border-slate-200 cursor-not-allowed'
                      : isSelected
                      ? 'bg-brand-50/60 border-brand-600 shadow-md cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Radio indicator */}
                    <div className="mt-1">
                      <input
                        type="radio"
                        id={`cand-${candidate.candidate_id}`}
                        name="candidate"
                        checked={isSelected}
                        disabled={isVotingDisabled}
                        onChange={() => setSelectedCandidateId(candidate.candidate_id)}
                        className="w-5 h-5 text-brand-600 focus:ring-brand-500 border-slate-300 transition-colors"
                      />
                    </div>

                    {/* Candidate info */}
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-slate-900">{candidate.full_name}</span>
                        <span className="text-xs font-mono text-slate-400">({candidate.roll_number})</span>
                      </div>
                      <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
                        {candidate.position}
                      </p>
                      {candidate.slogan && (
                        <p className="text-sm text-slate-600 italic">"{candidate.slogan}"</p>
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
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Manifesto (PDF)</span>
                        <ExternalLink className="w-3 h-3 text-brand-500" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No manifesto attached</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Voting Action Bar */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs sm:text-sm text-slate-600">
          {selectedCandidate ? (
            <span className="font-semibold text-slate-900">
              Selected: <span className="text-brand-600">{selectedCandidate.full_name}</span> ({selectedCandidate.position})
            </span>
          ) : (
            <span className="italic text-slate-500">Select a candidate above to enable ballot submission</span>
          )}
        </div>

        <button
          onClick={() => setShowConfirmModal(true)}
          disabled={!selectedCandidateId || isVotingDisabled || isSubmitting}
          className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all flex items-center justify-center space-x-2"
        >
          <Vote className="w-4 h-4" />
          <span>Cast Immutable Ballot</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Confirm Your Ballot</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to cast your ballot for{' '}
              <strong className="text-slate-900">{selectedCandidate.full_name}</strong> as{' '}
              <strong className="text-slate-900">{selectedCandidate.position}</strong>?
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Zero-Trust Privacy Protocol:</div>
              <p>
                Once submitted, your vote is immutably committed to the ledger with no user identifier.
                This action is final and cannot be modified or rescinded.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Review Choice
              </button>
              <button
                type="button"
                onClick={handleCastVote}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition-all flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Transacting...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm & Cast Vote</span>
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
