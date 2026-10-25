<?php

namespace App\Actions\Payments;

use App\Models\Loan;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class ReversePaymentAction
{
    /**
     * Reverse / void a mistaken payment and restore loan status if needed.
     */
    public function execute(Payment $payment): bool
    {
        return DB::transaction(function () use ($payment) {
            $loan = Loan::where('id', $payment->loan_id)->lockForUpdate()->first();

            $deleted = (bool) $payment->delete();

            if ($loan && $loan->status === 'paid') {
                $loan->update(['status' => 'active']);
            }

            return $deleted;
        });
    }
}
