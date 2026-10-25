<?php

namespace App\Http\Controllers\Api;

use App\Actions\Payments\RecordPaymentAction;
use App\Actions\Payments\ReversePaymentAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Loan;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class PaymentController extends Controller
{
    /**
     * List payments for a specific loan.
     */
    public function index(Request $request, Loan $loan): AnonymousResourceCollection
    {
        Gate::authorize('view', $loan);

        $payments = $loan->payments()
            ->latest('payment_date')
            ->latest('created_at')
            ->paginate(50);

        return PaymentResource::collection($payments);
    }

    /**
     * Record a payment against a loan.
     */
    public function store(
        StorePaymentRequest $request,
        Loan $loan,
        RecordPaymentAction $action
    ): JsonResponse {
        Gate::authorize('update', $loan);

        $payment = $action->execute($request->user(), $loan, $request->validated());

        return (new PaymentResource($payment))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Reverse / void a mistaken payment.
     */
    public function destroy(
        Request $request,
        Payment $payment,
        ReversePaymentAction $action
    ): JsonResponse {
        Gate::authorize('delete', $payment);

        $action->execute($payment);

        return response()->json([
            'message' => 'Payment reversed successfully.',
        ]);
    }
}
