<?php

namespace App\Http\Resources;

use App\Models\Loan;
use App\Services\InterestCalculationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Loan
 */
class LoanResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $calculator = app(InterestCalculationService::class);
        $balance = $calculator->calculateLoanBalance($this->resource);

        return [
            'id' => $this->id,
            'borrower_id' => $this->borrower_id,
            'borrower' => new BorrowerResource($this->whenLoaded('borrower')),
            'principal_minor' => (int) $this->principal_minor,
            'currency' => $this->currency,
            'interest_type' => $this->interest_type,
            'fixed_charge_minor' => (int) $this->fixed_charge_minor,
            'interest_rate' => $this->interest_rate,
            'interest_period' => $this->interest_period,
            'interest_start_date' => $this->interest_start_date?->format('Y-m-d'),
            'loan_date' => $this->loan_date?->format('Y-m-d'),
            'due_date' => $this->due_date?->format('Y-m-d'),
            'notes' => $this->notes,
            'status' => $this->status,
            'server_version' => (int) $this->server_version,
            'balance' => $balance,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
