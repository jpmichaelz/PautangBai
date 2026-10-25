<?php

namespace App\Models;

use Database\Factories\LoanFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Loan extends Model
{
    /** @use HasFactory<LoanFactory> */
    use HasFactory, HasUuids, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'user_id',
        'borrower_id',
        'principal_minor',
        'currency',
        'interest_type',
        'fixed_charge_minor',
        'interest_rate',
        'interest_period',
        'interest_start_date',
        'loan_date',
        'due_date',
        'notes',
        'status',
        'server_version',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'principal_minor' => 'integer',
            'fixed_charge_minor' => 'integer',
            'interest_start_date' => 'date',
            'loan_date' => 'date',
            'due_date' => 'date',
            'server_version' => 'integer',
        ];
    }

    /**
     * Owner of the loan.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Borrower who took this loan.
     */
    public function borrower(): BelongsTo
    {
        return $this->belongsTo(Borrower::class);
    }

    /**
     * Payments applied to this loan.
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
