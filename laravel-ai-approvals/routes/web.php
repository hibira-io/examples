<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\SupportController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect(auth()->check() ? AuthController::home(auth()->user()) : route('login')));

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'show'])->name('login');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/demo-login/{user}', [AuthController::class, 'demo'])->name('demo-login')->middleware('throttle:30,1');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
    Route::view('/forbidden', 'auth.forbidden')->name('forbidden');

    Route::get('/support', [SupportController::class, 'index'])->name('support');
    Route::get('/support/orders/{order:number}', [SupportController::class, 'show'])->name('support.order');
    Route::get('/cases/{case}', [SupportController::class, 'state'])->name('cases.show');
    Route::post('/cases/{case}/messages', [SupportController::class, 'message'])->name('cases.messages')->middleware('throttle:20,1');
});
