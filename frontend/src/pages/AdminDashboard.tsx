import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Vote,
  Users,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Upload,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  Filter,
  RefreshCw,
  Search,
  Trophy,
  RotateCcw,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import {
  AuditLog,
  Candidate,
  Election,
  PaginatedAuditLogs,
  User as UserType,
} from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorBanner } from '../components/ErrorBanner';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'elections' | 'candidates' | 'audit' | 'users'>('elections');
  const [elections, setElections] = useState<Election[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditStatusFilter, setAuditStatusFilter] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Declare Result modal state
  const [electionToDeclare, setElectionToDeclare] = useState<Election | null>(null);
  const [isDeclaring, setIsDeclaring] = useState<boolean>(false);

  // Resume Election modal state
  const [electionToResume, setElectionToResume] = useState<Election | null>(null);
  const [isResuming, setIsResuming] = useState<boolean>(false);
  const [resumeNewEndTime, setResumeNewEndTime] = useState<string>('');

  // Add Voter Modal state
  const [isAddVoterModalOpen, setIsAddVoterModalOpen] = useState<boolean>(false);
  const [voterModalMode, setVoterModalMode] = useState<'single' | 'bulk'>('single');
  const [newVoterRoll, setNewVoterRoll] = useState<string>('');
  const [newVoterName, setNewVoterName] = useState<string>('');
  const [newVoterPassword, setNewVoterPassword] = useState<string>('Voter@123');
  const [bulkVoterText, setBulkVoterText] = useState<string>('');
  const [isCreatingVoter, setIsCreatingVoter] = useState<boolean>(false);

  // Candidate Nomination form state
  const [selectedElectionId, setSelectedElectionId] = useState<number | ''>('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [candidatePosition, setCandidatePosition] = useState<string>('Student Representative');
  const [candidateSlogan, setCandidateSlogan] = useState<string>('');
  const [isAddingCandidate, setIsAddingCandidate] = useState<boolean>(false);

  // Manifesto Upload state
  const [uploadCandidateId, setUploadCandidateId] = useState<number | ''>('');
  const [manifestoFile, setManifestoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // User list search
  const [userSearch, setUserSearch] = useState<string>('');

  useEffect(() => {
    loadAllAdminData();
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs(auditPage, auditActionFilter, auditStatusFilter);
    }
  }, [activeTab, auditPage, auditActionFilter, auditStatusFilter]);

  const loadAllAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [electionsRes, usersRes] = await Promise.all([
        apiClient.get<Election[]>('/api/elections'),
        apiClient.get<UserType[]>('/api/admin/users'),
      ]);
      setElections(electionsRes.data);
      setUsers(usersRes.data);
      if (electionsRes.data.length > 0) {
        setSelectedElectionId(electionsRes.data[0].election_id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load administrative portal data.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async (page: number, action: string, statusVal: string) => {
    try {
      const params: any = { page, page_size: 15 };
      if (action) params.action = action;
      if (statusVal) params.status = statusVal;

      const res = await apiClient.get<PaginatedAuditLogs>('/api/admin/audit-logs', { params });
      setAuditLogs(res.data.items);
      setAuditTotal(res.data.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch audit logs.');
    }
  };

  const toggleElectionStatus = async (election: Election) => {
    const nextStatus = election.status === 'open' ? 'closed' : 'open';
    try {
      await apiClient.patch(`/api/admin/elections/${election.election_id}`, {
        status: nextStatus,
      });
      setSuccessMessage(`Election "${election.title}" is now ${nextStatus.toUpperCase()}.`);
      // Reload elections
      const res = await apiClient.get<Election[]>('/api/elections');
      setElections(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update election status.');
    }
  };

  const handleDeclareResult = async () => {
    if (!electionToDeclare) return;
    setIsDeclaring(true);
    setError(null);
    try {
      const res = await apiClient.post(`/api/admin/elections/${electionToDeclare.election_id}/declare-result`);
      const winnerName = res.data.winner?.candidate_name || 'No winner (0 votes cast)';
      setSuccessMessage(`Election "${res.data.election_title}" result declared! Winner: ${winnerName}.`);
      setElectionToDeclare(null);
      // Reload elections
      const elRes = await apiClient.get<Election[]>('/api/elections');
      setElections(elRes.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('Result already declared.');
      } else {
        setError(err.response?.data?.detail || 'Failed to declare election result.');
      }
      setElectionToDeclare(null);
    } finally {
      setIsDeclaring(false);
    }
  };

  const handleResumeElection = async () => {
    if (!electionToResume) return;
    setIsResuming(true);
    setError(null);
    try {
      const payload: any = {};
      if (resumeNewEndTime) {
        payload.new_end_time = new Date(resumeNewEndTime).toISOString();
      }
      const res = await apiClient.post<Election>(
        `/api/admin/elections/${electionToResume.election_id}/resume`,
        payload
      );
      setSuccessMessage(
        `Election "${res.data.title}" resumed successfully! Premature declaration revoked and voting reopened.`
      );
      setElectionToResume(null);
      setResumeNewEndTime('');
      // Reload elections
      const elRes = await apiClient.get<Election[]>('/api/elections');
      setElections(elRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to resume election.');
      setElectionToResume(null);
    } finally {
      setIsResuming(false);
    }
  };

  const handleCreateVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (voterModalMode === 'single') {
      if (!newVoterRoll.trim() || !newVoterName.trim()) {
        setError('Please enter both Roll Number and Full Name.');
        return;
      }
      setIsCreatingVoter(true);
      try {
        const res = await apiClient.post<UserType>('/api/admin/voters', {
          roll_number: newVoterRoll.trim(),
          full_name: newVoterName.trim(),
          password: newVoterPassword.trim() || 'Voter@123',
        });
        setSuccessMessage(`Voter ${res.data.full_name} (${res.data.roll_number}) registered successfully!`);
        setNewVoterRoll('');
        setNewVoterName('');
        setNewVoterPassword('Voter@123');
        setIsAddVoterModalOpen(false);
        // Refresh users list
        const usersRes = await apiClient.get<UserType[]>('/api/admin/users');
        setUsers(usersRes.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to register voter.');
      } finally {
        setIsCreatingVoter(false);
      }
    } else {
      // Bulk CSV / multi-line mode
      const lines = bulkVoterText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setError('Please enter at least one voter record in the bulk box.');
        return;
      }

      const votersToCreate = [];
      for (const line of lines) {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length < 2) {
          setError(`Invalid format in line: "${line}". Expected "RollNumber, FullName, [Password]"`);
          return;
        }
        votersToCreate.push({
          roll_number: parts[0],
          full_name: parts[1],
          password: parts[2] || 'Voter@123',
        });
      }

      setIsCreatingVoter(true);
      try {
        const res = await apiClient.post<{
          created_count: number;
          skipped_count: number;
          created_voters: UserType[];
          skipped_roll_numbers: string[];
        }>('/api/admin/voters/batch', { voters: votersToCreate });

        let msg = `Batch completed: Successfully registered ${res.data.created_count} voters!`;
        if (res.data.skipped_count > 0) {
          msg += ` (${res.data.skipped_count} skipped as duplicates: ${res.data.skipped_roll_numbers.join(', ')})`;
        }
        setSuccessMessage(msg);
        setBulkVoterText('');
        setIsAddVoterModalOpen(false);
        // Refresh users list
        const usersRes = await apiClient.get<UserType[]>('/api/admin/users');
        setUsers(usersRes.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to batch register voters.');
      } finally {
        setIsCreatingVoter(false);
      }
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElectionId || !selectedUserId) {
      setError('Please select both an election and an eligible student.');
      return;
    }

    setIsAddingCandidate(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.post('/api/admin/candidates', {
        election_id: Number(selectedElectionId),
        user_id: Number(selectedUserId),
        position: candidatePosition,
        slogan: candidateSlogan || null,
      });
      setSuccessMessage('Candidate registered successfully!');
      setCandidateSlogan('');
      // Reload elections
      const res = await apiClient.get<Election[]>('/api/elections');
      setElections(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register candidate.');
    } finally {
      setIsAddingCandidate(false);
    }
  };

  const handleManifestoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCandidateId || !manifestoFile) {
      setError('Please specify the candidate and select a valid PDF file.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', manifestoFile);

      setUploadProgress(60);
      await apiClient.post(`/api/admin/candidates/${uploadCandidateId}/manifesto`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      });

      setUploadProgress(100);
      setSuccessMessage('Manifesto PDF successfully uploaded and verified!');
      setManifestoFile(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Manifesto upload failed.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1500);
    }
  };

  const voterUsers = users.filter((u) => u.role === 'voter');
  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.roll_number.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="py-20">
        <LoadingSpinner message="Securing administrative connection..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Campus Election Commission Portal
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Welcome, <strong className="text-slate-800 font-semibold">{user?.full_name || 'Mr. Amrit Tripathi'}</strong> &bull; Zero-trust administrative control, candidate certification, and append-only audit monitoring.
          </p>
        </div>

        <Link
          to="/admin/elections/new"
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Election</span>
        </Link>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto pb-1">
          {[
            { id: 'elections', label: 'Elections & Controls', icon: Vote },
            { id: 'candidates', label: 'Candidate Nominations & PDFs', icon: Users },
            { id: 'audit', label: 'Tamper-Evident Audit Trail', icon: FileText },
            { id: 'users', label: 'Institutional Directory', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-1 border-b-2 font-semibold text-sm whitespace-nowrap flex items-center space-x-2 transition-colors ${
                  isActive
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: Elections Management */}
      {activeTab === 'elections' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {elections.map((elec) => (
              <div
                key={elec.election_id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        elec.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : elec.status === 'closed'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {elec.status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">ID: #{elec.election_id}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{elec.title}</h3>

                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Starts: {new Date(elec.start_time).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ends: {new Date(elec.end_time).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{elec.candidate_count || 0} Registered Candidates</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => toggleElectionStatus(elec)}
                      className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        elec.status === 'open'
                          ? 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {elec.status === 'open' ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>Close Polls</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Open Polls</span>
                        </>
                      )}
                    </button>

                    {elec.declared_at || elec.is_declared ? (
                      <>
                        <button
                          disabled
                          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                          title="Result declared"
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          <span>Result declared</span>
                        </button>
                        <button
                          onClick={() => {
                            setElectionToResume(elec);
                            const end = new Date(elec.end_time);
                            const now = new Date();
                            if (end <= now) {
                              const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                              setResumeNewEndTime(future.toISOString().slice(0, 16));
                            } else {
                              setResumeNewEndTime('');
                            }
                          }}
                          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm"
                          title="Resume election if accidentally declared"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Resume</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setElectionToDeclare(elec)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors shadow-sm"
                        title="Declare final result and certify winner"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-600" />
                        <span>Declare Result</span>
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/admin/results/${elec.election_id}`}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>View Turnout</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Candidate Nominations & PDF Upload */}
      {activeTab === 'candidates' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Nominate Candidate Form */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">1. Nominate Approved Candidate</h2>
              <p className="text-xs text-slate-500 mt-1">
                Link an eligible registered student to an election with an official position and slogan.
              </p>
            </div>

            <form onSubmit={handleAddCandidate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Election
                </label>
                <select
                  value={selectedElectionId}
                  onChange={(e) => setSelectedElectionId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-brand-500 focus:border-brand-500"
                >
                  {elections.map((el) => (
                    <option key={el.election_id} value={el.election_id}>
                      #{el.election_id} - {el.title} ({el.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Student
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-brand-500 focus:border-brand-500 font-mono"
                >
                  <option value="">-- Choose a student voter --</option>
                  {voterUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.roll_number} - {u.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Position / Office
                </label>
                <input
                  type="text"
                  required
                  value={candidatePosition}
                  onChange={(e) => setCandidatePosition(e.target.value)}
                  placeholder="e.g. Council President, Vice President"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Campaign Slogan / Vision
                </label>
                <input
                  type="text"
                  value={candidateSlogan}
                  onChange={(e) => setCandidateSlogan(e.target.value)}
                  placeholder="e.g. Transparency, Inclusion, & Innovation"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingCandidate}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2"
              >
                {isAddingCandidate ? (
                  <span>Registering Candidate...</span>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Nominate Candidate</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Upload Manifesto Form */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">2. Upload Candidate Manifesto PDF</h2>
              <p className="text-xs text-slate-500 mt-1">
                Uploads manifesto to Azure Blob Storage (or local storage). Validates %PDF magic signature.
              </p>
            </div>

            <form onSubmit={handleManifestoUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Candidate ID
                </label>
                <input
                  type="number"
                  required
                  value={uploadCandidateId}
                  onChange={(e) => setUploadCandidateId(Number(e.target.value))}
                  placeholder="Enter candidate ID (e.g. 1, 2, 3)"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-brand-500 focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Policy Manifesto PDF Document
                </label>
                <input
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={(e) => setManifestoFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Accepted format: .pdf only, maximum 5 MB. Verified by file magic byte inspection.
                </span>
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-600 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2"
              >
                {isUploading ? (
                  <span>Uploading Manifesto ({uploadProgress}%)...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload & Certify PDF</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tamper-Evident Security Logs</h2>
              <p className="text-xs text-slate-500">
                Total events tracked: {auditTotal}. Protected by immutable database triggers.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">All Actions</option>
                  <option value="auth.login">auth.login</option>
                  <option value="vote.cast">vote.cast</option>
                  <option value="admin.election.create">admin.election.create</option>
                  <option value="admin.election.update">admin.election.update</option>
                  <option value="admin.candidate.add">admin.candidate.add</option>
                  <option value="admin.manifesto.upload">admin.manifesto.upload</option>
                </select>
              </div>

              <select
                value={auditStatusFilter}
                onChange={(e) => {
                  setAuditStatusFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>

              <button
                onClick={() => loadAuditLogs(auditPage, auditActionFilter, auditStatusFilter)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
                title="Refresh audit logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">Log ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No audit log records match the current filters.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">#{log.log_id}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-brand-700">{log.action}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {log.roll_number || (log.user_id ? `User #${log.user_id}` : 'Anonymous')}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{log.ip_address || '127.0.0.1'}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.details || ''}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              Showing page {auditPage} of {Math.max(1, Math.ceil(auditTotal / 15))}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((p) => p - 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={auditPage >= Math.ceil(auditTotal / 15)}
                onClick={() => setAuditPage((p) => p + 1)}
                className="px-3 py-1 border border-slate-200 rounded-lg text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Institutional Directory */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Institutional Voter & Admin Directory</h2>
              <p className="text-xs text-slate-500">
                Zero-Trust Audit: Verified users with global voting flags. Password hashes are never transmitted.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search roll number or name..."
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddVoterModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-all whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Voter</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Participation Flag</th>
                  <th className="py-3 px-4">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">#{u.user_id}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{u.roll_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{u.full_name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.has_voted ? (
                        <span className="flex items-center space-x-1 text-emerald-700 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Has Voted</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-slate-400">
                          <XCircle className="w-3.5 h-3.5 text-slate-300" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Declare Result Confirm Dialog */}
      {electionToDeclare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <Trophy className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Declare Election Result</h3>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Declaring the result will close this election. Votes can no longer be cast. Continue?
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Target Election:</div>
              <p className="font-bold text-slate-900">{electionToDeclare.title} (#{electionToDeclare.election_id})</p>
              <p className="text-[11px] text-slate-500">
                This will finalize the vote counts from the immutable ledger, certify the winner, and permanently close balloting.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setElectionToDeclare(null)}
                disabled={isDeclaring}
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeclareResult}
                disabled={isDeclaring}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all flex items-center space-x-2"
              >
                {isDeclaring ? (
                  <span>Declaring Result...</span>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    <span>Confirm & Declare</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Election Confirmation Modal */}
      {electionToResume && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-indigo-600">
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Resume Election</h3>
                <p className="text-xs text-slate-500">Revoke accidental result declaration</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Resuming this election will revoke the declared result, restore the status to <strong className="text-slate-800">Open</strong>, and allow eligible students to continue casting ballots. All previously cast votes are strictly preserved.
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">Target Election:</div>
              <p className="font-bold text-slate-900">{electionToResume.title} (#{electionToResume.election_id})</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Voting Deadline (Optional Extension):
              </label>
              <input
                type="datetime-local"
                value={resumeNewEndTime}
                onChange={(e) => setResumeNewEndTime(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                Specify a new deadline if the previous deadline expired, or leave blank to automatically extend by 24 hours if needed.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setElectionToResume(null)}
                disabled={isResuming}
                className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResumeElection}
                disabled={isResuming}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center space-x-2"
              >
                {isResuming ? (
                  <span>Resuming Election...</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirm & Resume</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Voter Modal */}
      {isAddVoterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-brand-600">
                <div className="p-3 bg-brand-50 rounded-2xl border border-brand-100">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Register Eligible Voter</h3>
                  <p className="text-xs text-slate-500">Zero-Trust Credential Provisioning</p>
                </div>
              </div>

              {/* Mode Toggle: Single vs Bulk */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setVoterModalMode('single')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    voterModalMode === 'single'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setVoterModalMode('bulk')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    voterModalMode === 'bulk'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Bulk CSV
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateVoter} className="space-y-4">
              {voterModalMode === 'single' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Roll Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newVoterRoll}
                      onChange={(e) => setNewVoterRoll(e.target.value)}
                      placeholder="e.g. STU006"
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newVoterName}
                      onChange={(e) => setNewVoterName(e.target.value)}
                      placeholder="e.g. Kabir Sharma"
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      required
                      value={newVoterPassword}
                      onChange={(e) => setNewVoterPassword(e.target.value)}
                      placeholder="Default: Voter@123"
                      className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                    />
                    <p className="text-[11px] text-slate-400">
                      Password will be securely hashed with bcrypt prior to database insertion.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Paste Voters (One per line: RollNumber, FullName, Password)
                  </label>
                  <textarea
                    rows={5}
                    value={bulkVoterText}
                    onChange={(e) => setBulkVoterText(e.target.value)}
                    placeholder={`STU006, Kabir Sharma, Voter@123\nSTU007, Priya Verma, Voter@123`}
                    className="w-full text-xs font-mono px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Format: <code>RollNumber, Full Name, Password</code>. Duplicates are safely skipped.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddVoterModalOpen(false)}
                  disabled={isCreatingVoter}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingVoter}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-md transition-all flex items-center space-x-2"
                >
                  {isCreatingVoter ? (
                    <span>Registering...</span>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>{voterModalMode === 'single' ? 'Register Voter' : 'Batch Register'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
