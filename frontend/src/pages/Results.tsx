import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  PieChart as PieIcon,
  Users,
  CheckCircle,
  Clock,
  ShieldCheck,
  Percent,
  Trophy,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import apiClient from '../api/client';
import { TurnoutAnalytics } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBanner } from '../components/ErrorBanner';

const COLORS = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6'];

export const Results: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const [analytics, setAnalytics] = useState<TurnoutAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isResuming, setIsResuming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (electionId) {
      loadResults(Number(electionId));
    }
  }, [electionId]);

  const loadResults = async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<TurnoutAnalytics>(`/api/analytics/turnout/${id}`);
      setAnalytics(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to calculate turnout and candidate tallies.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeElection = async () => {
    if (
      !window.confirm(
        'Declaring the result was accidental? Resuming this election will revoke the declared result, set the status to Open, and allow voters to continue voting. Existing votes are preserved. Continue?'
      )
    ) {
      return;
    }
    setIsResuming(true);
    setError(null);
    try {
      await apiClient.post(`/api/admin/elections/${electionId}/resume`);
      if (electionId) {
        await loadResults(Number(electionId));
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resume election.');
    } finally {
      setIsResuming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner message="Calculating election results..." size="lg" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="glass-panel p-6 rounded-2xl text-rose-300 border-rose-500/30">
          Analytics data unavailable for this election.
        </div>
        <Link to="/admin" className="mt-4 inline-flex items-center text-emerald-400 font-semibold text-xs font-mono">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Return to Admin Console
        </Link>
      </div>
    );
  }

  const chartData = analytics.candidate_tallies.map((cand) => ({
    name: cand.candidate_name,
    votes: cand.votes_count,
    position: cand.position,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in text-left">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> BACK TO ADMIN DASHBOARD
        </Link>
      </div>

      {/* Header */}
      <div className="glass-panel-elevated rounded-3xl p-6 sm:p-8 space-y-2 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
            OFFICIAL ELECTION RESULTS &amp; TURNOUT
          </span>
          <span className="text-xs font-mono text-slate-400">ELECTION #{analytics.election_id}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {analytics.election_title}
        </h1>
        <p className="text-xs text-slate-400">
          Official election tally. Individual voter choices remain confidential and completely anonymous.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Declared Winner Card (When Result is Declared) */}
      {(analytics.is_declared || analytics.declared_at) && (
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden animate-fade-in border border-yellow-300/30">
          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 bg-navy-950/40 backdrop-blur-md border border-white/20 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-yellow-200">
                <Trophy className="w-4 h-4 text-yellow-300" />
                <span>CERTIFIED WINNER</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs text-yellow-100 font-mono">
                  Declared: {new Date(analytics.declared_at!).toLocaleString()}
                </div>
                <button
                  onClick={handleResumeElection}
                  disabled={isResuming}
                  className="inline-flex items-center space-x-1.5 px-3 py-1 bg-navy-950/50 hover:bg-navy-950/70 border border-white/20 text-white rounded-lg text-xs font-mono font-bold transition-all cursor-pointer"
                  title="Revoke declaration and reopen voting"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isResuming ? 'Resuming...' : 'Revoke & Resume Election'}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pt-2">
              <div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {analytics.winner?.candidate_name || 'No Winner (0 Votes Recorded)'}
                </h2>
                <p className="text-yellow-100 text-xs font-semibold mt-1">
                  {analytics.winner?.position} &bull; Roll Number: {analytics.winner?.roll_number}
                </p>
                {analytics.winner?.slogan && (
                  <p className="text-white/90 text-xs italic mt-2">"{analytics.winner.slogan}"</p>
                )}
              </div>

              <div className="bg-navy-950/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center sm:text-right min-w-[150px]">
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                  {analytics.winner?.votes_count || 0}
                </div>
                <div className="text-[10px] font-mono font-bold text-yellow-200 uppercase tracking-wider mt-0.5">
                  Winning Ballots
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel rounded-3xl p-6 flex items-center space-x-4 border border-white/10">
          <div className="p-3 bg-blue-500/15 text-blue-400 rounded-2xl border border-blue-500/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Eligible Voters</p>
            <p className="text-2xl font-extrabold text-white mt-0.5">{analytics.total_eligible_voters}</p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 flex items-center space-x-4 border border-white/10">
          <div className="p-3 bg-emerald-500/15 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Ballots Cast</p>
            <p className="text-2xl font-extrabold text-white mt-0.5">{analytics.total_voted}</p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6 flex items-center space-x-4 border border-white/10">
          <div className="p-3 bg-purple-500/15 text-purple-400 rounded-2xl border border-purple-500/30">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-slate-400 uppercase tracking-wider">Voter Turnout</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-0.5 font-mono">{analytics.turnout_percentage}%</p>
          </div>
        </div>
      </div>

      {/* Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-4 border border-white/10">
          <div className="flex items-center space-x-2 text-emerald-400">
            <BarChart3 className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">Votes Per Candidate (Tally)</h2>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  formatter={(value: any) => [`${value} votes`, 'Votes']}
                  contentStyle={{
                    borderRadius: '12px',
                    background: '#070b14',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f8fafc',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="votes" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-4 border border-white/10">
          <div className="flex items-center space-x-2 text-cyan-400">
            <PieIcon className="w-5 h-5" />
            <h2 className="text-base font-bold text-white">Vote Distribution Share</h2>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={85}
                  dataKey="votes"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`${value} votes`, 'Share']}
                  contentStyle={{
                    borderRadius: '12px',
                    background: '#070b14',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#f8fafc',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
