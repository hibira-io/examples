<?php

namespace Tests\Concurrency;

use Illuminate\Foundation\Testing\DatabaseTruncation;
use RuntimeException;
use Symfony\Component\Process\Exception\ProcessSignaledException;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * Real concurrency: each actor is a separate PHP process with its own
 * PostgreSQL connection, started at the same instant. Data is committed
 * (truncated between tests), not wrapped in a test transaction.
 */
abstract class ConcurrencyTestCase extends TestCase
{
    use DatabaseTruncation;

    protected function setUp(): void
    {
        parent::setUp();

        if (config('database.default') !== 'pgsql') {
            $this->markTestSkipped('The concurrency tests need PostgreSQL.');
        }

        $this->seedDemo();
    }

    /**
     * Starts every actor, lets them all boot, then releases them together.
     *
     * @param  list<list<string>>  $actors  arguments after the start time
     * @return list<array<string, mixed>>
     */
    protected function race(array $actors): array
    {
        $startAt = (int) (microtime(true) * 1000) + 2500;

        $processes = array_map(function (array $args) use ($startAt) {
            $process = new Process([PHP_BINARY, base_path('tests/Concurrency/bin/act.php'), (string) $startAt, ...$args], base_path(), $this->childEnv());
            $process->setTimeout(60);
            $process->start();

            return $process;
        }, $actors);

        return array_map(function (Process $process) {
            $process->wait();

            if (! $process->isSuccessful()) {
                throw new RuntimeException("Actor failed:\n".$process->getOutput().$process->getErrorOutput());
            }

            return json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
        }, $processes);
    }

    /** Runs `php artisan <args>` in its own process. */
    protected function artisanProcess(array $args, array $env = []): Process
    {
        $process = new Process([PHP_BINARY, 'artisan', ...$args], base_path(), $env + $this->childEnv());
        $process->setTimeout(60);

        try {
            $process->run();
        } catch (ProcessSignaledException) {
            // Killed on purpose (FaultInjection); the caller checks.
        }

        return $process;
    }

    /** @return array<string, string> */
    protected function childEnv(): array
    {
        return [
            'APP_ENV' => 'testing',
            // Children have no FakeHibira: point them at a closed port so a
            // trigger fails at once (and is reported, never fatal).
            'HIBIRA_HOST' => '127.0.0.1',
            'HIBIRA_PORT' => '9',
            'HIBIRA_SCHEME' => 'http',
            'LOG_CHANNEL' => 'null',
        ];
    }
}
