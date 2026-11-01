<?php

namespace Tests\Support;

use Hibira\Laravel\Hibira;
use RuntimeException;

/**
 * Replaces the transport to Hibira in unit and feature tests: records the
 * events instead of sending them, or fails like an unreachable server.
 * The end-to-end tests (tests/e2e) use a real WebSocket server instead.
 */
class FakeHibira extends Hibira
{
    /** @var list<array{channel: string, event: string, data: array<string, mixed>}> */
    public array $sent = [];

    public bool $failing = false;

    public function __construct()
    {
        parent::__construct([]);
    }

    public function realtime()
    {
        return new class($this)
        {
            public function __construct(private FakeHibira $hibira) {}

            /** @param  array<string, mixed>  $data */
            public function trigger(string|array $channels, string $event, array $data): object
            {
                if ($this->hibira->failing) {
                    throw new RuntimeException('Hibira unreachable (test).');
                }

                foreach ((array) $channels as $channel) {
                    $this->hibira->sent[] = ['channel' => $channel, 'event' => $event, 'data' => $data];
                }

                return (object) [];
            }

            public function get(string $path, array $params = [], bool $associative = false): mixed
            {
                if ($this->hibira->failing) {
                    throw new RuntimeException('Hibira unreachable (test).');
                }

                return ['users' => []];
            }
        };
    }

    /** @return list<array{channel: string, event: string, data: array<string, mixed>}> */
    public function on(string $channel, ?string $event = null): array
    {
        return array_values(array_filter($this->sent, fn (array $sent) => $sent['channel'] === $channel && ($event === null || $sent['event'] === $event)));
    }
}
