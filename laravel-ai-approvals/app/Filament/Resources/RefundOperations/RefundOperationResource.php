<?php

namespace App\Filament\Resources\RefundOperations;

use App\Filament\Resources\RefundOperations\Pages\ListRefundOperations;
use App\Models\RefundOperation;
use App\Models\User;
use App\Support\Money;
use Filament\Resources\Resource;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * Every refund the agent asked for: requested and final amount, who
 * decided, and the refund it produced. Read-only; decisions are made in
 * the AI approvals inbox.
 */
class RefundOperationResource extends Resource
{
    protected static ?string $model = RefundOperation::class;

    protected static ?int $navigationSort = 20;

    public static function getNavigationIcon(): string
    {
        return 'heroicon-o-receipt-refund';
    }

    public static function getModelLabel(): string
    {
        return __('support.admin.operation');
    }

    public static function getPluralModelLabel(): string
    {
        return __('support.admin.operations');
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
        $money = fn (?int $state, RefundOperation $record) => $state === null ? '—' : Money::format($state, $record->currency);

        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('order.number')->label(__('support.admin.order')),
                TextColumn::make('requested_amount')->label(__('support.admin.requested'))->formatStateUsing($money),
                TextColumn::make('final_amount')->label(__('support.admin.final'))->formatStateUsing($money)->placeholder('—'),
                TextColumn::make('status')->label(__('support.admin.status'))->badge()
                    ->formatStateUsing(fn (string $state) => __("support.operation_status.{$state}"))
                    ->color(fn (string $state) => match ($state) {
                        RefundOperation::COMPLETED => 'success',
                        RefundOperation::REJECTED, RefundOperation::INVALID => 'danger',
                        default => 'warning',
                    }),
                TextColumn::make('decided_by_name')->label(__('support.admin.decided_by'))->placeholder('—'),
                TextColumn::make('note')->label(__('support.admin.note'))->placeholder('—')->limit(40)->wrap(),
                TextColumn::make('refund.reference')->label(__('support.admin.reference'))->placeholder('—')->fontFamily('mono'),
                TextColumn::make('id')->label(__('support.admin.operation_id'))->fontFamily('mono')->limit(8)->tooltip(fn (RefundOperation $record) => $record->id)->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('created_at')->label(__('support.admin.created'))->since(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListRefundOperations::route('/'),
        ];
    }
}
