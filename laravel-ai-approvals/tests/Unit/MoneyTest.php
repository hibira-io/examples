<?php

namespace Tests\Unit;

use App\Support\Money;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    /**
     * @return array<string, array{int, string}>
     */
    public static function amounts(): array
    {
        return [
            'paid order' => [4900, 'USD 49.00'],
            'edited refund' => [2900, 'USD 29.00'],
            'one cent' => [1, 'USD 0.01'],
            'zero' => [0, 'USD 0.00'],
            'thousands' => [123456, 'USD 1,234.56'],
            'negative' => [-4900, 'USD -49.00'],
        ];
    }

    #[DataProvider('amounts')]
    public function test_it_formats_integer_minor_units(int $minor, string $expected): void
    {
        $this->assertSame($expected, Money::format($minor));
    }
}
