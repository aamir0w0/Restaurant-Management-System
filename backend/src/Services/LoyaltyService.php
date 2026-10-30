<?php
namespace App\Services;
use App\Core\Db;
use App\Controllers\SettingsController;
final class LoyaltyService {
    /** Earn once per order (UNIQUE(order_id,type)). Points = floor(order total in BASE currency * points_per_unit). */
    public static function earn(array $order): void {
        if (empty($order['customer_id'])) return;
        $s = SettingsController::all(); $per = (float)($s['loyalty_points_per_unit'] ?? 1); if ($per <= 0) return;
        $rate = max((float)$order['exchange_rate'], 0.000001);
        $pts = (int)floor(((float)$order['total'] / $rate) * $per);
        if ($pts <= 0) return;
        if (Db::run("INSERT IGNORE INTO loyalty_transactions (customer_id,order_id,type,points,reason) VALUES (?,?,'earn',?,?)", [$order['customer_id'], $order['id'], $pts, 'Order ' . $order['order_number']]))
            Db::run('UPDATE customers SET loyalty_points=loyalty_points+? WHERE id=?', [$pts, $order['customer_id']]);
    }
}
