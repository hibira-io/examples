<?php

namespace App\Support;

/**
 * Test-only crash points: with DEMO_CRASH_AT=<point> in the testing
 * environment, the process kills itself there, the way a worker dies on a
 * deploy or an out-of-memory kill. Does nothing anywhere else.
 */
final class FaultInjection
{
    public static function hit(string $point): void
    {
        if (! app()->environment('testing') || getenv('DEMO_CRASH_AT') !== $point) {
            return;
        }

        if (function_exists('posix_kill')) {
            posix_kill(getmypid(), SIGKILL);
        }

        exit(137);
    }
}
