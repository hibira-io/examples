<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The business side of the demo: orders, support cases, refund operations
 * and the refunds themselves. Approval requests and the agent's
 * conversation come from the hibira-io/filament-approvals and laravel/ai
 * migrations.
 *
 * Money is stored as integer minor units (4900 = USD 49.00).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // customer, approver or none (signed in, but allowed nothing).
            $table->string('role', 16)->default('none')->index();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('number', 32)->unique();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->string('description');
            $table->char('currency', 3);
            $table->unsignedInteger('paid_amount');
            $table->unsignedInteger('refunded_amount')->default(0);
            $table->timestamps();
        });

        Schema::create('support_cases', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('conversation_id', 36)->nullable()->unique();
            // idle, thinking, awaiting_approval, resuming, completed, rejected, failed
            $table->string('status', 24)->default('idle');
            $table->foreignUlid('approval_request_id')->nullable()->constrained('hibira_approval_requests')->nullOnDelete();
            $table->string('error')->nullable();
            // The agent turn being streamed right now.
            $table->uuid('run_id')->nullable();
            // Grows on every change; the browser drops events older than its snapshot.
            $table->unsignedBigInteger('version')->default(1);
            $table->timestamps();
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('case_id')->constrained('support_cases')->cascadeOnDelete();
            // customer, agent or notice
            $table->string('role', 16);
            $table->text('body');
            $table->timestamps();
        });

        // One row per refund tool call the agent asked for. Its id is the
        // logical operation id: created by the backend when the call pauses
        // for approval, reused by every retry, and unique on refunds.
        Schema::create('refund_operations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUlid('case_id')->constrained('support_cases')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('approval_request_id')->constrained('hibira_approval_requests')->cascadeOnDelete();
            $table->foreignId('approval_tool_call_id')->unique()->constrained('hibira_approval_tool_calls')->cascadeOnDelete();
            $table->string('tool_call_id');
            $table->char('currency', 3);
            $table->unsignedInteger('requested_amount');
            $table->unsignedInteger('final_amount')->nullable();
            // awaiting_decision, approved, rejected, completed, invalid
            $table->string('status', 24)->default('awaiting_decision');
            $table->string('decision', 8)->nullable();
            $table->string('decided_by')->nullable();
            $table->string('decided_by_name')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('operation_id')->unique()->constrained('refund_operations')->restrictOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->char('currency', 3);
            $table->unsignedInteger('amount');
            $table->string('reference', 64)->unique();
            $table->timestamps();
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders ADD CONSTRAINT orders_refund_within_paid CHECK (refunded_amount >= 0 AND refunded_amount <= paid_amount)');
            DB::statement('ALTER TABLE refunds ADD CONSTRAINT refunds_amount_positive CHECK (amount > 0)');
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_currency_usd CHECK (currency = 'USD')");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('refund_operations');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_cases');
        Schema::dropIfExists('orders');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
