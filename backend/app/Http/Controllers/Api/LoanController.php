<?php

namespace App\Http\Controllers\Api;

use App\Actions\Loans\CreateLoanAction;
use App\Actions\Loans\DeleteLoanAction;
use App\Actions\Loans\UpdateLoanAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Loans\StoreLoanRequest;
use App\Http\Requests\Loans\UpdateLoanRequest;
use App\Http\Resources\LoanResource;
use App\Models\Loan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class LoanController extends Controller
{
    /**
     * List loans belonging to the authenticated user.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $status = $request->query('status');

        $query = $request->user()
            ->loans()
            ->with('borrower')
            ->latest('loan_date')
            ->latest('created_at');

        if ($status) {
            $query->where('status', $status);
        }

        return LoanResource::collection($query->paginate(50));
    }

    /**
     * Create a new loan.
     */
    public function store(StoreLoanRequest $request, CreateLoanAction $action): JsonResponse
    {
        $loan = $action->execute($request->user(), $request->validated());
        $loan->load('borrower');

        return (new LoanResource($loan))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * View loan details with calculated balance.
     */
    public function show(Request $request, Loan $loan): LoanResource
    {
        Gate::authorize('view', $loan);

        $loan->load('borrower');

        return new LoanResource($loan);
    }

    /**
     * Update loan fields.
     */
    public function update(
        UpdateLoanRequest $request,
        Loan $loan,
        UpdateLoanAction $action
    ): LoanResource {
        Gate::authorize('update', $loan);

        $updated = $action->execute($loan, $request->validated());
        $updated->load('borrower');

        return new LoanResource($updated);
    }

    /**
     * Soft delete a loan.
     */
    public function destroy(
        Request $request,
        Loan $loan,
        DeleteLoanAction $action
    ): JsonResponse {
        Gate::authorize('delete', $loan);

        $action->execute($loan);

        return response()->json([
            'message' => 'Loan deleted successfully.',
        ]);
    }
}
