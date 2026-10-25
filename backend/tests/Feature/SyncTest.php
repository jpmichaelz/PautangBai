<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_push_offline_queue_in_dependency_order(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $borrowerId = (string) Str::uuid();
        $loanId = (string) Str::uuid();
        $paymentId = (string) Str::uuid();

        $payload = [
            'operations' => [
                [
                    'id' => (string) Str::uuid(),
                    'entity_type' => 'borrower',
                    'entity_id' => $borrowerId,
                    'operation' => 'create',
                    'payload' => [
                        'name' => 'Offline Borrower',
                        'phone' => '09199999999',
                    ],
                    'idempotency_key' => 'idem-borrower-1',
                ],
                [
                    'id' => (string) Str::uuid(),
                    'entity_type' => 'loan',
                    'entity_id' => $loanId,
                    'operation' => 'create',
                    'payload' => [
                        'borrower_id' => $borrowerId,
                        'principal_minor' => 200000,
                        'interest_type' => 'none',
                        'loan_date' => '2026-10-25',
                    ],
                    'idempotency_key' => 'idem-loan-1',
                ],
                [
                    'id' => (string) Str::uuid(),
                    'entity_type' => 'payment',
                    'entity_id' => $paymentId,
                    'operation' => 'create',
                    'payload' => [
                        'loan_id' => $loanId,
                        'amount_minor' => 50000,
                        'payment_date' => '2026-10-25',
                    ],
                    'idempotency_key' => 'idem-pay-1',
                ],
            ],
        ];

        $response = $this->postJson('/api/v1/sync/push', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('results.0.status', 'applied')
            ->assertJsonPath('results.1.status', 'applied')
            ->assertJsonPath('results.2.status', 'applied');

        $this->assertDatabaseHas('borrowers', ['id' => $borrowerId, 'name' => 'Offline Borrower']);
        $this->assertDatabaseHas('loans', ['id' => $loanId, 'principal_minor' => 200000]);
        $this->assertDatabaseHas('payments', ['id' => $paymentId, 'amount_minor' => 50000]);

        // Retrying identical push returns 'duplicate' status without creating duplicates
        $retryResponse = $this->postJson('/api/v1/sync/push', $payload);
        $retryResponse->assertStatus(200)
            ->assertJsonPath('results.0.status', 'duplicate')
            ->assertJsonPath('results.1.status', 'duplicate')
            ->assertJsonPath('results.2.status', 'duplicate');

        $this->assertDatabaseCount('payments', 1);
    }

    public function test_can_pull_remote_changes(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // First push
        $borrowerId = (string) Str::uuid();
        $this->postJson('/api/v1/sync/push', [
            'operations' => [
                [
                    'id' => (string) Str::uuid(),
                    'entity_type' => 'borrower',
                    'entity_id' => $borrowerId,
                    'operation' => 'create',
                    'payload' => ['name' => 'Sync Target'],
                    'idempotency_key' => 'pull-test-1',
                ],
            ],
        ]);

        $pullResponse = $this->getJson('/api/v1/sync/pull');

        $pullResponse->assertStatus(200)
            ->assertJsonCount(1, 'borrowers')
            ->assertJsonPath('borrowers.0.id', $borrowerId)
            ->assertJsonStructure(['borrowers', 'loans', 'payments', 'cursor']);
    }
}
