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
  KeyRound,
  Eye,
  EyeOff,
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

  // Reset Admin Master Password state
  const [isResetAdminModalOpen, setIsResetAdminModalOpen] = useState<boolean>(false);
  const [adminOldPassword, setAdminOldPassword] = useState<string>('');
  const [adminNewPassword, setAdminNewPassword] = useState<string>('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState<string>('');
  const [showAdminOldPass, setShowAdminOldPass] = useState<boolean>(false);
  const [showAdminNewPass, setShowAdminNewPass] = useState<boolean>(false);
  const [isResettingAdminPassword, setIsResettingAdminPassword] = useState<boolean>(false);
  const [adminResetError, setAdminResetError] = useState<string | null>(null);

  // Reset User Password modal state (Admin resetting a voter's password)
  const [isResetUserModalOpen, setIsResetUserModalOpen] = useState<boolean>(false);
  const [userToReset, setUserToReset] = useState<UserType | null>(null);
  const [userNewPassword, setUserNewPassword] = useState<string>('Voter@123');
  const [isResettingUserPassword, setIsResettingUserPassword] = useState<boolean>(false);
  const [userResetError, setUserResetError] = useState<string | null>(null);

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

  const handleResetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminResetError(null);

    if (!adminOldPassword || !adminNewPassword) {
      setAdminResetError('Please provide both your current and new password.');
      return;
    }

    if (adminNewPassword.length < 6) {
      setAdminResetError('New password must be at least 6 characters long.');
      return;
    }

    if (adminNewPassword !== adminConfirmPassword) {
      setAdminResetError('New password and confirmation do not match.');
      return;
    }

    if (adminOldPassword === adminNewPassword) {
      setAdminResetError('New password must be different from current password.');
      return;
    }

    setIsResettingAdminPassword(true);
    try {
      const res = await apiClient.post<{ message: string; roll_number: string }>('/api/admin/reset-my-password', {
        current_password: adminOldPassword,
        new_password: adminNewPassword,
      });

      setSuccessMessage(res.data.message || 'Administrator master password successfully updated.');
      setIsResetAdminModalOpen(false);
      setAdminOldPassword('');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
    } catch (err: any) {
      setAdminResetError(err.response?.data?.detail || 'Failed to update administrator password.');
    } finally {
      setIsResettingAdminPassword(false);
    }
  };

  const handleResetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    setUserResetError(null);

    if (!userNewPassword || userNewPassword.length < 6) {
      setUserResetError('New password must be at least 6 characters long.');
      return;
    }

    setIsResettingUserPassword(true);
    try {
      const res = await apiClient.post<{ message: string; roll_number: string }>(
        `/api/admin/users/${userToReset.user_id}/reset-password`,
        { new_password: userNewPassword }
      );

      setSuccessMessage(res.data.message || `Password for ${userToReset.roll_number} has been reset.`);
      setIsResetUserModalOpen(false);
      setUserToReset(null);
    } catch (err: any) {
      setUserResetError(err.response?.data?.detail || 'Failed to reset user password.');
    } finally {
      setIsResettingUserPassword(false);
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
      <div className="py-24 flex items-center justify-center">
        <LoadingSpinner message="Securing administrative connection to tribunal ledger..." size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in text-left">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 glass-panel-elevated p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Campus Election Commission Tribunal
            </h1>
          </div>
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
            <span>Chief Officer: <strong className="text-amber-300 font-mono">{user?.full_name || 'Mr. Amrit Tripathi'}</strong></span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
              ID: {user?.roll_number || 'ADMIN001'}
            </span>
            <span>&bull; Zero-trust administrative control &amp; immutable audit monitoring.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAdminOldPassword('');
              setAdminNewPassword('');
              setAdminConfirmPassword('');
              setAdminResetError(null);
              setIsResetAdminModalOpen(true);
            }}
            className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-400 transition-all cursor-pointer shadow-sm"
          >
            <KeyRound className="w-4 h-4 text-purple-400" />
            <span>Reset Admin Password</span>
          </button>

          <Link
            to="/admin/elections/new"
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl font-extrabold text-xs text-navy-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 shadow-glow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Election</span>
          </Link>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 font-bold text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-white/10 pb-2">
        <nav className="flex space-x-2 overflow-x-auto">
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
                className={`py-2 px-3.5 rounded-xl font-bold text-xs whitespace-nowrap flex items-center space-x-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
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
                className="glass-panel rounded-3xl border border-white/10 p-6 shadow-xl hover:border-emerald-500/30 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        elec.status === 'open'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : elec.status === 'closed'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}
                    >
                      {elec.status}
                    </span>
                    <span className="text-xs font-mono text-slate-500">ID: #{elec.election_id}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white">{elec.title}</h3>

                  <div className="space-y-1.5 text-xs font-mono text-slate-400">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Starts: {new Date(elec.start_time).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ends: {new Date(elec.end_time).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>{elec.candidate_count || 0} Registered Candidates</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => toggleElectionStatus(elec)}
                      className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        elec.status === 'open'
                          ? 'bg-slate-900 text-slate-300 border-white/10 hover:bg-slate-800'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                      }`}
                    >
                      {elec.status === 'open' ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-slate-400" />
                          <span>Close Polls</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Open Polls</span>
                        </>
                      )}
                    </button>

                    {elec.declared_at || elec.is_declared ? (
                      <>
                        <button
                          disabled
                          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-white/10 bg-slate-900 text-slate-500 cursor-not-allowed"
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
                          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors shadow-sm cursor-pointer"
                          title="Resume election if accidentally declared"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Resume</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setElectionToDeclare(elec)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors shadow-sm cursor-pointer"
                        title="Declare final result and certify winner"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Declare Result</span>
                      </button>
                    )}
                  </div>

                  <Link
                    to={`/admin/results/${elec.election_id}`}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-colors"
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
          <div className="glass-panel rounded-3xl border border-white/10 p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">1. Nominate Approved Candidate</h2>
              <p className="text-xs text-slate-400 mt-1">
                Link an eligible registered student to an election with an official position and slogan.
              </p>
            </div>

            <form onSubmit={handleAddCandidate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-1">
                  Target Election
                </label>
                <select
                  value={selectedElectionId}
                  onChange={(e) => setSelectedElectionId(Number(e.target.value))}
                  className="glass-input w-full px-3 py-2.5 rounded-xl text-xs focus:text-white"
                >
                  {elections.map((el) => (
                    <option key={el.election_id} value={el.election_id} className="bg-navy-950 text-white">
                      #{el.election_id} - {el.title} ({el.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-1">
                  Select Student
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="glass-input w-full px-3 py-2.5 rounded-xl text-xs font-mono focus:text-white"
                >
                  <option value="" className="bg-navy-950 text-white">-- Choose a student voter --</option>
                  {voterUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id} className="bg-navy-950 text-white">
                      {u.roll_number} - {u.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-1">
                  Position / Office
                </label>
                <input
                  type="text"
                  required
                  value={candidatePosition}
                  onChange={(e) => setCandidatePosition(e.target.value)}
                  placeholder="e.g. Council President, Vice President"
                  className="glass-input w-full px-3 py-2.5 rounded-xl text-xs focus:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-1">
                  Campaign Slogan / Vision
                </label>
                <input
                  type="text"
                  value={candidateSlogan}
                  onChange={(e) => setCandidateSlogan(e.target.value)}
                  placeholder="e.g. Transparency, Inclusion, & Innovation"
                  className="glass-input w-full px-3 py-2.5 rounded-xl text-xs focus:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isAddingCandidate}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 text-navy-950 font-extrabold text-xs rounded-xl shadow-glow transition-all flex items-center justify-center space-x-2 cursor-pointer"
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
          <div className="glass-panel rounded-3xl border border-white/10 p-6 sm:p-8 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">2. Upload Candidate Manifesto PDF</h2>
              <p className="text-xs text-slate-400 mt-1">
                Uploads manifesto to cloud storage with %PDF magic signature validation.
              </p>
            </div>

            <form onSubmit={handleManifestoUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-1">
                  Candidate ID
                </label>
                <input
                  type="number"
                  required
                  value={uploadCandidateId}
                  onChange={(e) => setUploadCandidateId(Number(e.target.value))}
                  placeholder="Enter candidate ID (e.g. 1, 2, 3)"
                  className="glass-input w-full px-3 py-2.5 rounded-xl text-xs font-mono focus:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold font-mono text-slate-300 uppercase tracking-wider mb-1">
                  Policy Manifesto PDF Document
                </label>
                <input
                  type="file"
                  required
                  accept="application/pdf"
                  onChange={(e) => setManifestoFile(e.target.files?.[0] || null)}
                  className="glass-input w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-500/20 file:text-emerald-300 hover:file:bg-emerald-500/30 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-500 mt-1 block">
                  Accepted format: .pdf only, maximum 5 MB. Verified by file magic byte inspection.
                </span>
              </div>

              {uploadProgress > 0 && (
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white border border-white/10 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isUploading ? (
                  <span>Uploading Manifesto ({uploadProgress}%)...</span>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload &amp; Certify PDF</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-3xl border border-white/10 shadow-xl overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Tamper-Evident Security Logs</span>
                <span className="text-xs font-mono font-normal text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {auditTotal} Events
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Protected by PostgreSQL strict BEFORE UPDATE/DELETE immutability triggers.
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
                  className="glass-input px-3 py-1.5 rounded-lg text-xs"
                >
                  <option value="" className="bg-navy-950 text-white">All Actions</option>
                  <option value="auth.login" className="bg-navy-950 text-white">auth.login</option>
                  <option value="vote.cast" className="bg-navy-950 text-white">vote.cast</option>
                  <option value="admin.election.create" className="bg-navy-950 text-white">admin.election.create</option>
                  <option value="admin.election.update" className="bg-navy-950 text-white">admin.election.update</option>
                  <option value="admin.candidate.add" className="bg-navy-950 text-white">admin.candidate.add</option>
                  <option value="admin.manifesto.upload" className="bg-navy-950 text-white">admin.manifesto.upload</option>
                </select>
              </div>

              <select
                value={auditStatusFilter}
                onChange={(e) => {
                  setAuditStatusFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="glass-input px-3 py-1.5 rounded-lg text-xs"
              >
                <option value="" className="bg-navy-950 text-white">All Statuses</option>
                <option value="success" className="bg-navy-950 text-white">Success</option>
                <option value="failure" className="bg-navy-950 text-white">Failure</option>
              </select>

              <button
                onClick={() => loadAuditLogs(auditPage, auditActionFilter, auditStatusFilter)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer"
                title="Refresh audit logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-mono font-semibold border-y border-white/10">
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
              <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-mono">
                      No audit log records match the current filters.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.log_id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-500">#{log.log_id}</td>
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">{log.action}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            log.status === 'success'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {log.roll_number || (log.user_id ? `User #${log.user_id}` : 'Anonymous')}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate" title={log.details || ''}>
                        {log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <span className="text-xs font-mono text-slate-400">
              Showing page {auditPage} of {Math.max(1, Math.ceil(auditTotal / 15))}
            </span>
            <div className="flex space-x-2">
              <button
                disabled={auditPage <= 1}
                onClick={() => setAuditPage((p) => p - 1)}
                className="px-3 py-1 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 disabled:opacity-30 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={auditPage >= Math.ceil(auditTotal / 15)}
                onClick={() => setAuditPage((p) => p + 1)}
                className="px-3 py-1 border border-white/10 rounded-lg text-xs font-semibold text-slate-300 disabled:opacity-30 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Institutional Directory */}
      {activeTab === 'users' && (
        <div className="glass-panel rounded-3xl border border-white/10 p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white">Institutional Voter &amp; Admin Directory</h2>
              <p className="text-xs text-slate-400">
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
                  className="glass-input pl-9 pr-4 py-2 rounded-xl text-xs focus:text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddVoterModalOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-navy-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 shadow-glow transition-all whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Voter</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-mono font-semibold border-y border-white/10">
                <tr>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Participation Flag</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-slate-300">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-500">#{u.user_id}</td>
                    <td className="py-3 px-4 font-bold text-white">{u.roll_number}</td>
                    <td className="py-3 px-4 font-sans font-medium text-slate-200">{u.full_name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          u.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.has_voted ? (
                        <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Has Voted</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-slate-500">
                          <XCircle className="w-3.5 h-3.5 text-slate-600" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setUserToReset(u);
                          setUserNewPassword('Voter@123');
                          setUserResetError(null);
                          setIsResetUserModalOpen(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-600/30 border border-purple-500/25 transition-all cursor-pointer"
                        title={`Reset password for ${u.roll_number}`}
                      >
                        <KeyRound className="w-3 h-3 text-purple-400" />
                        <span>Reset Key</span>
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel-elevated rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/15 space-y-6">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Declare Election Result</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Declaring the result will close this election. Votes can no longer be cast. Continue?
            </p>

            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-white/10 text-xs text-slate-400 space-y-1 font-mono">
              <div className="font-semibold text-white">Target Election:</div>
              <p className="font-bold text-emerald-400">{electionToDeclare.title} (#{electionToDeclare.election_id})</p>
              <p className="text-[11px] text-slate-500">
                This will finalize the vote counts from the immutable ledger, certify the winner, and permanently close balloting.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setElectionToDeclare(null)}
                disabled={isDeclaring}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeclareResult}
                disabled={isDeclaring}
                className="px-5 py-2.5 text-xs font-extrabold text-navy-950 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 rounded-xl shadow-glow transition-all flex items-center space-x-2 cursor-pointer"
              >
                {isDeclaring ? (
                  <span>Declaring Result...</span>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    <span>Confirm &amp; Declare</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Election Confirmation Modal */}
      {electionToResume && (
        <div className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel-elevated rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/15 space-y-6">
            <div className="flex items-center space-x-3 text-indigo-400">
              <div className="p-3 bg-indigo-500/15 rounded-2xl border border-indigo-500/30">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Resume Election</h3>
                <p className="text-xs text-slate-400">Revoke accidental result declaration</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Resuming this election will revoke the declared result, restore the status to <strong className="text-white">Open</strong>, and allow eligible students to continue casting ballots. All previously cast votes are strictly preserved.
            </p>

            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-white/10 text-xs text-slate-400 space-y-1 font-mono">
              <div className="font-semibold text-white">Target Election:</div>
              <p className="font-bold text-indigo-300">{electionToResume.title} (#{electionToResume.election_id})</p>
            </div>

            <div className="space-y-1.5 font-mono">
              <label className="block text-xs font-semibold text-slate-300">
                Voting Deadline (Optional Extension):
              </label>
              <input
                type="datetime-local"
                value={resumeNewEndTime}
                onChange={(e) => setResumeNewEndTime(e.target.value)}
                className="glass-input w-full text-xs px-3 py-2 rounded-xl focus:text-white"
              />
              <p className="text-[11px] text-slate-500 font-sans">
                Specify a new deadline if the previous deadline expired, or leave blank to automatically extend by 24 hours if needed.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setElectionToResume(null)}
                disabled={isResuming}
                className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResumeElection}
                disabled={isResuming}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-glow transition-all flex items-center space-x-2 cursor-pointer"
              >
                {isResuming ? (
                  <span>Resuming Election...</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Confirm &amp; Resume</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Voter Modal */}
      {isAddVoterModalOpen && (
        <div className="fixed inset-0 z-50 bg-navy-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel-elevated rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-white/15 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-emerald-400">
                <div className="p-3 bg-emerald-500/15 rounded-2xl border border-emerald-500/30">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Register Eligible Voter</h3>
                  <p className="text-xs text-slate-400">Zero-Trust Credential Provisioning</p>
                </div>
              </div>

              {/* Mode Toggle: Single vs Bulk */}
              <div className="flex bg-slate-900 border border-white/10 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setVoterModalMode('single')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    voterModalMode === 'single'
                      ? 'bg-emerald-500 text-navy-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setVoterModalMode('bulk')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    voterModalMode === 'bulk'
                      ? 'bg-emerald-500 text-navy-950 font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
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
                    <label className="block text-xs font-semibold text-slate-300">
                      Roll Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newVoterRoll}
                      onChange={(e) => setNewVoterRoll(e.target.value)}
                      placeholder="e.g. STU006"
                      className="glass-input w-full text-xs px-3.5 py-2.5 rounded-xl uppercase font-mono focus:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newVoterName}
                      onChange={(e) => setNewVoterName(e.target.value)}
                      placeholder="e.g. Kabir Sharma"
                      className="glass-input w-full text-xs px-3.5 py-2.5 rounded-xl focus:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Initial Password
                    </label>
                    <input
                      type="text"
                      required
                      value={newVoterPassword}
                      onChange={(e) => setNewVoterPassword(e.target.value)}
                      placeholder="Default: Voter@123"
                      className="glass-input w-full text-xs px-3.5 py-2.5 rounded-xl font-mono focus:text-white"
                    />
                    <p className="text-[11px] text-slate-500">
                      Password will be securely hashed with bcrypt prior to database insertion.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Paste Voters (One per line: RollNumber, FullName, Password)
                  </label>
                  <textarea
                    rows={5}
                    value={bulkVoterText}
                    onChange={(e) => setBulkVoterText(e.target.value)}
                    placeholder={`STU006, Kabir Sharma, Voter@123\nSTU007, Priya Verma, Voter@123`}
                    className="glass-input w-full text-xs font-mono px-3.5 py-2.5 rounded-xl focus:text-white"
                  />
                  <p className="text-[11px] text-slate-500 font-mono">
                    Format: <code>RollNumber, Full Name, Password</code>. Duplicates are safely skipped.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddVoterModalOpen(false)}
                  disabled={isCreatingVoter}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingVoter}
                  className="px-5 py-2.5 text-xs font-extrabold text-navy-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 rounded-xl shadow-glow transition-all flex items-center space-x-2 cursor-pointer"
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

      {/* Reset Admin Master Password Modal */}
      {isResetAdminModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel-elevated rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-purple-500/30 space-y-5">
            <div className="flex items-center space-x-3 text-purple-400">
              <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl">
                <KeyRound className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">Reset Administrator Password</h3>
                <p className="text-xs text-slate-400 font-mono">Account ID: {user?.roll_number || 'ADMIN001'}</p>
              </div>
            </div>

            {adminResetError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs text-left">
                {adminResetError}
              </div>
            )}

            <form onSubmit={handleResetAdminPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Current Master Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminOldPass ? 'text' : 'password'}
                    required
                    value={adminOldPassword}
                    onChange={(e) => setAdminOldPassword(e.target.value)}
                    placeholder="Enter current master password"
                    className="glass-input w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl focus:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminOldPass(!showAdminOldPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showAdminOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Master Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAdminNewPass ? 'text' : 'password'}
                    required
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="glass-input w-full text-xs px-3.5 py-2.5 pr-10 rounded-xl focus:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminNewPass(!showAdminNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showAdminNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm New Master Password <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="glass-input w-full text-xs px-3.5 py-2.5 rounded-xl focus:text-white"
                />
                {adminNewPassword && adminConfirmPassword && (
                  <div className="mt-1 text-[11px] font-mono">
                    {adminNewPassword === adminConfirmPassword ? (
                      <span className="text-emerald-400 flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Passwords match</span>
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center space-x-1">
                        <XCircle className="w-3 h-3" />
                        <span>Passwords do not match</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsResetAdminModalOpen(false)}
                  disabled={isResettingAdminPassword}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingAdminPassword}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isResettingAdminPassword ? (
                    <span>Updating Hash...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Update Master Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset User Password Modal (Admin resetting voter) */}
      {isResetUserModalOpen && userToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel-elevated rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/15 space-y-5">
            <div className="flex items-center space-x-3 text-purple-400">
              <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl">
                <KeyRound className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-bold text-white">Reset User Password</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {userToReset.full_name} &bull; {userToReset.roll_number}
                </p>
              </div>
            </div>

            {userResetError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs text-left">
                {userResetError}
              </div>
            )}

            <form onSubmit={handleResetUserPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  New Password for {userToReset.roll_number} <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userNewPassword}
                  onChange={(e) => setUserNewPassword(e.target.value)}
                  placeholder="e.g. Voter@123"
                  className="glass-input w-full text-xs font-mono px-3.5 py-2.5 rounded-xl focus:text-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The new password will be hashed using bcrypt before storage.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsResetUserModalOpen(false)}
                  disabled={isResettingUserPassword}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingUserPassword}
                  className="px-5 py-2.5 text-xs font-extrabold text-navy-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 rounded-xl shadow-glow transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isResettingUserPassword ? (
                    <span>Resetting...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Set New Password</span>
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
