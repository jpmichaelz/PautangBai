<?php

namespace App\Models;

use Database\Factories\SyncEventFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncEvent extends Model
{
    /** @use HasFactory<SyncEventFactory> */
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'id',
        'user_id',
        'entity_type',
        'entity_id',
        'operation',
        'payload_json',
        'idempotency_key',
        'status',
        'error_message',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
        ];
    }

    /**
     * User who initiated the sync event.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
