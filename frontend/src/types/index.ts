export type UserRole = 'admin' | 'voter';
export type ElectionStatus = 'draft' | 'open' | 'closed';

export interface User {
  user_id: number;
  roll_number: string;
  full_name: string;
  role: UserRole;
  has_voted: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Election {
  election_id: number;
  title: string;
  start_time: string;
  end_time: string;
  status: ElectionStatus;
  created_by: number;
  candidate_count?: number;
  has_current_user_voted?: boolean;
}

export interface Candidate {
  candidate_id: number;
  election_id: number;
  user_id: number;
  full_name: string;
  roll_number: string;
  position: string;
  slogan?: string | null;
  manifesto_url?: string | null;
}

export interface VoteConfirmation {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface VoteStatus {
  election_id: number;
  has_voted: boolean;
}

export interface AuditLog {
  log_id: number;
  user_id?: number | null;
  roll_number?: string | null;
  action: string;
  status: string;
  timestamp: string;
  ip_address?: string | null;
  details?: string | null;
}

export interface PaginatedAuditLogs {
  total: number;
  page: number;
  page_size: number;
  items: AuditLog[];
}

export interface CandidateTally {
  candidate_id: number;
  candidate_name: string;
  roll_number: string;
  position: string;
  slogan?: string | null;
  votes_count: number;
}

export interface TurnoutAnalytics {
  election_id: number;
  election_title: string;
  status: ElectionStatus;
  total_eligible_voters: number;
  total_voted: number;
  turnout_percentage: number;
  candidate_tallies: CandidateTally[];
}
