<?php

namespace App\Actions\Loans;

use App\Models\Loan;

class UpdateLoanAction
{
    /**
     * Update an existing loan.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Loan $loan, array $data): Loan
    {
        $fields = [
            'notes',
            'due_date',
            'status',
        ];

        $payload = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $payload[$field] = $data[$field];
            }
        }

        $payload['server_version'] = ((int) $loan->server_version) + 1;

        $loan->update($payload);

        return $loan->fresh();
    }
}
