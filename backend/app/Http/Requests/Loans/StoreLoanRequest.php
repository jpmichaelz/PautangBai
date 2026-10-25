<?php

namespace App\Http\Requests\Loans;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'id' => ['nullable', 'uuid'],
            'borrower_id' => [
                'required',
                'uuid',
                Rule::exists('borrowers', 'id')
                    ->where('user_id', $this->user()?->id)
                    ->whereNull('deleted_at'),
            ],
            'principal_minor' => ['required', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'size:3'],
            'interest_type' => [
                'required',
                'string',
                'in:none,fixed_amount,percentage_flat,percentage_daily,percentage_weekly,percentage_monthly',
            ],
            'fixed_charge_minor' => ['nullable', 'integer', 'min:0'],
            'interest_rate' => ['nullable', 'string', 'max:20'],
            'interest_period' => ['nullable', 'string', 'max:50'],
            'interest_start_date' => ['nullable', 'date'],
            'loan_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:loan_date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
