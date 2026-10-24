<?php

namespace Tests\Feature;

use App\Events\MessageSent;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_joining_signs_in_and_opens_general(): void
    {
        $this->post('/join', ['name' => 'Aiko'])->assertRedirect('/rooms/general');

        $this->assertAuthenticated();
        $this->get('/rooms/general')->assertOk()->assertSee('#general');
    }

    public function test_sending_stores_and_broadcasts_to_the_room(): void
    {
        Event::fake([MessageSent::class]);
        $user = User::factory()->create(['name' => 'Bao']);

        $this->actingAs($user)
            ->postJson('/rooms/laravel/messages', ['body' => 'Hello'])
            ->assertCreated()
            ->assertJsonPath('user.name', 'Bao');

        $this->assertSame('Hello', Message::sole()->body);
        Event::assertDispatched(MessageSent::class, function (MessageSent $event) {
            return $event->broadcastOn()[0]->name === 'presence-room.laravel'
                && $event->broadcastWith()['body'] === 'Hello';
        });
    }

    public function test_unknown_rooms_are_refused(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->get('/rooms/secret')->assertNotFound();
        $this->actingAs($user)->postJson('/rooms/secret/messages', ['body' => 'x'])->assertNotFound();
    }

    public function test_presence_auth_returns_the_member(): void
    {
        $user = User::factory()->create(['name' => 'Chen']);

        $response = $this->actingAs($user)->post('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => 'presence-room.general',
        ])->assertOk();

        $data = json_decode($response->json('channel_data'), true);
        $this->assertSame('Chen', $data['user_info']['name']);

        $this->actingAs($user)->post('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => 'presence-room.secret',
        ])->assertForbidden();
    }
}
