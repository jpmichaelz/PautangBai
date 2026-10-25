<?php

namespace Tests\Feature;

use App\Actions\Borrowers\AddBorrowerAction;
use App\Actions\Loans\CreateLoanAction;
use App\Models\User;
use App\Services\InterestCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_create_and_list_borrowers(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        // Create
        $response = $this->postJson('/api/v1/borrowers', [
            'name' => 'Cardo Dalisay',
            'phone' => '09181234567',
            'notes' => 'Neighbor',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.name', 'Cardo Dalisay')
            ->assertJsonPath('data.phone', '09181234567');

        // List
        $listResponse = $this->getJson('/api/v1/borrowers');
        $listResponse->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Cardo Dalisay');
    }

    public function test_user_cannot_view_or_modify_another_users_borrower(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $borrowerOfB = (new AddBorrowerAction)->execute($userB, ['name' => 'Secret Borrower']);

        Sanctum::actingAs($userA);

        // Attempt show
        $this->getJson("/api/v1/borrowers/{$borrowerOfB->id}")
            ->assertStatus(403);

        // Attempt update
        $this->putJson("/api/v1/borrowers/{$borrowerOfB->id}", ['name' => 'Hacked'])
            ->assertStatus(403);

        // Attempt delete
        $this->deleteJson("/api/v1/borrowers/{$borrowerOfB->id}")
            ->assertStatus(403);
    }

    public function test_can_create_and_view_loan_with_balance(): void
    {
        $user = User::factory()->create();
        $borrower = (new AddBorrowerAction)->execute($user, ['name' => 'Jose']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/loans', [
            'borrower_id' => $borrower->id,
            'principal_minor' => 100000, // ₱1,000.00
            'interest_type' => 'percentage_flat',
            'interest_rate' => '10', // 10% = ₱100.00 (10,000 centavos)
            'loan_date' => '2026-10-25',
            'due_date' => '2026-11-25',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.principal_minor', 100000)
            ->assertJsonPath('data.fixed_charge_minor', 10000)
            ->assertJsonPath('data.balance.total_owed_minor', 110000)
            ->assertJsonPath('data.balance.remaining_balance_minor', 110000)
            ->assertJsonPath('data.balance.is_paid', false);

        $loanId = $response->json('data.id');

        // Show endpoint
        $showResponse = $this->getJson("/api/v1/loans/{$loanId}");
        $showResponse->assertStatus(200)
            ->assertJsonPath('data.id', $loanId)
            ->assertJsonPath('data.borrower.name', 'Jose');
    }

    public function test_cannot_create_loan_for_borrower_owned_by_someone_else(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $borrowerB = (new AddBorrowerAction)->execute($userB, ['name' => 'Target']);

        Sanctum::actingAs($userA);

        $response = $this->postJson('/api/v1/loans', [
            'borrower_id' => $borrowerB->id,
            'principal_minor' => 50000,
            'interest_type' => 'none',
            'loan_date' => '2026-10-25',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['borrower_id']);
    }

    public function test_can_record_payment_and_reversal(): void
    {
        $user = User::factory()->create();
        $borrower = (new AddBorrowerAction)->execute($user, ['name' => 'Grace']);
        $calculator = new InterestCalculationService;
        $loan = (new CreateLoanAction($calculator))->execute($user, [
            'borrower_id' => $borrower->id,
            'principal_minor' => 100000,
            'interest_type' => 'fixed_amount',
            'fixed_charge_minor' => 15000, // ₱150 fee => ₱1,150 total (115,000 centavos)
            'loan_date' => '2026-10-25',
        ]);

        Sanctum::actingAs($user);

        // Record payment of ₱200 (20,000 centavos)
        // Fee first: 15,000 interest + 5,000 principal
        $paymentResponse = $this->postJson("/api/v1/loans/{$loan->id}/payments", [
            'amount_minor' => 20000,
            'payment_date' => '2026-10-25',
            'payment_method' => 'gcash',
            'reference' => 'GCASH-123456',
        ]);

        $paymentResponse->assertStatus(201)
            ->assertJsonPath('data.amount_minor', 20000)
            ->assertJsonPath('data.payment_method', 'gcash')
            ->assertJsonPath('data.allocation.interest_minor', 15000)
            ->assertJsonPath('data.allocation.principal_minor', 5000);

        $paymentId = $paymentResponse->json('data.id');

        // Check loan balance: 115,000 - 20,000 = 95,000 remaining
        $loanShow = $this->getJson("/api/v1/loans/{$loan->id}");
        $loanShow->assertStatus(200)
            ->assertJsonPath('data.balance.remaining_balance_minor', 95000);

        // Reverse payment
        $reverseResponse = $this->deleteJson("/api/v1/payments/{$paymentId}");
        $reverseResponse->assertStatus(200)
            ->assertJson(['message' => 'Payment reversed successfully.']);

        // Check balance restored to 115,000
        $loanShowRestored = $this->getJson("/api/v1/loans/{$loan->id}");
        $loanShowRestored->assertStatus(200)
            ->assertJsonPath('data.balance.remaining_balance_minor', 115000);
    }

    public function test_cannot_record_payment_on_another_users_loan(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $borrowerB = (new AddBorrowerAction)->execute($userB, ['name' => 'Borrower B']);
        $calculator = new InterestCalculationService;
        $loanB = (new CreateLoanAction($calculator))->execute($userB, [
            'borrower_id' => $borrowerB->id,
            'principal_minor' => 50000,
            'interest_type' => 'none',
            'loan_date' => '2026-10-25',
        ]);

        Sanctum::actingAs($userA);

        $this->postJson("/api/v1/loans/{$loanB->id}/payments", [
            'amount_minor' => 10000,
            'payment_date' => '2026-10-25',
        ])->assertStatus(403);
    }
}
