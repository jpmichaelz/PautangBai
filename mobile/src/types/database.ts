export type BorrowerStatus = 'active' | 'archived';

export interface Borrower {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: BorrowerStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type LoanInterestType =
  | 'none'
  | 'fixed_amount'
  | 'percentage_flat'
  | 'percentage_daily'
  | 'percentage_weekly'
  | 'percentage_monthly';

export type LoanStatus = 'active' | 'paid' | 'overdue' | 'cancelled';

export interface Loan {
  id: string;
  borrower_id: string;
  principal_minor: number;
  currency: string;
  interest_type: LoanInterestType;
  fixed_charge_minor: number;
  interest_rate: string | null;
  interest_period: string | null;
  interest_start_date: string | null;
  loan_date: string;
  due_date: string | null;
  notes: string | null;
  status: LoanStatus;
  server_version: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payment {
  id: string;
  loan_id: string;
  amount_minor: number;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  allocation_json: string | null;
  sync_status: 'pending' | 'synced';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InterestCharge {
  id: string;
  loan_id: string;
  period_start: string;
  period_end: string;
  amount_minor: number;
  calculation_version: number;
  created_at: string;
}

export interface LoanHistory {
  id: string;
  loan_id: string;
  event_type: string;
  description: string | null;
  metadata_json: string | null;
  event_date: string;
  created_at: string;
}

export interface SyncQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload_json: string;
  idempotency_key: string;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface SyncState {
  key: string;
  value: string | null;
  updated_at: string;
}
