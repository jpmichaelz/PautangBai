<?php

namespace App\Actions\Loans;

use App\Models\Loan;
use App\Models\User;
use App\Services\InterestCalculationService;

class CreateLoanAction
{
    public function __construct(
        private readonly InterestCalculationService $calculator
    ) {}

    /**
     * Create a new loan record for the user.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, array $data): Loan
    {
        $principalMinor = (int) $data['principal_minor'];
        $interestType = $data['interest_type'] ?? 'none';
        $interestRate = $data['interest_rate'] ?? null;
        $fixedChargeMinor = (int) ($data['fixed_charge_minor'] ?? 0);

        // Pre-calculate fixed charge if percentage type and not provided
        if ($fixedChargeMinor === 0 && $interestType !== 'none' && $interestType !== 'fixed_amount') {
            $fixedChargeMinor = $this->calculator->calculateTotalChargeMinor(
                principalMinor: $principalMinor,
                interestType: $interestType,
                fixedChargeMinor: 0,
                interestRate: $interestRate
            );
        }

        return $user->loans()->create([
            'id' => $data['id'] ?? null,
            'borrower_id' => $data['borrower_id'],
            'principal_minor' => $principalMinor,
            'currency' => $data['currency'] ?? 'PHP',
            'interest_type' => $interestType,
            'fixed_charge_minor' => $fixedChargeMinor,
            'interest_rate' => $interestRate,
            'interest_period' => $data['interest_period'] ?? null,
            'interest_start_date' => $data['interest_start_date'] ?? null,
            'loan_date' => $data['loan_date'],
            'due_date' => $data['due_date'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'] ?? 'active',
            'server_version' => 1,
        ]);
    }
}
