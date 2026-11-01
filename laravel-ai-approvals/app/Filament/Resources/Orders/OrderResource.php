<?php

namespace App\Filament\Resources\Orders;

use App\Filament\Resources\Orders\Pages\ListOrders;
use App\Models\Order;
use App\Models\User;
use App\Support\Money;
use Filament\Resources\Resource;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

/** The demo orders with what has been refunded. Read-only. */
class OrderResource extends Resource
{
    protected static ?string $model = Order::class;

    protected static ?int $navigationSort = 30;

    public static function getNavigationIcon(): string
    {
        return 'heroicon-o-shopping-bag';
    }

    public static function getModelLabel(): string
    {
        return __('support.admin.order');
    }

    public static function getPluralModelLabel(): string
    {
        return __('support.admin.orders');
    }

    public static function canAccess(): bool
    {
        return auth()->user() instanceof User && auth()->user()->isApprover();
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        $money = fn (int $state, Order $record) => Money::format($state, $record->currency);

        return $table->columns([
            TextColumn::make('number')->label(__('support.admin.order'))->fontFamily('mono'),
            TextColumn::make('customer.name')->label(__('support.admin.customer')),
            TextColumn::make('description')->label(__('support.admin.item')),
            TextColumn::make('paid_amount')->label(__('support.admin.paid'))->formatStateUsing($money),
            TextColumn::make('refunded_amount')->label(__('support.admin.refunded'))->formatStateUsing($money),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListOrders::route('/'),
        ];
    }
}
