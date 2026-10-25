<?php

namespace Tests\Feature;

use App\Actions\Borrowers\AddBorrowerAction;
use App\Actions\Loans\CreateLoanAction;
use App\Actions\Payments\RecordPaymentAction;
use App\Actions\Payments\ReversePaymentAction;
use App\Models\User;
use App\Services\InterestCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ActionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_add_borrower_action_creates_record_scoped_to_user(): void
    {
        $user = User::factory()->create();
        $action = new AddBorrowerAction;

        $borrower = $action->execute($user, [
            'name' => 'Juan Dela Cruz',
            'phone' => '09123456789',
        ]);

        $this->assertDatabaseHas('borrowers', [
            'id' => $borrower->id,
            'user_id' => $user->id,
            'name' => 'Juan Dela Cruz',
        ]);
    }

    public function test_create_loan_action_calculates_upfront_fee(): void
    {
        $user = User::factory()->create();
        $borrower = (new AddBorrowerAction)->execute($user, ['name' => 'Maria']);
        $calculator = new InterestCalculationService;
        $action = new CreateLoanAction($calculator);

        // ₱1,000 principal with 10% flat interest = ₱100 (10,000 centavos) fee
        $loan = $action->execute($user, [
            'borrower_id' => $borrower->id,
            'principal_minor' => 100000,
            'interest_type' => 'percentage_flat',
            'interest_rate' => '10',
            'loan_date' => '2026-10-25',
        ]);

        $this->assertEquals(100000, $loan->principal_minor);
        $this->assertEquals(10000, $loan->fixed_charge_minor);
        $this->assertEquals('active', $loan->status);
    }

    public function test_record_payment_action_allocates_fee_first_and_caps_at_balance(): void
    {
        $user = User::factory()->create();
        $borrower = (new AddBorrowerAction)->execute($user, ['name' => 'Pedro']);
        $calculator = new InterestCalculationService;
        $loanAction = new CreateLoanAction($calculator);

        // ₱1,000 principal + ₱200 fixed fee = ₱1,200 total (120,000 centavos)
        $loan = $loanAction->execute($user, [
            'borrower_id' => $borrower->id,
            'principal_minor' => 100000,
            'interest_type' => 'fixed_amount',
            'fixed_charge_minor' => 20000,
            'loan_date' => '2026-10-25',
        ]);

        $paymentAction = new RecordPaymentAction($calculator);

        // 1. Partial payment of ₱300 (30,000 centavos)
        // Fee-first: pays entire ₱200 fee + ₱100 towards principal
        $payment1 = $paymentAction->execute($user, $loan, [
            'amount_minor' => 30000,
            'payment_date' => '2026-10-25',
            'idempotency_key' => 'tx-1',
        ]);

        $this->assertEquals(20000, $payment1->allocation_json['interest_minor']);
        $this->assertEquals(10000, $payment1->allocation_json['principal_minor']);

        // Check remaining balance: 120,000 - 30,000 = 90,000 centavos (₱900)
        $balance = $calculator->calculateLoanBalance($loan);
        $this->assertEquals(90000, $balance['remaining_balance_minor']);

        // 2. Overpayment test: attempt to pay ₱1,000 (100,000 centavos) when only 90,000 owed
        $this->expectException(ValidationException::class);
        $paymentAction->execute($user, $loan, [
            'amount_minor' => 100000,
            'payment_date' => '2026-10-25',
        ]);
    }

    public function test_record_payment_marks_loan_as_paid_and_reverse_restores_active(): void
    {
        $user = User::factory()->create();
        $borrower = (new AddBorrowerAction)->execute($user, ['name' => 'Anna']);
        $calculator = new InterestCalculationService;
        $loanAction = new CreateLoanAction($calculator);

        // ₱500 with zero interest = ₱500 total (50,000 centavos)
        $loan = $loanAction->execute($user, [
            'borrower_id' => $borrower->id,
            'principal_minor' => 50000,
            'interest_type' => 'none',
            'loan_date' => '2026-10-25',
        ]);

        $paymentAction = new RecordPaymentAction($calculator);

        // Pay full balance
        $payment = $paymentAction->execute($user, $loan, [
            'amount_minor' => 50000,
            'payment_date' => '2026-10-25',
        ]);

        $loan->refresh();
        $this->assertEquals('paid', $loan->status);

        // Reverse payment
        $reverseAction = new ReversePaymentAction;
        $reverseAction->execute($payment);

        $loan->refresh();
        $this->assertEquals('active', $loan->status);
        $this->assertSoftDeleted('payments', ['id' => $payment->id]);
    }

    public function test_record_payment_is_idempotent(): void
    {
        $user = User::factory()->create();
        $borrower = (new AddBorrowerAction)->execute($user, ['name' => 'Idempotent User']);
        $calculator = new InterestCalculationService;
        $loan = (new CreateLoanAction($calculator))->execute($user, [
            'borrower_id' => $borrower->id,
            'principal_minor' => 100000,
            'interest_type' => 'none',
            'loan_date' => '2026-10-25',
        ]);

        $paymentAction = new RecordPaymentAction($calculator);

        $res1 = $paymentAction->execute($user, $loan, [
            'amount_minor' => 20000,
            'payment_date' => '2026-10-25',
            'idempotency_key' => 'unique-token-abc',
        ]);

        // Second retry with same key
        $res2 = $paymentAction->execute($user, $loan, [
            'amount_minor' => 20000,
            'payment_date' => '2026-10-25',
            'idempotency_key' => 'unique-token-abc',
        ]);

        $this->assertEquals($res1->id, $res2->id);
        $this->assertEquals(1, $loan->payments()->count());
    }
}
