<?php

namespace App\Actions\Borrowers;

use App\Models\Borrower;

class UpdateBorrowerAction
{
    /**
     * Update an existing borrower.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Borrower $borrower, array $data): Borrower
    {
        $borrower->update(array_filter([
            'name' => $data['name'] ?? null,
            'phone' => array_key_exists('phone', $data) ? $data['phone'] : $borrower->phone,
            'email' => array_key_exists('email', $data) ? $data['email'] : $borrower->email,
            'address' => array_key_exists('address', $data) ? $data['address'] : $borrower->address,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $borrower->notes,
            'status' => $data['status'] ?? null,
        ], fn ($val) => $val !== null));

        return $borrower->fresh();
    }
}
