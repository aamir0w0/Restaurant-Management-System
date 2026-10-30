<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit};
final class SettingsController {
    public const RULES = ['restaurant_name' => 'str', 'address' => 'str', 'phone' => 'str', 'email' => 'str', 'currency' => 'cur', 'tax_rate' => 'pct', 'service_charge_rate' => 'pct',
        'delivery_charge' => 'num', 'payment_methods' => 'methods', 'receipt_footer' => 'str', 'allow_negative_stock' => 'bool', 'base_currency' => 'cur', 'exchange_rate' => 'rate',
        'ui_theme' => 'theme', 'receipt_theme' => 'rtheme', 'online_ordering_enabled' => 'bool', 'online_delivery_enabled' => 'bool', 'online_min_order' => 'num', 'loyalty_points_per_unit' => 'num',
        'whatsapp_enabled' => 'bool', 'whatsapp_notify_pos' => 'bool', 'whatsapp_country_code' => 'cc', 'store_tagline' => 'str', 'store_about' => 'str', 'store_hours' => 'str'];
    public const THEMES = ['ocean', 'forest', 'terracotta', 'midnight', 'rose']; public const RECEIPT_THEMES = ['classic', 'modern', 'minimal'];
    public static function all(): array { return array_column(Db::all('SELECT key_name,value_text FROM settings'), 'value_text', 'key_name'); }
    public function show(Request $r): void { Response::json(self::all()); }
    public function update(Request $r): void {
        $err = []; $new = [];
        foreach ($r->body as $k => $v) {
            if (!isset(self::RULES[$k])) continue;
            $v = trim((string)$v);
            switch (self::RULES[$k]) {
                case 'pct': if (!is_numeric($v) || $v < 0 || $v > 100) $err[$k] = '0-100'; break;
                case 'num': if (!is_numeric($v) || $v < 0) $err[$k] = 'Must be >= 0'; break;
                case 'bool': $v = $v === '1' || $v === 'true' ? '1' : '0'; break;
                case 'cur': if (!preg_match('/^[A-Z]{3}$/', $v)) $err[$k] = '3-letter code'; break;
                case 'methods': if (!preg_match('/^[a-z_]+(,[a-z_]+)*$/', $v) || !str_contains(',' . $v . ',', ',cash,')) $err[$k] = 'Comma list of lowercase names including cash'; break;
                case 'cc': if (!preg_match('/^\d{1,4}$/', $v)) $err[$k] = 'Digits only, e.g. 92'; break;
                case 'rate': if (!is_numeric($v) || $v <= 0 || $v > 1000000) $err[$k] = 'Must be greater than 0'; break;
                case 'theme': case 'rtheme': if (\App\Core\Auth::user()['role'] !== 'super_admin') throw new HttpException(403, 'Only a Super Admin can change themes'); $allowed = $k === 'ui_theme' ? self::THEMES : self::RECEIPT_THEMES; if (!in_array($v, $allowed, true)) $err[$k] = 'Unknown theme'; break;
                default: if (mb_strlen($v) > 500) $err[$k] = 'Too long';
            }
            $new[$k] = $v;
        }
        if ($err) throw new HttpException(422, 'Validation failed', $err);
        Db::tx(function () use ($new) { foreach ($new as $k => $v) Db::run('INSERT INTO settings (key_name,value_text) VALUES (?,?) ON DUPLICATE KEY UPDATE value_text=VALUES(value_text)', [$k, $v]); });
        Audit::log('settings_changed', 'settings', null, json_encode($new));
        Response::json(self::all(), 'Settings saved');
    }
}
