<?php

namespace Tests;

use App\Jobs\RunCustomerTurn;
use App\Models\Order;
use App\Models\SupportCase;
use App\Models\User;
use App\Support\SupportTurns;
use Database\Seeders\DemoSeeder;
use Filament\Facades\Filament;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Hibira\FilamentApprovals\Pages\Approvals;
use Hibira\Laravel\Hibira;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Livewire\Features\SupportTesting\Testable;
use Livewire\Livewire;
use Tests\Support\FakeHibira;

abstract class TestCase extends BaseTestCase
{
    protected FakeHibira $hibira;

    protected function setUp(): void
    {
        parent::setUp();

        $this->hibira = new FakeHibira;
        $this->app->instance(Hibira::class, $this->hibira);
    }

    protected function seedDemo(): void
    {
        $this->seed(DemoSeeder::class);
    }

    protected function customer(): User
    {
        return User::query()->where('email', 'customer@demo.test')->firstOrFail();
    }

    protected function managerA(): User
    {
        return User::query()->where('email', 'manager.a@demo.test')->firstOrFail();
    }

    protected function managerB(): User
    {
        return User::query()->where('email', 'manager.b@demo.test')->firstOrFail();
    }

    protected function outsider(): User
    {
        return User::query()->where('email', 'outsider@demo.test')->firstOrFail();
    }

    protected function order(): Order
    {
        return Order::query()->where('number', 'DEMO-1042')->firstOrFail();
    }

    /** The customer asks for the refund; the queued turn runs; returns the paused request. */
    protected function askForRefund(string $text = '我想退掉這筆訂單'): ApprovalRequest
    {
        $case = app(SupportTurns::class)->caseFor($this->customer(), $this->order());

        $this->actingAs($this->customer())
            ->postJson(route('cases.messages', $case), ['body' => $text])
            ->assertStatus(202);

        $case->refresh();
        $this->assertSame(SupportCase::AWAITING_APPROVAL, $case->status, 'the turn should pause for approval: '.$case->error);

        return $case->approvalRequest()->with('calls')->firstOrFail();
    }

    protected function supportCase(): SupportCase
    {
        return SupportCase::query()->where('order_id', $this->order()->id)->firstOrFail();
    }

    /** The AI approvals inbox page, as a manager. */
    protected function inbox(User $manager): Testable
    {
        $this->actingAs($manager);
        Filament::setCurrentPanel(Filament::getPanel('admin'));

        return Livewire::test(Approvals::class);
    }

    /** Runs the jobs queued so far on the database queue, like `queue:work --stop-when-empty`. */
    protected function work(): void
    {
        $this->artisan('queue:work', ['--stop-when-empty' => true, '--tries' => 1])->run();
    }

    protected function dispatchTurn(SupportCase $case, int $messageId): void
    {
        RunCustomerTurn::dispatchSync($case->id, $messageId);
    }
}
