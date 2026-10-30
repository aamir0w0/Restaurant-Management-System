<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit};
final class TableController {
    public function status(Request $r): void {
        $id = (int)$r->params['id']; $s = $r->body['status'] ?? '';
        if (!in_array($s, ['available', 'occupied', 'reserved', 'cleaning', 'out_of_service'], true)) throw new HttpException(422, 'Validation failed', ['status' => 'Invalid']);
        Db::tx(function () use ($id, $s) {
            $t = Db::one('SELECT id FROM dining_tables WHERE id=? AND is_active=1 FOR UPDATE', [$id]);
            if (!$t) throw new HttpException(404, 'Table not found');
            $open = (int)Db::val("SELECT COUNT(*) FROM orders WHERE table_id=? AND status NOT IN ('completed','cancelled')", [$id]);
            if ($open && $s !== 'occupied') throw new HttpException(409, 'Table has an open order');
            if (!$open && $s === 'occupied') throw new HttpException(409, 'Table has no open order');
            Db::run('UPDATE dining_tables SET status=? WHERE id=?', [$s, $id]);
            Audit::log('table_status', 'table', $id, $s);
        });
        Response::json(null, 'Table updated');
    }
    public function index(Request $r): void {
        Response::json(Db::all("SELECT t.*, (SELECT o.id FROM orders o WHERE o.table_id=t.id AND o.status NOT IN ('completed','cancelled') ORDER BY o.id DESC LIMIT 1) AS open_order_id, (SELECT o.order_number FROM orders o WHERE o.table_id=t.id AND o.status NOT IN ('completed','cancelled') ORDER BY o.id DESC LIMIT 1) AS open_order_number FROM dining_tables t WHERE t.is_active=1 ORDER BY t.section, t.number"));
    }
}
