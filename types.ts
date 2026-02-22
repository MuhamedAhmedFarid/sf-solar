
export type UserRole = 'ADMIN' | 'PAYROLL' | 'CLIENT' | 'REP' | null;

export interface Candidate {
  id: string;
  agent_id?: string;
  client_id: string;
  name: string;
  email: string;
  role: string;
  whatsapp_number: string;
  resume_link: string;
  recording_link: string;
  active_hours: string;
  rating?: number;
  status: 'PENDING' | 'GOOD' | 'BAD' | 'TRAINING' | 'SHORTLISTED' | 'WORKING' | 'PREPARATION' | 'PROBATION' | 'REJECTED' | string;
  show_phone_to_client: boolean;
  rate_per_hour: number;
  number_of_sets?: number;
  meeting_hours?: number;
  break_hours?: number;
  moes_total?: number;
  total_owed?: number;
  alias?: string;
  username?: string;
  password?: string;
  created_at?: string;
}

export interface ClientData {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  access_code: string;
  created_at?: string;
}

export interface PayrollUser {
  id: string;
  name: string;
  passcode: string;
  created_at?: string;
}

export interface AgentPerformance {
  id: string;
  agent_id: string;
  full_name?: string;
  calls?: number;
  wait_time: number;
  talk_time: number;
  customer_time: number;
  sync_date?: string;
  created_at: string;
  batch_id?: string | null;
  is_paid?: boolean;
  number_of_sets?: number;
  meeting_hours?: number;
  break_hours?: number;
  /** From VICI dialer CSV; persisted to table "set" */
  set?: string | number;
}

export interface PaymentBatch {
  id: string;
  client_id: string;
  batch_name: string;
  total_amount: number;
  status: 'pending_payment' | 'paid';
  created_at: string;
}

export interface AuthState {
  role: UserRole;
  user: any;
  authenticated: boolean;
}
