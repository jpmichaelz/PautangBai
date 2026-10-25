<?php

namespace App\Http\Controllers\Api;

use App\Actions\Borrowers\AddBorrowerAction;
use App\Actions\Borrowers\DeleteBorrowerAction;
use App\Actions\Borrowers\UpdateBorrowerAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Borrowers\StoreBorrowerRequest;
use App\Http\Requests\Borrowers\UpdateBorrowerRequest;
use App\Http\Resources\BorrowerResource;
use App\Models\Borrower;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class BorrowerController extends Controller
{
    /**
     * List all borrowers for the authenticated user.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $borrowers = $request->user()
            ->borrowers()
            ->orderBy('name')
            ->paginate(50);

        return BorrowerResource::collection($borrowers);
    }

    /**
     * Create a new borrower.
     */
    public function store(StoreBorrowerRequest $request, AddBorrowerAction $action): JsonResponse
    {
        $borrower = $action->execute($request->user(), $request->validated());

        return (new BorrowerResource($borrower))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Show a borrower details.
     */
    public function show(Request $request, Borrower $borrower): BorrowerResource
    {
        Gate::authorize('view', $borrower);

        return new BorrowerResource($borrower);
    }

    /**
     * Update an existing borrower.
     */
    public function update(
        UpdateBorrowerRequest $request,
        Borrower $borrower,
        UpdateBorrowerAction $action
    ): BorrowerResource {
        Gate::authorize('update', $borrower);

        $updated = $action->execute($borrower, $request->validated());

        return new BorrowerResource($updated);
    }

    /**
     * Soft delete a borrower.
     */
    public function destroy(
        Request $request,
        Borrower $borrower,
        DeleteBorrowerAction $action
    ): JsonResponse {
        Gate::authorize('delete', $borrower);

        $action->execute($borrower);

        return response()->json([
            'message' => 'Borrower deleted successfully.',
        ]);
    }
}
