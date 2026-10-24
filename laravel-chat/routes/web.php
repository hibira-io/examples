<?php

use App\Http\Controllers\ChatController;
use Illuminate\Support\Facades\Route;

Route::get('/', [ChatController::class, 'welcome']);
Route::post('/join', [ChatController::class, 'join'])->name('join');

Route::middleware('auth')->group(function () {
    Route::post('/leave', [ChatController::class, 'leave'])->name('leave');
    Route::get('/rooms/{room}', [ChatController::class, 'room'])->name('room');
    Route::post('/rooms/{room}/messages', [ChatController::class, 'send'])->name('messages.send');
});
