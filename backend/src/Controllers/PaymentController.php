<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response};
final class PaymentController {
    /** Payment records + totals per method (cash vs online card vs terminal...). */
    public function index(Request $r): void {
        $from = $r->query['from'] ?? date('Y-m-d'); $to = $r->query['to'] ?? date('Y-m-d');
        $base = ' FROM payments p JOIN orders o ON o.id=p.order_id LEFT JOIN users u ON u.id=p.received_by WHERE DATE(p.created_at) BETWEEN ? AND ?'; $p = [$from, $to];
        $summary = Db::all('SELECT p.method, COUNT(*) AS payments, COALESCE(SUM(p.amount),0) AS total' . $base . ' GROUP BY p.method ORDER BY total DESC', $p);
        $w = ''; $q = $p;
        if (!empty($r->query['method'])) { $w .= ' AND p.method=?'; $q[] = $r->query['method']; }
        if (!empty($r->query['q'])) { $w .= ' AND o.order_number LIKE ?'; $q[] = '%' . $r->query['q'] . '%'; }
        $page = $r->int('page', 1, 1, 100000); $per = $r->int('per_page', 25, 1, 100);
        $total = (int)Db::val('SELECT COUNT(*)' . $base . $w, $q);
        $rows = Db::all("SELECT p.id,p.created_at,p.method,p.amount,p.reference,o.order_number,o.currency,o.source,COALESCE(u.name,'Online') AS received_by" . $base . $w . " ORDER BY p.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $q);
        $refunds = (float)Db::val('SELECT COALESCE(SUM(amount),0) FROM refunds WHERE DATE(created_at) BETWEEN ? AND ?', $p);
        Response::json($rows, 'OK', 200, ['page' => $page, 'per_page' => $per, 'total' => $total, 'summary' => $summary, 'refunds' => $refunds]);
    }
}
