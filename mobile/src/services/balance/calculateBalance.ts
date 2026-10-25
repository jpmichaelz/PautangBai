import { Loan, Payment } from '@/types/database';
import { calculateTotalChargeMinor } from '../interest/calculateInterest';
import { getLocalDateString, isDatePast } from '../date/dateUtils';

export interface LoanBalanceSummary {
  principalMinor: number;
  interestMinor: number;
  interestPaidMinor: number;
  interestRemainingMinor: number;
  principalPaidMinor: number;
  principalRemainingMinor: number;
  totalOwedMinor: number;
  totalPaidMinor: number;
  remainingBalanceMinor: number;
  isPaid: boolean;
  isOverdue: boolean;
}

export function calculateLoanBalance(loan: Loan, payments: Payment[]): LoanBalanceSummary {
  const principalMinor = loan.principal_minor;

  const interestMinor = calculateTotalChargeMinor({
    principalMinor: loan.principal_minor,
    interestType: loan.interest_type,
    fixedChargeMinor: loan.fixed_charge_minor,
    interestRate: loan.interest_rate,
  });

  const totalOwedMinor = principalMinor + interestMinor;

  const totalPaidMinor = payments
    .filter((p) => !p.deleted_at)
    .reduce((sum, p) => sum + p.amount_minor, 0);

  const remainingBalanceMinor = Math.max(0, totalOwedMinor - totalPaidMinor);
  const isPaid = remainingBalanceMinor === 0;

  // Fee-first allocation tracking
  const interestPaidMinor = Math.min(totalPaidMinor, interestMinor);
  const interestRemainingMinor = Math.max(0, interestMinor - interestPaidMinor);
  const principalPaidMinor = Math.max(0, totalPaidMinor - interestPaidMinor);
  const principalRemainingMinor = Math.max(0, principalMinor - principalPaidMinor);

  let isOverdue = false;
  if (!isPaid && loan.due_date) {
    isOverdue = isDatePast(loan.due_date);
  }

  return {
    principalMinor,
    interestMinor,
    interestPaidMinor,
    interestRemainingMinor,
    principalPaidMinor,
    principalRemainingMinor,
    totalOwedMinor,
    totalPaidMinor,
    remainingBalanceMinor,
    isPaid,
    isOverdue,
  };
}
