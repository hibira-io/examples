<?php

namespace App\Support;

/**
 * Integer minor units only: 4900 is USD 49.00. No floats anywhere.
 */
final class Money
{
    public const CURRENCY = 'USD';

    public static function format(int $minor, string $currency = self::CURRENCY): string
    {
        $sign = $minor < 0 ? '-' : '';
        $minor = abs($minor);

        return sprintf('%s %s%s.%02d', $currency, $sign, number_format(intdiv($minor, 100)), $minor % 100);
    }
}
