<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Auth};
final class CustomerController {
    public function profile(Request $r): void {
        $c = Db::one("SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.status<>'cancelled') AS order_count, (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.customer_id=c.id AND o.status<>'cancelled') AS total_spent FROM customers c WHERE c.id=?", [$r->params['id']]);
        if (!$c) throw new HttpException(404, 'Not found');
        $c['orders'] = Db::all('SELECT id,order_number,source,order_type,status,payment_status,total,currency,created_at FROM orders WHERE customer_id=? ORDER BY id DESC LIMIT 20', [$c['id']]);
        $c['loyalty'] = Db::all('SELECT type,points,reason,created_at FROM loyalty_transactions WHERE customer_id=? ORDER BY id DESC LIMIT 20', [$c['id']]);
        Response::json($c);
    }
    public function adjustPoints(Request $r): void {
        $id = (int)$r->params['id']; $pts = (int)($r->body['points'] ?? 0); $reason = trim((string)($r->body['reason'] ?? ''));
        if ($pts === 0 || $reason === '') throw new HttpException(422, 'Validation failed', ['points' => 'Non-zero points and a reason are required']);
        Db::tx(function () use ($id, $pts, $reason) {
            $c = Db::one('SELECT loyalty_points FROM customers WHERE id=? FOR UPDATE', [$id]);
            if (!$c) throw new HttpException(404, 'Not found');
            if ($c['loyalty_points'] + $pts < 0) throw new HttpException(409, 'Balance cannot go below zero');
            Db::run('INSERT INTO loyalty_transactions (customer_id,type,points,reason,created_by) VALUES (?,?,?,?,?)', [$id, $pts < 0 ? 'redeem' : 'adjust', $pts, mb_substr($reason, 0, 255), Auth::id()]);
            Db::run('UPDATE customers SET loyalty_points=loyalty_points+? WHERE id=?', [$pts, $id]);
        });
        Audit::log('loyalty_adjusted', 'customer', $id, "$pts: $reason");
        Response::json(null, 'Points updated');
    }
}
