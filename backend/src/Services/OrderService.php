<?php
namespace App\Services;
use App\Core\{Db, HttpException, Audit, Auth};
use App\Controllers\SettingsController;
/** All money math is done in integer cents on the server; browser totals are never trusted. */
final class OrderService {
    public const TYPES = ['dine_in', 'takeaway', 'delivery'];
    public const FLOW = ['pending' => ['accepted', 'cancelled'], 'accepted' => ['preparing', 'cancelled'], 'preparing' => ['ready', 'cancelled'], 'ready' => ['served', 'completed', 'cancelled'], 'served' => ['completed'], 'completed' => [], 'cancelled' => []];
    public static function cents($v): int { return (int)round(((float)$v) * 100); }
    public static function money(int $c): string { return number_format($c / 100, 2, '.', ''); }

    public static function create(array $in, ?int $userId = null, string $source = 'pos'): array {
        $type = $in['order_type'] ?? '';
        if (!in_array($type, self::TYPES, true)) throw new HttpException(422, 'Validation failed', ['order_type' => 'Invalid']);
        $items = $in['items'] ?? null;
        if (!is_array($items) || !$items || count($items) > 100) throw new HttpException(422, 'Validation failed', ['items' => 'Between 1 and 100 items required']);
        $key = isset($in['idempotency_key']) ? substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string)$in['idempotency_key']), 0, 64) : null;
        if ($key) { $ex = Db::one('SELECT id FROM orders WHERE idempotency_key=?', [$key]); if ($ex) return self::detail((int)$ex['id']); }
        $set = SettingsController::all(); $ctx = Money::ctx();
        $id = Db::tx(function () use ($in, $type, $items, $key, $set, $ctx, $userId, $source) {
            $tableId = null;
            if ($type === 'dine_in') {
                $tableId = (int)($in['table_id'] ?? 0);
                $t = Db::one('SELECT id,status,is_active FROM dining_tables WHERE id=? FOR UPDATE', [$tableId]);
                if (!$t || !$t['is_active']) throw new HttpException(422, 'Validation failed', ['table_id' => 'Table required for dine-in']);
                if (in_array($t['status'], ['out_of_service', 'cleaning', 'reserved'], true)) throw new HttpException(409, "Table is {$t['status']}");
            }
            $custId = !empty($in['customer_id']) ? (int)$in['customer_id'] : null;
            if ($custId && !Db::val('SELECT COUNT(*) FROM customers WHERE id=? AND is_active=1', [$custId])) throw new HttpException(422, 'Validation failed', ['customer_id' => 'Unknown customer']);
            if ($type === 'delivery' && trim((string)($in['delivery_address'] ?? '')) === '') throw new HttpException(422, 'Validation failed', ['delivery_address' => 'Required for delivery']);

            $subtotal = 0; $lines = [];
            foreach ($items as $n => $it) {
                $qty = filter_var($it['quantity'] ?? 1, FILTER_VALIDATE_INT);
                if ($qty === false || $qty < 1 || $qty > 99) throw new HttpException(422, 'Validation failed', ["items.$n.quantity" => '1-99']);
                $m = Db::one('SELECT id,name,base_price,is_active,is_available FROM menu_items WHERE id=?', [(int)($it['menu_item_id'] ?? 0)]);
                if (!$m || !$m['is_active'] || !$m['is_available']) throw new HttpException(422, 'Validation failed', ["items.$n.menu_item_id" => 'Item unavailable']);
                $unit = self::cents($m['base_price']); $vname = null; $vid = null;
                $variants = Db::all('SELECT id,name,price_delta FROM menu_item_variants WHERE menu_item_id=? AND is_active=1', [$m['id']]);
                if (!empty($it['variant_id'])) {
                    $v = current(array_filter($variants, fn($x) => (int)$x['id'] === (int)$it['variant_id']));
                    if (!$v) throw new HttpException(422, 'Validation failed', ["items.$n.variant_id" => 'Invalid variant']);
                    $unit += self::cents($v['price_delta']); $vname = $v['name']; $vid = (int)$v['id'];
                } elseif ($variants) throw new HttpException(422, 'Validation failed', ["items.$n.variant_id" => 'Variant required']);
                $mods = [];
                $allowed = Db::all('SELECT mo.id,mo.name,mo.price,mo.group_id FROM modifiers mo JOIN menu_item_modifier_groups l ON l.group_id=mo.group_id JOIN modifier_groups g ON g.id=mo.group_id WHERE l.menu_item_id=? AND mo.is_active=1 AND g.is_active=1', [$m['id']]);
                $perGroup = [];
                foreach (array_unique(array_map('intval', $it['modifier_ids'] ?? [])) as $mid) {
                    $mo = current(array_filter($allowed, fn($x) => (int)$x['id'] === $mid));
                    if (!$mo) throw new HttpException(422, 'Validation failed', ["items.$n.modifier_ids" => 'Invalid modifier']);
                    $unit += self::cents($mo['price']); $mods[] = $mo; $perGroup[$mo['group_id']] = ($perGroup[$mo['group_id']] ?? 0) + 1;
                }
                foreach (Db::all('SELECT g.id,g.name,g.min_select,g.max_select FROM modifier_groups g JOIN menu_item_modifier_groups l ON l.group_id=g.id WHERE l.menu_item_id=? AND g.is_active=1', [$m['id']]) as $g) {
                    $c = $perGroup[$g['id']] ?? 0;
                    if ($c < $g['min_select'] || $c > $g['max_select']) throw new HttpException(422, 'Validation failed', ["items.$n.modifier_ids" => "{$g['name']}: choose {$g['min_select']}-{$g['max_select']}"]);
                }
                $unit = Money::toOrder($unit, $ctx); // convert once, round once
                $line = $unit * $qty; $subtotal += $line;
                $lines[] = ['m' => $m, 'vid' => $vid, 'vname' => $vname, 'unit' => $unit, 'qty' => $qty, 'line' => $line, 'mods' => $mods, 'notes' => mb_substr(trim((string)($it['notes'] ?? '')), 0, 255) ?: null];
            }
            if ($source === 'online') { $min = Money::toOrder(self::cents($set['online_min_order'] ?? 0), $ctx); if ($subtotal < $min) throw new HttpException(422, 'Minimum online order is ' . self::money($min) . ' ' . $ctx['currency']); }
            $discount = $source === 'pos' ? Money::roundCents(self::cents($in['discount_amount'] ?? 0), $ctx['decimals']) : 0;
            if ($discount < 0 || $discount > $subtotal) throw new HttpException(422, 'Validation failed', ['discount_amount' => 'Must be between 0 and subtotal']);
            if ($discount > 0 && !Auth::can('orders.discount')) throw new HttpException(403, 'You are not allowed to apply discounts');
            $taxable = $subtotal - $discount;
            $tax = Money::roundCents((int)round($taxable * (float)($set['tax_rate'] ?? 0) / 100), $ctx['decimals']);
            $service = $type === 'dine_in' ? Money::roundCents((int)round($taxable * (float)($set['service_charge_rate'] ?? 0) / 100), $ctx['decimals']) : 0;
            $delivery = $type === 'delivery' ? Money::toOrder(self::cents($set['delivery_charge'] ?? 0), $ctx) : 0;
            $total = $taxable + $tax + $service + $delivery;

            $day = date('Y-m-d');
            Db::run('INSERT IGNORE INTO order_counters (day,last_number) VALUES (?,0)', [$day]);
            $num = (int)Db::val('SELECT last_number FROM order_counters WHERE day=? FOR UPDATE', [$day]) + 1;
            Db::run('UPDATE order_counters SET last_number=? WHERE day=?', [$num, $day]);
            $orderNo = sprintf('ORD-%s-%04d', date('Ymd'), $num);
            $oid = Db::insert('INSERT INTO orders (order_number,idempotency_key,order_type,table_id,customer_id,cashier_id,delivery_address,notes,subtotal,discount_total,tax_total,service_charge,delivery_charge,total,source,currency,exchange_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$orderNo, $key ?: null, $type, $tableId, $custId, $userId, $in['delivery_address'] ?? null, mb_substr((string)($in['notes'] ?? ''), 0, 500) ?: null,
                 self::money($subtotal), self::money($discount), self::money($tax), self::money($service), self::money($delivery), self::money($total), $source, $ctx['currency'], $ctx['rate']]);
            foreach ($lines as $l) {
                $iid = Db::insert('INSERT INTO order_items (order_id,menu_item_id,variant_id,item_name,variant_name,unit_price,quantity,line_total,notes) VALUES (?,?,?,?,?,?,?,?,?)',
                    [$oid, $l['m']['id'], $l['vid'], $l['m']['name'], $l['vname'], self::money($l['unit']), $l['qty'], self::money($l['line']), $l['notes']]);
                foreach ($l['mods'] as $mo) Db::run('INSERT INTO order_item_modifiers (order_item_id,modifier_id,name,price) VALUES (?,?,?,?)', [$iid, $mo['id'], $mo['name'], self::money(Money::toOrder(self::cents($mo['price']), $ctx))]);
            }
            Db::run('INSERT INTO order_status_history (order_id,from_status,to_status,changed_by) VALUES (?,NULL,?,?)', [$oid, 'pending', $userId]);
            if ($tableId) Db::run("UPDATE dining_tables SET status='occupied' WHERE id=?", [$tableId]);
            if ($discount > 0) Audit::log('discount_applied', 'order', $oid, "$orderNo discount " . self::money($discount));
            Audit::notify('order', ($source === 'online' ? 'New ONLINE order ' : 'New order ') . $orderNo, "order:$oid");
            return $oid;
        });
        return self::detail($id);
    }

    public static function transition(int $id, string $to, ?string $note = null): array {
        Db::tx(function () use ($id, $to, $note) {
            $o = Db::one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$id]);
            if (!$o) throw new HttpException(404, 'Order not found');
            if (!in_array($to, self::FLOW[$o['status']] ?? [], true)) throw new HttpException(409, "Cannot move order from {$o['status']} to $to");
            $need = match ($to) { 'served', 'completed' => 'orders.update', default => null }; // cancelling: any staff who can run orders or the kitchen (reason is mandatory and audited)
            if ($need && !Auth::can($need)) throw new HttpException(403, 'You do not have permission for this status change');
            if (!$need && !Auth::can('kitchen.update') && !Auth::can('orders.update') && !($to === 'cancelled' && Auth::can('orders.cancel'))) throw new HttpException(403, 'You do not have permission for this status change');
            if ($to === 'cancelled') {
                if ((float)$o['paid_total'] - (float)$o['refunded_total'] > 0.004) throw new HttpException(409, 'Refund the collected payment before cancelling this order');
                if (!$note) throw new HttpException(422, 'Validation failed', ['note' => 'A cancellation reason is required']);
                Audit::log('order_cancelled', 'order', $id, "{$o['order_number']} (was {$o['status']}): $note" . ($o['stock_deducted'] ? ' [ingredients already deducted - record wastage if food was prepared]' : ''));
                Audit::notify('order', "Order {$o['order_number']} was cancelled: $note", "cancel:$id");
            }
            if ($to === 'completed' && !in_array($o['payment_status'], ['paid'], true)) throw new HttpException(409, 'Order must be fully paid before completion');
            if ($to === 'preparing') InventoryService::deductForOrder($id);
            Db::run('UPDATE orders SET status=? WHERE id=?', [$to, $id]);
            Db::run('INSERT INTO order_status_history (order_id,from_status,to_status,changed_by,note) VALUES (?,?,?,?,?)', [$id, $o['status'], $to, Auth::id(), $note]);
            if ($to === 'completed') LoyaltyService::earn($o);
            if ($o['table_id'] && in_array($to, ['completed', 'cancelled'], true)) self::releaseTable((int)$o['table_id'], $to === 'completed' ? 'cleaning' : 'available');
            if ($to === 'ready') Audit::notify('order', "Order {$o['order_number']} is ready", "ready:$id");
        });
        return self::detail($id);
    }
    private static function releaseTable(int $tid, string $newStatus): void {
        if (!Db::val("SELECT COUNT(*) FROM orders WHERE table_id=? AND status NOT IN ('completed','cancelled')", [$tid])) Db::run("UPDATE dining_tables SET status=? WHERE id=? AND status='occupied'", [$newStatus, $tid]);
    }
    public static function transfer(int $id, int $tableId): array {
        Db::tx(function () use ($id, $tableId) {
            $o = Db::one('SELECT * FROM orders WHERE id=? FOR UPDATE', [$id]);
            if (!$o) throw new HttpException(404, 'Order not found');
            if ($o['order_type'] !== 'dine_in' || in_array($o['status'], ['completed', 'cancelled'], true)) throw new HttpException(409, 'Only open dine-in orders can be transferred');
            $t = Db::one('SELECT status FROM dining_tables WHERE id=? AND is_active=1 FOR UPDATE', [$tableId]);
            if (!$t || $t['status'] !== 'available') throw new HttpException(409, 'Target table is not available');
            Db::run("UPDATE dining_tables SET status='occupied' WHERE id=?", [$tableId]);
            Db::run('UPDATE orders SET table_id=? WHERE id=?', [$tableId, $id]);
            if ($o['table_id']) self::releaseTable((int)$o['table_id'], 'cleaning');
            Audit::log('table_transfer', 'order', $id, "{$o['table_id']} -> $tableId");
        });
        return self::detail($id);
    }
    public static function detail(int $id): array {
        $o = Db::one('SELECT o.*, t.number AS table_number, c.name AS customer_name, c.phone AS customer_phone, COALESCE(u.name,\'Online\') AS cashier_name FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN users u ON u.id=o.cashier_id WHERE o.id=?', [$id]);
        if (!$o) throw new HttpException(404, 'Order not found');
        $o['items'] = Db::all('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [$id]);
        foreach ($o['items'] as &$i) $i['modifiers'] = Db::all('SELECT name,price FROM order_item_modifiers WHERE order_item_id=?', [$i['id']]);
        $o['payments'] = Db::all('SELECT id,method,amount,tendered,change_given,reference,created_at FROM payments WHERE order_id=? ORDER BY id', [$id]);
        $o['refunds'] = Db::all('SELECT amount,reason,created_at FROM refunds WHERE order_id=? ORDER BY id', [$id]);
        $o['history'] = Db::all('SELECT h.from_status,h.to_status,h.note,h.created_at,u.name AS by_name FROM order_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.order_id=? ORDER BY h.id', [$id]);
        $o['balance_due'] = self::money(max(0, self::cents($o['total']) - (self::cents($o['paid_total']) - self::cents($o['refunded_total']))));
        return $o;
    }
}