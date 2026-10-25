<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('borrower_id')->constrained('borrowers')->cascadeOnDelete();
            $table->bigInteger('principal_minor');
            $table->string('currency', 3)->default('PHP');
            $table->string('interest_type')->default('none');
            $table->bigInteger('fixed_charge_minor')->default(0);
            $table->string('interest_rate')->nullable();
            $table->string('interest_period')->nullable();
            $table->date('interest_start_date')->nullable();
            $table->date('loan_date');
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('active');
            $table->unsignedInteger('server_version')->default(1);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'due_date']);
            $table->index(['borrower_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
