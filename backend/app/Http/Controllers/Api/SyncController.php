<?php

namespace App\Http\Controllers\Api;

use App\Actions\Borrowers\AddBorrowerAction;
use App\Actions\Borrowers\DeleteBorrowerAction;
use App\Actions\Borrowers\UpdateBorrowerAction;
use App\Actions\Loans\CreateLoanAction;
use App\Actions\Loans\DeleteLoanAction;
use App\Actions\Loans\UpdateLoanAction;
use App\Actions\Payments\RecordPaymentAction;
use App\Actions\Payments\ReversePaymentAction;
use App\Http\Controllers\Controller;
use App\Http\Resources\BorrowerResource;
use App\Http\Resources\LoanResource;
use App\Http\Resources\PaymentResource;
use App\Models\SyncEvent;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncController extends Controller
{
    public function __construct(
        private readonly AddBorrowerAction $addBorrower,
        private readonly UpdateBorrowerAction $updateBorrower,
        private readonly DeleteBorrowerAction $deleteBorrower,
        private readonly CreateLoanAction $createLoan,
        private readonly UpdateLoanAction $updateLoan,
        private readonly DeleteLoanAction $deleteLoan,
        private readonly RecordPaymentAction $recordPayment,
        private readonly ReversePaymentAction $reversePayment,
    ) {}

    /**
     * Push offline queued operations to the server.
     */
    public function push(Request $request): JsonResponse
    {
        $request->validate([
            'operations' => ['required', 'array'],
            'operations.*.id' => ['required', 'string'],
            'operations.*.entity_type' => ['required', 'string', 'in:borrower,loan,payment'],
            'operations.*.entity_id' => ['required', 'string'],
            'operations.*.operation' => ['required', 'string', 'in:create,update,delete'],
            'operations.*.payload' => ['nullable', 'array'],
            'operations.*.idempotency_key' => ['required', 'string'],
        ]);

        $user = $request->user();
        $results = [];

        foreach ($request->input('operations') as $op) {
            $opId = $op['id'];
            $entityType = $op['entity_type'];
            $entityId = $op['entity_id'];
            $operation = $op['operation'];
            $payload = $op['payload'] ?? [];
            $idempotencyKey = $op['idempotency_key'];

            // 1. Check idempotency
            $existing = SyncEvent::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                $results[] = [
                    'id' => $opId,
                    'status' => 'duplicate',
                    'entity_id' => $existing->entity_id,
                    'error' => null,
                ];

                continue;
            }

            try {
                DB::transaction(function () use (
                    $user,
                    $entityType,
                    $entityId,
                    $operation,
                    $payload,
                    $idempotencyKey
                ) {
                    $payloadWithId = array_merge($payload, ['id' => $entityId]);

                    match ($entityType) {
                        'borrower' => match ($operation) {
                            'create' => $this->addBorrower->execute($user, $payloadWithId),
                            'update' => $this->updateBorrower->execute(
                                $user->borrowers()->findOrFail($entityId),
                                $payload
                            ),
                            'delete' => $this->deleteBorrower->execute(
                                $user->borrowers()->findOrFail($entityId)
                            ),
                        },
                        'loan' => match ($operation) {
                            'create' => $this->createLoan->execute($user, $payloadWithId),
                            'update' => $this->updateLoan->execute(
                                $user->loans()->findOrFail($entityId),
                                $payload
                            ),
                            'delete' => $this->deleteLoan->execute(
                                $user->loans()->findOrFail($entityId)
                            ),
                        },
                        'payment' => match ($operation) {
                            'create' => $this->recordPayment->execute(
                                $user,
                                $user->loans()->findOrFail($payload['loan_id']),
                                array_merge($payloadWithId, ['idempotency_key' => $idempotencyKey])
                            ),
                            'delete' => $this->reversePayment->execute(
                                $user->payments()->findOrFail($entityId)
                            ),
                            default => null,
                        },
                    };

                    // Record sync audit event
                    SyncEvent::create([
                        'user_id' => $user->id,
                        'entity_type' => $entityType,
                        'entity_id' => $entityId,
                        'operation' => $operation,
                        'payload_json' => $payload,
                        'idempotency_key' => $idempotencyKey,
                        'status' => 'applied',
                    ]);
                });

                $results[] = [
                    'id' => $opId,
                    'status' => 'applied',
                    'entity_id' => $entityId,
                    'error' => null,
                ];
            } catch (Throwable $e) {
                // Record failed sync attempt
                SyncEvent::create([
                    'user_id' => $user->id,
                    'entity_type' => $entityType,
                    'entity_id' => $entityId,
                    'operation' => $operation,
                    'payload_json' => $payload,
                    'idempotency_key' => $idempotencyKey,
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                ]);

                $results[] = [
                    'id' => $opId,
                    'status' => 'failed',
                    'entity_id' => $entityId,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'results' => $results,
            'synced_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Pull changes since the provided cursor.
     */
    public function pull(Request $request): JsonResponse
    {
        $cursor = $request->query('cursor');
        $user = $request->user();

        $borrowersQuery = $user->borrowers()->withTrashed();
        $loansQuery = $user->loans()->withTrashed()->with('borrower');
        $paymentsQuery = $user->payments()->withTrashed();

        if ($cursor) {
            $date = Carbon::parse($cursor);
            $borrowersQuery->where('updated_at', '>=', $date);
            $loansQuery->where('updated_at', '>=', $date);
            $paymentsQuery->where('updated_at', '>=', $date);
        }

        return response()->json([
            'borrowers' => BorrowerResource::collection($borrowersQuery->get()),
            'loans' => LoanResource::collection($loansQuery->get()),
            'payments' => PaymentResource::collection($paymentsQuery->get()),
            'cursor' => now()->toIso8601String(),
        ]);
    }
}
