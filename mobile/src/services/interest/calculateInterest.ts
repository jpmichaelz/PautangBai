import { LoanInterestType } from '@/types/database';

export interface InterestCalculationParams {
  principalMinor: number;
  interestType: LoanInterestType;
  fixedChargeMinor?: number;
  interestRate?: string | null; // e.g. "5" or "5.5" for 5.5%
  unitsCount?: number; // days, weeks, or months count
  monthsElapsed?: number; // for backward compatibility
}

/**
 * Calculates total interest or charges in integer centavos.
 * Always returns whole integer centavos (rounded to avoid floating-point drift).
 */
export function calculateTotalChargeMinor(params: InterestCalculationParams): number {
  const {
    principalMinor,
    interestType,
    fixedChargeMinor = 0,
    interestRate,
    unitsCount,
    monthsElapsed,
  } = params;

  if (principalMinor <= 0) return 0;

  // If upfront fixed charge was already recorded on the loan, reuse it
  const hasExplicitUnits = unitsCount !== undefined || monthsElapsed !== undefined;
  if (!hasExplicitUnits && fixedChargeMinor > 0 && interestType !== 'none') {
    return Math.max(0, Math.round(fixedChargeMinor));
  }

  const rate = parseFloat(interestRate || '0');
  const validRate = !isNaN(rate) && rate > 0 ? rate : 0;

  switch (interestType) {
    case 'none':
      return 0;

    case 'fixed_amount':
      return Math.max(0, Math.round(fixedChargeMinor));

    case 'percentage_flat':
      if (validRate === 0) return 0;
      return Math.round((principalMinor * validRate) / 100);

    case 'percentage_daily': {
      if (validRate === 0) return 0;
      const days = Math.max(1, unitsCount ?? 1);
      return Math.round(((principalMinor * validRate) / 100) * days);
    }

    case 'percentage_weekly': {
      if (validRate === 0) return 0;
      const weeks = Math.max(1, unitsCount ?? 1);
      return Math.round(((principalMinor * validRate) / 100) * weeks);
    }

    case 'percentage_monthly': {
      if (validRate === 0) return 0;
      const months = Math.max(1, unitsCount ?? monthsElapsed ?? 1);
      return Math.round(((principalMinor * validRate) / 100) * months);
    }

    default:
      return 0;
  }
}

export interface PaymentAllocation {
  appliedToInterestMinor: number;
  appliedToPrincipalMinor: number;
}

/**
 * Allocates a payment: charges/interest first, remainder to principal.
 */
export function allocatePayment(
  paymentAmountMinor: number,
  interestOwedMinor: number
): PaymentAllocation {
  const appliedToInterestMinor = Math.min(paymentAmountMinor, interestOwedMinor);
  const appliedToPrincipalMinor = paymentAmountMinor - appliedToInterestMinor;

  return {
    appliedToInterestMinor,
    appliedToPrincipalMinor,
  };
}

/**
 * Format integer centavos to Philippine Peso string (e.g. 150000 -> "₱1,500.00")
 */
export function formatPHP(minorUnits: number): string {
  const pesos = minorUnits / 100;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos);
}
