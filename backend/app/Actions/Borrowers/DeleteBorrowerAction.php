<?php

namespace App\Actions\Borrowers;

use App\Models\Borrower;

class DeleteBorrowerAction
{
    /**
     * Soft delete a borrower (preserves tombstone for sync).
     */
    public function execute(Borrower $borrower): bool
    {
        return (bool) $borrower->delete();
    }
}
