<?php

namespace App\Actions\Loans;

use App\Models\Loan;

class DeleteLoanAction
{
    /**
     * Soft delete a loan.
     */
    public function execute(Loan $loan): bool
    {
        return (bool) $loan->delete();
    }
}
