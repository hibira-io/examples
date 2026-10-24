<?php

use App\Models\Message;
use Illuminate\Support\Facades\Broadcast;

// Presence channel per room: whoever may join gets listed to everyone else
// with the data returned here.
Broadcast::channel('room.{room}', function ($user, string $room) {
    if (! in_array($room, Message::ROOMS, true)) {
        return false;
    }

    return ['id' => $user->id, 'name' => $user->name];
});
