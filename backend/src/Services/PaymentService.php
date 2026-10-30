<?php
namespace App\Services;
use App\Core\{Db, HttpException, Audit, Auth};
use App\Controllers\SettingsController;
final class PaymentService {
    private static function recalc(int $oid): void {
        $o = Db::one('SELECT total,paid_total,refunded_total FROM orders WHERE id=?', [$oid]);
        $net = OrderService::cents($o['paid_total']) - OrderService::cents($o['refunded_total']); $total = OrderService::cents($o['total']);
        $refunded = OrderService::cents($o['refunded_total']) > 0;
        $s = $net <= 0 ? ($refunded ? 'refunded' : 'unpaid') : ($net >= $total ? 'paid' : ($refunded ? 'partially_refunded' : 'partially_paid'));
        Db::run('UPDATE orders SET payment_status=? WHERE id=?', [$s, $oid]);
    }
    public static function pay(int $oid, array $in): array { return self::record($oid, $in, Auth::id(), false); }
    /** $system=true is used by gateway webhooks (no staff user, gateway method allowed). */
    public static function record(int $oid, array $in, ?int $userId, bool $system): array {
        $method = (string)($in['method'] ?? '');
        $methods = explode(',', SettingsController::all()['payment_methods'] ?? 'cash');
        if (!$system && !in_array($method, $methods, true)) throw new HttpException(422, 'Validation failed', ['method' => 'Unsupported payment method']);
        if (!isset($in['amount']) || !is_numeric($in['amount'])) throw new HttpException(422, 'Validation failed', ['amount' => 'Required']);
        $amount = OrderService::cents($in['amount']);
        if ($amount <= 0) throw new HttpException(422, 'Validation failed', ['amount' => 'Must be greater than 0']);
        $key = isset($in['idempotency_key']) ? substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string)$in['idempotency_key']), 0, 64) : null;
        Db::tx(function () use ($oid, $in, $method, $amount, $key, $userId) {
            $o = Db::one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$oid]);
            if (!$o) throw new HttpException(404, 'Order not found');
            if ($key) { $ex = Db::one('SELECT order_id FROM payments WHERE idempotency_key=?', [$key]); if ($ex) { if ((int)$ex['order_id'] === $oid) return; throw new HttpException(409, 'Idempotency key already used'); } }
            if ($o['status'] === 'cancelled') throw new HttpException(409, 'Cannot take payment on a cancelled order');
            $due = OrderService::cents($o['total']) - (OrderService::cents($o['paid_total']) - OrderService::cents($o['refunded_total']));
            if ($due <= 0) throw new HttpException(409, 'Order is already fully paid');
            if ($amount > $due) throw new HttpException(422, 'Validation failed', ['amount' => 'Exceeds balance due of ' . OrderService::money($due)]);
            $tendered = $change = null;
            if ($method === 'cash' && isset($in['tendered']) && is_numeric($in['tendered'])) {
                $t = OrderService::cents($in['tendered']);
                if ($t < $amount) throw new HttpException(422, 'Validation failed', ['tendered' => 'Less than amount']);
                $tendered = OrderService::money($t); $change = OrderService::money($t - $amount);
            }
            Db::insert('INSERT INTO payments (order_id,method,amount,tendered,change_given,reference,idempotency_key,received_by) VALUES (?,?,?,?,?,?,?,?)',
                [$oid, $method, OrderService::money($amount), $tendered, $change, mb_substr((string)($in['reference'] ?? ''), 0, 100) ?: null, $key ?: null, $userId]);
            Db::run('UPDATE orders SET paid_total=paid_total+? WHERE id=?', [OrderService::money($amount), $oid]);
            self::recalc($oid);
            Audit::log('payment_recorded', 'order', $oid, "{$o['order_number']} $method " . OrderService::money($amount), $userId);
            if ($method === 'card_online') Audit::notify('payment', "Online card payment received for {$o['order_number']}", "paid:$oid");
        });
        return OrderService::detail($oid);
    }
    public static function refund(int $oid, array $in): array {
        $reason = trim((string)($in['reason'] ?? ''));
        if ($reason === '') throw new HttpException(422, 'Validation failed', ['reason' => 'Required']);
        if (!isset($in['amount']) || !is_numeric($in['amount']) || OrderService::cents($in['amount']) <= 0) throw new HttpException(422, 'Validation failed', ['amount' => 'Must be greater than 0']);
        $amount = OrderService::cents($in['amount']);
        Db::tx(function () use ($oid, $amount, $reason) {
            $o = Db::one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$oid]);
            if (!$o) throw new HttpException(404, 'Order not found');
            $net = OrderService::cents($o['paid_total']) - OrderService::cents($o['refunded_total']);
            if ($amount > $net) throw new HttpException(422, 'Validation failed', ['amount' => 'Exceeds refundable amount of ' . OrderService::money($net)]);
            Db::insert('INSERT INTO refunds (order_id,amount,reason,refunded_by) VALUES (?,?,?,?)', [$oid, OrderService::money($amount), mb_substr($reason, 0, 255), Auth::id()]);
            Db::run('UPDATE orders SET refunded_total=refunded_total+? WHERE id=?', [OrderService::money($amount), $oid]);
            self::recalc($oid);
            Audit::log('refund_issued', 'order', $oid, "{$o['order_number']} " . OrderService::money($amount) . " - $reason");
            Audit::notify('payment', 'Refund of ' . OrderService::money($amount) . " on {$o['order_number']}" . ($o['paid_total'] > 0 && Db::val("SELECT COUNT(*) FROM payments WHERE order_id=? AND method='card_online'", [$oid]) ? ' (card_online: refund the card in the gateway dashboard too)' : ''));
            // Stock is intentionally NOT returned: prepared food is not reusable inventory.
        });
        return OrderService::detail($oid);
    }
}
