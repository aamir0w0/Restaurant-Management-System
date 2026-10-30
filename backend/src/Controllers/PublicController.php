<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Validator};
use App\Services\{OrderService, StripeService, Money};
/** Unauthenticated endpoints for the customer website. Everything is validated and priced server-side. */
final class PublicController {
    private function limit(Request $r, string $kind, int $max): void {
        Db::run('DELETE FROM public_requests WHERE created_at < (NOW() - INTERVAL 1 DAY)');
        if ((int)Db::val('SELECT COUNT(*) FROM public_requests WHERE ip=? AND kind=? AND created_at > (NOW() - INTERVAL 10 MINUTE)', [$r->ip(), $kind]) >= $max) throw new HttpException(429, 'Too many requests. Please try again in a few minutes.');
        Db::run('INSERT INTO public_requests (ip,kind) VALUES (?,?)', [$r->ip(), $kind]);
    }
    public function config(Request $r): void {
        $s = SettingsController::all(); $c = Money::ctx();
        Response::json(['restaurant_name' => $s['restaurant_name'] ?? '', 'address' => $s['address'] ?? '', 'phone' => $s['phone'] ?? '', 'currency' => $c['currency'], 'base_currency' => $c['base'], 'exchange_rate' => $c['rate'],
            'tax_rate' => (float)($s['tax_rate'] ?? 0), 'delivery_charge' => (float)($s['delivery_charge'] ?? 0), 'min_order' => (float)($s['online_min_order'] ?? 0), 'ui_theme' => $s['ui_theme'] ?? 'ocean',
            'tagline' => $s['store_tagline'] ?? '', 'about' => $s['store_about'] ?? '', 'hours' => $s['store_hours'] ?? '', 'wa_number' => \App\Services\WhatsAppService::normalize($s['phone'] ?? ''),
            'ordering_enabled' => ($s['online_ordering_enabled'] ?? '1') === '1', 'delivery_enabled' => ($s['online_delivery_enabled'] ?? '1') === '1', 'card_payments' => StripeService::enabled()]);
    }
    public function menu(Request $r): void {
        $items = Db::all('SELECT id,category_id,name,description,image_path,base_price,prep_minutes,is_available FROM menu_items WHERE is_active=1 AND is_available=1 ORDER BY name');
        Response::json(['categories' => Db::all('SELECT id,name FROM categories WHERE is_active=1 ORDER BY sort_order,name'), 'items' => (new MenuController())->hydrate($items),
            'popular' => array_map('intval', array_column(Db::all("SELECT oi.menu_item_id AS id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled' AND o.created_at > (NOW() - INTERVAL 30 DAY) GROUP BY oi.menu_item_id ORDER BY SUM(oi.quantity) DESC LIMIT 4"), 'id'))]);
    }
    public function order(Request $r): void {
        $s = SettingsController::all(); $b = $r->body;
        if (($s['online_ordering_enabled'] ?? '1') !== '1') throw new HttpException(403, 'Online ordering is currently closed');
        $this->limit($r, 'order', 6);
        $type = $b['order_type'] ?? '';
        if (!in_array($type, ['takeaway', 'delivery'], true)) throw new HttpException(422, 'Validation failed', ['order_type' => 'Choose pickup or delivery']);
        if ($type === 'delivery' && ($s['online_delivery_enabled'] ?? '1') !== '1') throw new HttpException(422, 'Validation failed', ['order_type' => 'Delivery is not available']);
        $c = Validator::clean(['name' => ['type' => 'string', 'required' => true, 'max' => 120], 'phone' => ['type' => 'string', 'required' => true, 'max' => 30], 'email' => ['type' => 'email']], is_array($b['customer'] ?? null) ? $b['customer'] : []);
        $phone = preg_replace('/[^0-9+]/', '', $c['phone']);
        if (strlen(preg_replace('/\D/', '', $phone)) < 7) throw new HttpException(422, 'Validation failed', ['phone' => 'Enter a valid phone number']);
        $card = ($b['pay_method'] ?? 'cash') === 'card';
        if ($card && !StripeService::enabled()) throw new HttpException(422, 'Validation failed', ['pay_method' => 'Online card payment is not available']);
        // CRM link: reuse the customer with this phone number, otherwise create one tagged source=online
        $custId = Db::tx(function () use ($c, $phone) {
            $row = Db::one('SELECT id FROM customers WHERE phone=? AND is_active=1 ORDER BY id LIMIT 1', [$phone]);
            if ($row) { if ($c['email']) Db::run('UPDATE customers SET email=COALESCE(email,?) WHERE id=?', [$c['email'], $row['id']]); return (int)$row['id']; }
            return Db::insert('INSERT INTO customers (name,phone,email,source) VALUES (?,?,?,?)', [$c['name'], $phone, $c['email'], 'online']);
        });
        $order = OrderService::create(['order_type' => $type, 'customer_id' => $custId, 'delivery_address' => $b['delivery_address'] ?? null, 'notes' => $b['notes'] ?? null, 'items' => $b['items'] ?? null, 'idempotency_key' => $b['idempotency_key'] ?? null], null, 'online');
        \App\Services\WhatsAppService::orderThanks($order, $phone, $c['name']);
        $out = ['order_number' => $order['order_number'], 'total' => $order['total'], 'currency' => $order['currency'], 'phone' => $phone, 'checkout_url' => null];
        if ($card && $order['payment_status'] === 'unpaid') {
            try { $out['checkout_url'] = StripeService::checkout($order, $phone); }
            catch (\Throwable $e) { @file_put_contents(BASE_PATH . '/storage/logs/app.log', date('c') . ' ' . $e . "\n", FILE_APPEND); $out['payment_error'] = 'Card payment could not be started. You can pay when you receive your order.'; }
        }
        Response::json($out, 'Order received', 201);
    }
    public function track(Request $r): void {
        $this->limit($r, 'track', 80);
        $o = Db::one("SELECT o.id,o.order_number,o.order_type,o.status,o.payment_status,o.subtotal,o.tax_total,o.delivery_charge,o.total,o.paid_total,o.currency,o.created_at,o.delivery_address,c.phone FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.order_number=? AND o.source='online'", [$r->params['number']]);
        $given = preg_replace('/\D/', '', $r->query['phone'] ?? ''); $have = preg_replace('/\D/', '', $o['phone'] ?? '');
        if (!$o || $given === '' || !hash_equals($have, $given)) throw new HttpException(404, 'Order not found');
        $o['items'] = Db::all('SELECT item_name,variant_name,quantity,line_total FROM order_items WHERE order_id=?', [$o['id']]);
        unset($o['phone'], $o['id']);
        Response::json($o);
    }
}
