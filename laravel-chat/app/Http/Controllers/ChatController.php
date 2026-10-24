<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\View\View;

class ChatController extends Controller
{
    public function welcome(): View|RedirectResponse
    {
        return Auth::check() ? redirect()->route('room', 'general') : view('welcome');
    }

    /** Demo sign-in: a name is enough. A real app uses its own auth. */
    public function join(Request $request): RedirectResponse
    {
        $name = $request->validate(['name' => ['required', 'string', 'max:40']])['name'];

        $user = User::create([
            'name' => $name,
            'email' => Str::uuid().'@example.invalid',
            'password' => Str::random(40),
        ]);
        Auth::login($user, remember: true);

        return redirect()->route('room', 'general');
    }

    public function leave(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();

        return redirect('/');
    }

    public function room(string $room): View
    {
        abort_unless(in_array($room, Message::ROOMS, true), 404);

        $messages = Message::with('user')
            ->where('room', $room)
            ->latest('id')
            ->limit(50)
            ->get()
            ->reverse()
            ->map->toChat()
            ->values();

        return view('room', [
            'room' => $room,
            'rooms' => Message::ROOMS,
            'chat' => [
                'room' => $room,
                'me' => ['id' => Auth::id(), 'name' => Auth::user()->name],
                'messages' => $messages,
                'sendUrl' => route('messages.send', $room),
            ],
        ]);
    }

    public function send(Request $request, string $room): JsonResponse
    {
        abort_unless(in_array($room, Message::ROOMS, true), 404);

        $message = Message::create([
            'room' => $room,
            'user_id' => $request->user()->id,
            'body' => $request->validate(['body' => ['required', 'string', 'max:2000']])['body'],
        ]);

        // toOthers() skips the sender's own socket (X-Socket-ID, which Echo
        // adds to requests); the sender shows the message from this response.
        broadcast(new MessageSent($message->load('user')))->toOthers();

        return response()->json($message->toChat(), 201);
    }
}
