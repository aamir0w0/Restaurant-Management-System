<?php
namespace App\Services;
use App\Controllers\SettingsController;
/**
 * Currency model: menu prices and ingredient costs are entered in the BASE currency.
 * Orders are priced in the transaction CURRENCY: every unit price is converted ONCE (rounded to the currency's
 * precision) and all later totals are integer sums of those rounded amounts, so receipts never show a gap.
 * exchange_rate = how many CURRENCY units equal 1 BASE unit (e.g. USD->PKR 280).
 */
final class Money {
    private const ZERO_DECIMAL = ['PKR', 'JPY', 'KRW', 'VND'];
    public static function decimals(string $c): int { return in_array(strtoupper($c), self::ZERO_DECIMAL, true) ? 0 : 2; }
    public static function ctx(): array {
        $s = SettingsController::all(); $cur = $s['currency'] ?? 'USD'; $base = $s['base_currency'] ?? $cur;
        $rate = $cur === $base ? 1.0 : (float)($s['exchange_rate'] ?? 1); if ($rate <= 0) $rate = 1.0;
        return ['currency' => $cur, 'base' => $base, 'rate' => $rate, 'decimals' => self::decimals($cur)];
    }
    /** base-currency cents -> order-currency cents, rounded to the currency precision */
    public static function toOrder(int $baseCents, array $ctx): int { return (int)round(round($baseCents / 100 * $ctx['rate'], $ctx['decimals']) * 100); }
    public static function roundCents(int $cents, int $decimals): int { return $decimals === 0 ? (int)(round($cents / 100) * 100) : $cents; }
    /** minor units as used by payment gateways */
    public static function gatewayMinor(int $cents, string $currency): int { return self::decimals($currency) === 0 && in_array(strtoupper($currency), ['JPY', 'KRW', 'VND'], true) ? intdiv($cents, 100) : $cents; }
}
