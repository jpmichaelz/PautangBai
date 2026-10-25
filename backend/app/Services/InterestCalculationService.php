<?php

namespace App\Services;

use App\Models\Loan;
use Carbon\Carbon;

class InterestCalculationService
{
    /**
     * Calculate total interest/charge in integer minor units (centavos).
     */
    public function calculateTotalChargeMinor(
        int $principalMinor,
        string $interestType,
        int $fixedChargeMinor = 0,
        ?string $interestRate = null,
        ?int $unitsCount = null
    ): int {
        if ($principalMinor <= 0) {
            return 0;
        }

        if ($unitsCount === null && $fixedChargeMinor > 0 && $interestType !== 'none') {
            return max(0, $fixedChargeMinor);
        }

        $rate = (float) ($interestRate ?? 0);
        $validRate = ($rate > 0) ? $rate : 0.0;

        return match ($interestType) {
            'none' => 0,
            'fixed_amount' => max(0, $fixedChargeMinor),
            'percentage_flat' => $validRate > 0 ? (int) round(($principalMinor * $validRate) / 100) : 0,
            'percentage_daily' => $validRate > 0 ? (int) round((($principalMinor * $validRate) / 100) * max(1, $unitsCount ?? 1)) : 0,
            'percentage_weekly' => $validRate > 0 ? (int) round((($principalMinor * $validRate) / 100) * max(1, $unitsCount ?? 1)) : 0,
            'percentage_monthly' => $validRate > 0 ? (int) round((($principalMinor * $validRate) / 100) * max(1, $unitsCount ?? 1)) : 0,
            default => 0,
        };
    }

    /**
     * Calculate full balance ledger for a loan and its payments.
     *
     * @return array{
     *   principal_minor: int,
     *   interest_minor: int,
     *   total_owed_minor: int,
     *   total_paid_minor: int,
     *   remaining_balance_minor: int,
     *   interest_paid_minor: int,
     *   interest_remaining_minor: int,
     *   principal_paid_minor: int,
     *   principal_remaining_minor: int,
     *   is_paid: bool,
     *   is_overdue: bool
     * }
     */
    public function calculateLoanBalance(Loan $loan): array
    {
        $principalMinor = (int) $loan->principal_minor;

        $interestMinor = $this->calculateTotalChargeMinor(
            principalMinor: $principalMinor,
            interestType: $loan->interest_type,
            fixedChargeMinor: (int) $loan->fixed_charge_minor,
            interestRate: $loan->interest_rate
        );

        $totalOwedMinor = $principalMinor + $interestMinor;

        // Sum active (non-soft-deleted) payments
        $totalPaidMinor = (int) $loan->payments()->sum('amount_minor');

        $remainingBalanceMinor = max(0, $totalOwedMinor - $totalPaidMinor);
        $isPaid = $remainingBalanceMinor === 0;

        // Fee-first allocation
        $interestPaidMinor = min($totalPaidMinor, $interestMinor);
        $interestRemainingMinor = max(0, $interestMinor - $interestPaidMinor);
        $principalPaidMinor = max(0, $totalPaidMinor - $interestPaidMinor);
        $principalRemainingMinor = max(0, $principalMinor - $principalPaidMinor);

        $isOverdue = false;
        if (! $isPaid && $loan->due_date) {
            $isOverdue = Carbon::parse($loan->due_date)->isPast();
        }

        return [
            'principal_minor' => $principalMinor,
            'interest_minor' => $interestMinor,
            'total_owed_minor' => $totalOwedMinor,
            'total_paid_minor' => $totalPaidMinor,
            'remaining_balance_minor' => $remainingBalanceMinor,
            'interest_paid_minor' => $interestPaidMinor,
            'interest_remaining_minor' => $interestRemainingMinor,
            'principal_paid_minor' => $principalPaidMinor,
            'principal_remaining_minor' => $principalRemainingMinor,
            'is_paid' => $isPaid,
            'is_overdue' => $isOverdue,
        ];
    }

    /**
     * Compute fee-first split for an individual payment.
     *
     * @return array{interest_minor: int, principal_minor: int}
     */
    public function allocatePayment(int $paymentAmountMinor, int $interestRemainingMinor): array
    {
        $interestApplied = min($paymentAmountMinor, $interestRemainingMinor);
        $principalApplied = max(0, $paymentAmountMinor - $interestApplied);

        return [
            'interest_minor' => $interestApplied,
            'principal_minor' => $principalApplied,
        ];
    }
}
