<?php

namespace App\Actions\Borrowers;

use App\Models\Borrower;
use App\Models\User;

class AddBorrowerAction
{
    /**
     * Add a new borrower for the authenticated user.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(User $user, array $data): Borrower
    {
        return $user->borrowers()->create([
            'id' => $data['id'] ?? null,
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'address' => $data['address'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);
    }
}
