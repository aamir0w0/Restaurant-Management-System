<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Auth};
use App\Services\{OrderService, PaymentService};
final class OrderController {
    public function index(Request $r): void {
        $w = []; $p = [];
        foreach (['status', 'payment_status', 'order_type', 'source'] as $f) if (!empty($r->query[$f])) { $w[] = "o.$f=?"; $p[] = $r->query[$f]; }
        if (!empty($r->query['from'])) { $w[] = 'DATE(o.created_at)>=?'; $p[] = $r->query['from']; }
        if (!empty($r->query['to'])) { $w[] = 'DATE(o.created_at)<=?'; $p[] = $r->query['to']; }
        if (!empty($r->query['q'])) { $w[] = '(o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)'; array_push($p, ...array_fill(0, 3, '%' . $r->query['q'] . '%')); }
        $page = $r->int('page', 1, 1, 100000); $per = $r->int('per_page', 20, 1, 100);
        $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
        $total = (int)Db::val("SELECT COUNT(*) FROM orders o LEFT JOIN customers c ON c.id=o.customer_id $where", $p);
        $rows = Db::all("SELECT o.id,o.order_number,o.source,o.order_type,o.status,o.payment_status,o.total,o.paid_total,o.refunded_total,o.created_at,t.number AS table_number,c.name AS customer_name FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id LEFT JOIN customers c ON c.id=o.customer_id $where ORDER BY o.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        Response::json($rows, 'OK', 200, ['page' => $page, 'per_page' => $per, 'total' => $total]);
    }
    public function show(Request $r): void { Response::json(OrderService::detail((int)$r->params['id'])); }
    public function store(Request $r): void {
        $o = OrderService::create($r->body, Auth::id());
        if ((SettingsController::all()['whatsapp_notify_pos'] ?? '0') === '1' && !empty($o['customer_phone'])) \App\Services\WhatsAppService::orderThanks($o, $o['customer_phone'], (string)($o['customer_name'] ?? ''));
        Response::json($o, 'Order created', 201);
    }
    public function status(Request $r): void { Response::json(OrderService::transition((int)$r->params['id'], (string)($r->body['status'] ?? ''), isset($r->body['note']) ? trim((string)$r->body['note']) : null), 'Status updated'); }
    public function transfer(Request $r): void { Response::json(OrderService::transfer((int)$r->params['id'], (int)($r->body['table_id'] ?? 0)), 'Order transferred'); }
    public function pay(Request $r): void { Response::json(PaymentService::pay((int)$r->params['id'], $r->body), 'Payment recorded', 201); }
    public function refund(Request $r): void { Response::json(PaymentService::refund((int)$r->params['id'], $r->body), 'Refund recorded', 201); }
    public function kitchen(Request $r): void {
        $rows = Db::all("SELECT o.id,o.order_number,o.order_type,o.status,o.payment_status,o.notes,t.number AS table_number,TIMESTAMPDIFF(SECOND,o.created_at,NOW()) AS elapsed_seconds,(SELECT h.note FROM order_status_history h WHERE h.order_id=o.id AND h.to_status='cancelled' ORDER BY h.id DESC LIMIT 1) AS cancel_reason FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id WHERE o.status IN ('pending','accepted','preparing','ready') OR (o.status IN ('served','completed') AND o.updated_at > NOW() - INTERVAL 15 MINUTE) OR (o.status='cancelled' AND o.updated_at > NOW() - INTERVAL 10 MINUTE) ORDER BY o.created_at");
        foreach ($rows as &$o) {
            $o['items'] = Db::all('SELECT id,item_name,variant_name,quantity,notes FROM order_items WHERE order_id=?', [$o['id']]);
            foreach ($o['items'] as &$i) $i['modifiers'] = array_column(Db::all('SELECT name FROM order_item_modifiers WHERE order_item_id=?', [$i['id']]), 'name');
        }
        Response::json($rows);
    }
}