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

const COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'];

export const Results: React.FC = () => {
  const { electionId } = useParams<{ electionId: string }>();
  const [analytics, setAnalytics] = useState<TurnoutAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

  if (isLoading) {
    return (
      <div className="py-20">
        <LoadingSpinner message="Aggregating anonymous ballots from votes ledger..." size="lg" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
          Analytics data unavailable for this election.
        </div>
        <Link to="/admin" className="mt-4 inline-flex items-center text-brand-600 font-semibold">
          <ArrowLeft className="w-4 h-4 mr-1" /> Return to Admin Console
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Admin Console
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            Certified Turnout & Results
          </span>
          <span className="text-xs font-mono text-slate-400">Election #{analytics.election_id}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {analytics.election_title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Aggregated anonymously from the immutable votes ledger. Individual ballot secrecy is mathematically protected.
        </p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Eligible Voters</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{analytics.total_eligible_voters}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ballots Cast</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{analytics.total_voted}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Turnout Percentage</p>
            <p className="text-2xl font-extrabold text-indigo-600 mt-1">{analytics.turnout_percentage}%</p>
          </div>
        </div>
      </div>

      {/* Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-bold text-slate-900">Votes Per Candidate (Tally)</h2>
          </div>
          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: any) => [`${value} votes`, 'Votes']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="votes" fill="#0d9488" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center space-x-2">
            <PieIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Vote Distribution Share</h2>
          </div>
          <div className="h-72 w-full pt-4">
            {analytics.total_voted === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                No votes recorded yet for this election.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="votes"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`${value} votes`, 'Votes']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Tally Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900">Certified Tally Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">Candidate Name</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Office / Position</th>
                <th className="py-3 px-4">Campaign Slogan</th>
                <th className="py-3 px-4 text-right">Votes Count</th>
                <th className="py-3 px-4 text-right">Vote Share (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.candidate_tallies.map((cand) => {
                const share =
                  analytics.total_voted > 0
                    ? ((cand.votes_count / analytics.total_voted) * 100).toFixed(1)
                    : '0.0';

                return (
                  <tr key={cand.candidate_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{cand.candidate_name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{cand.roll_number}</td>
                    <td className="py-3.5 px-4 font-semibold text-brand-700">{cand.position}</td>
                    <td className="py-3.5 px-4 text-slate-600 italic">"{cand.slogan || '—'}"</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 text-right font-mono text-sm">
                      {cand.votes_count}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-600 text-right font-mono text-sm">
                      {share}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit & Secrecy Footer */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 flex items-center space-x-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>
          Zero-Trust Assurance: The votes ledger contains NO voter identifiers. These tallies are calculated
          strictly through anonymous SQL aggregation.
        </span>
      </div>
    </div>
  );
};
