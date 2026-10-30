<?php
namespace App\Controllers;
use App\Core\{Db, Auth, Request, Response, HttpException};
final class MiscController {
    /** notification type => permission needed to see it */
    private const TYPES = ['order' => 'orders.view', 'payment' => 'orders.view', 'reservation' => 'reservations.manage', 'purchase' => 'purchases.manage', 'low_stock' => 'inventory.view'];
    private function visibleTypes(): array { return array_values(array_filter(array_keys(self::TYPES), fn($t) => Auth::can(self::TYPES[$t]))); }
   public function notifications(Request $r): void {
    $types = $this->visibleTypes();
    $active = Auth::can('orders.view') ? (int)Db::val("SELECT COUNT(*) FROM orders WHERE status NOT IN ('completed','cancelled')") : 0;
    if (!$types) Response::json(['items' => [], 'unread' => 0, 'by_type' => (object)[], 'active_orders' => $active]);
    $in = implode(',', array_fill(0, count($types), '?'));
    $by = [];
    foreach (Db::all("SELECT type, COUNT(*) AS c FROM notifications WHERE is_read=0 AND type IN ($in) GROUP BY type", $types) as $row) $by[$row['type']] = (int)$row['c'];
    Response::json(['items' => Db::all("SELECT id,type,message,is_read,created_at FROM notifications WHERE type IN ($in) ORDER BY id DESC LIMIT 40", $types), 'unread' => array_sum($by), 'by_type' => (object)$by, 'active_orders' => $active]);
}
public function newOrders(Request $r): void {
    session_write_close(); // intezar ke dauran session lock na pakde
    set_time_limit(40);
    $after = $r->query['after'] ?? '';
    if ($after === '') Response::json(['last_id' => (int)Db::val("SELECT COALESCE(MAX(id),0) FROM notifications WHERE type='order'"), 'items' => []]);
    $after = (int)$after; $deadline = microtime(true) + 20;
    do {
        $rows = Db::all("SELECT id,message FROM notifications WHERE type='order' AND id>? AND message LIKE 'New%' ORDER BY id LIMIT 20", [$after]);
        if ($rows) Response::json(['last_id' => (int)end($rows)['id'], 'items' => $rows]);
        usleep(300000);
    } while (microtime(true) < $deadline);
    Response::json(['last_id' => $after, 'items' => []]);
}
    /** Shared inbox: when one admin reads a notification it is cleared for everyone. */
    public function read(Request $r): void { Db::run('UPDATE notifications SET is_read=1 WHERE id=? AND type IN (' . implode(',', array_fill(0, max(1, count($this->visibleTypes())), '?')) . ')', [(int)$r->params['id'], ...($this->visibleTypes() ?: [''])]); Response::json(null, 'Marked as read'); }
    public function readTypes(Request $r): void {
        $want = array_values(array_intersect(is_array($r->body['types'] ?? null) ? $r->body['types'] : [], $this->visibleTypes()));
        if ($want) Db::run('UPDATE notifications SET is_read=1 WHERE is_read=0 AND type IN (' . implode(',', array_fill(0, count($want), '?')) . ')', $want);
        Response::json(null, 'Marked as read');
    }
    public function readAll(Request $r): void { $this->readTypes(new Request('POST', '/', [], ['types' => $this->visibleTypes()])); }
    public function audit(Request $r): void {
        $per = $r->int('per_page', 50, 1, 200); $page = $r->int('page', 1, 1, 100000); $w = []; $p = [];
        if (!empty($r->query['action'])) { $w[] = 'a.action=?'; $p[] = $r->query['action']; }
        Response::json(Db::all('SELECT a.id,a.action,a.entity,a.entity_id,a.summary,a.ip,a.created_at,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id' . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . " ORDER BY a.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p));
    }
}
