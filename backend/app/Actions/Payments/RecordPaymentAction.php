<?php

namespace App\Actions\Payments;

use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;
use App\Services\InterestCalculationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecordPaymentAction
{
    public function __construct(
        private readonly InterestCalculationService $calculator
    ) {}

    /**
     * Record a payment against a loan with fee-first allocation and balance cap.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, Loan $loan, array $data): Payment
    {
        // 1. Idempotency check: if key already processed, return existing payment
        $idempotencyKey = $data['idempotency_key'] ?? null;
        if ($idempotencyKey) {
            $existing = Payment::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }
        }

        $amountMinor = (int) $data['amount_minor'];
        if ($amountMinor <= 0) {
            throw ValidationException::withMessages([
                'amount_minor' => ['Payment amount must be greater than zero.'],
            ]);
        }

        return DB::transaction(function () use ($user, $loan, $data, $amountMinor, $idempotencyKey) {
            // Lock loan row for update to prevent concurrent double-spend race condition
            /** @var Loan $lockedLoan */
            $lockedLoan = Loan::where('id', $loan->id)->lockForUpdate()->first();

            $balance = $this->calculator->calculateLoanBalance($lockedLoan);

            if ($amountMinor > $balance['remaining_balance_minor']) {
                throw ValidationException::withMessages([
                    'amount_minor' => [
                        sprintf(
                            'Payment amount (%d centavos) exceeds remaining balance (%d centavos).',
                            $amountMinor,
                            $balance['remaining_balance_minor']
                        ),
                    ],
                ]);
            }

            // Fee-first allocation
            $allocation = $this->calculator->allocatePayment(
                paymentAmountMinor: $amountMinor,
                interestRemainingMinor: $balance['interest_remaining_minor']
            );

            /** @var Payment $payment */
            $payment = $lockedLoan->payments()->create([
                'id' => $data['id'] ?? null,
                'user_id' => $user->id,
                'amount_minor' => $amountMinor,
                'payment_date' => $data['payment_date'],
                'payment_method' => $data['payment_method'] ?? 'cash',
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'allocation_json' => $allocation,
                'idempotency_key' => $idempotencyKey,
            ]);

            // Update loan status if fully paid
            $newRemaining = $balance['remaining_balance_minor'] - $amountMinor;
            if ($newRemaining <= 0 && $lockedLoan->status !== 'paid') {
                $lockedLoan->update(['status' => 'paid']);
            }

            return $payment;
        });
    }
}
