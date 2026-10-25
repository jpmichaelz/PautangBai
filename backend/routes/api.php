<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BorrowerController;
use App\Http\Controllers\Api\LoanController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\SyncController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // Health check
    Route::get('/health', fn () => response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]));

    // Public authentication routes
    Route::prefix('auth')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
    });

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {
        Route::prefix('auth')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/me', [AuthController::class, 'me']);
        });

        Route::get('/me', [AuthController::class, 'me']);

        // Borrowers
        Route::apiResource('borrowers', BorrowerController::class);

        // Loans
        Route::apiResource('loans', LoanController::class);

        // Payments
        Route::get('loans/{loan}/payments', [PaymentController::class, 'index']);
        Route::post('loans/{loan}/payments', [PaymentController::class, 'store']);
        Route::delete('payments/{payment}', [PaymentController::class, 'destroy']);

        // Offline Sync Endpoints
        Route::post('sync/push', [SyncController::class, 'push']);
        Route::get('sync/pull', [SyncController::class, 'pull']);
    });
});
