<?php

namespace App\Providers\Filament;

use App\Models\Order;
use App\Models\RefundOperation;
use App\Models\User;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\View\PanelsRenderHook;
use Hibira\Filament\HibiraPlugin;
use Hibira\FilamentApprovals\HibiraApprovalsPlugin;
use Hibira\FilamentApprovals\Pages\Approvals;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/**
 * The managers' panel: the AI approvals inbox from
 * hibira-io/filament-approvals, live over Hibira with hibira-io/filament,
 * plus read-only lists of the orders and refunds behind the requests.
 */
class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->login()
            ->brandName(__('support.app_name'))
            ->colors(['primary' => Color::Indigo])
            ->homeUrl(fn () => Approvals::getUrl())
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->plugins([
                HibiraPlugin::make()
                    ->connectionStatus()
                    ->liveTables(models: [RefundOperation::class, Order::class]),
                HibiraApprovalsPlugin::make()
                    // Who may see and decide requests (also checked on every
                    // decision and on the inbox's Hibira channels).
                    ->authorize(fn (User $user) => $user->isApprover())
                    // Who gets a Hibira Push notification (when HIBIRA_PUSH_* is set).
                    ->approvers(fn () => User::query()->where('role', User::APPROVER)->get()),
            ])
            // The order and refund behind the request, next to the inbox.
            ->renderHook(PanelsRenderHook::PAGE_START, fn () => view('filament.refund-context'), scopes: Approvals::class)
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
