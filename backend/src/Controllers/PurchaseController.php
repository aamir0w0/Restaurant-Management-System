<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Auth};
use App\Services\InventoryService;
final class PurchaseController {
    public function index(Request $r): void {
        Response::json(Db::all('SELECT p.id,p.po_number,p.status,p.total,p.created_at,s.name AS supplier FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id ORDER BY p.id DESC LIMIT 200'));
    }
    public function show(Request $r): void {
        $p = Db::one('SELECT p.*, s.name AS supplier FROM purchase_orders p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?', [$r->params['id']]);
        if (!$p) throw new HttpException(404, 'Not found');
        $p['items'] = Db::all('SELECT i.*, g.name AS ingredient, g.unit FROM purchase_order_items i JOIN ingredients g ON g.id=i.ingredient_id WHERE i.po_id=?', [$p['id']]);
        Response::json($p);
    }
    public function store(Request $r): void {
        $sup = (int)($r->body['supplier_id'] ?? 0); $lines = $r->body['items'] ?? null;
        if (!Db::val('SELECT COUNT(*) FROM suppliers WHERE id=? AND is_active=1', [$sup])) throw new HttpException(422, 'Validation failed', ['supplier_id' => 'Choose a supplier']);
        if (!is_array($lines) || !$lines) throw new HttpException(422, 'Validation failed', ['items' => 'Add at least one line']);
        $merged = [];
        foreach ($lines as $l) {
            $ing = (int)($l['ingredient_id'] ?? 0); $q = round((float)($l['quantity'] ?? 0), 4); $c = round((float)($l['unit_cost'] ?? -1), 4);
            if (!Db::val('SELECT COUNT(*) FROM ingredients WHERE id=? AND is_active=1', [$ing]) || $q <= 0 || $c < 0) throw new HttpException(422, 'Validation failed', ['items' => 'Each line needs an ingredient, quantity > 0 and a cost']);
            if (isset($merged[$ing])) { $merged[$ing]['q'] += $q; $merged[$ing]['c'] = $c; } else $merged[$ing] = ['q' => $q, 'c' => $c];
        }
        $id = Db::tx(function () use ($sup, $merged, $r) {
            $total = 0; foreach ($merged as $m) $total += round($m['q'] * $m['c'], 2);
            $id = Db::insert('INSERT INTO purchase_orders (po_number,supplier_id,notes,total,created_by) VALUES (?,?,?,?,?)', ['PO-' . date('ymd') . '-' . strtoupper(bin2hex(random_bytes(2))), $sup, mb_substr((string)($r->body['notes'] ?? ''), 0, 500) ?: null, round($total, 2), Auth::id()]);
            foreach ($merged as $ing => $m) Db::run('INSERT INTO purchase_order_items (po_id,ingredient_id,quantity_ordered,unit_cost) VALUES (?,?,?,?)', [$id, $ing, $m['q'], $m['c']]);
            return $id;
        });
        Audit::log('po_created', 'purchase_order', $id);
        Response::json(['id' => $id], 'Purchase order created', 201);
    }
    public function approve(Request $r): void {
        $id = (int)$r->params['id'];
        $n = Db::run("UPDATE purchase_orders SET status='approved', approved_by=? WHERE id=? AND status='draft'", [Auth::id(), $id]);
        if (!$n) throw new HttpException(409, 'Only draft purchase orders can be approved');
        Audit::log('po_approved', 'purchase_order', $id); Audit::notify('purchase', 'Purchase order approved: ' . Db::val('SELECT po_number FROM purchase_orders WHERE id=?', [$id]));
        Response::json(null, 'Approved');
    }
    public function cancel(Request $r): void {
        $id = (int)$r->params['id'];
        $n = Db::run("UPDATE purchase_orders SET status='cancelled' WHERE id=? AND status IN ('draft','approved')", [$id]);
        if (!$n) throw new HttpException(409, 'This purchase order can no longer be cancelled');
        Audit::log('po_cancelled', 'purchase_order', $id); Response::json(null, 'Cancelled');
    }
    /** Body: {note?, items:[{po_item_id, accepted, rejected}]}. Stock rises exactly once per receipt (ledger unique key). */
    public function receive(Request $r): void {
        $id = (int)$r->params['id']; $lines = $r->body['items'] ?? null;
        if (!is_array($lines) || !$lines) throw new HttpException(422, 'Validation failed', ['items' => 'Nothing to receive']);
        Db::tx(function () use ($id, $lines, $r) {
            $po = Db::one('SELECT * FROM purchase_orders WHERE id=? FOR UPDATE', [$id]);
            if (!$po) throw new HttpException(404, 'Not found');
            if (!in_array($po['status'], ['approved', 'partially_received'], true)) throw new HttpException(409, 'Only approved purchase orders can be received');
            $rid = Db::insert('INSERT INTO goods_receipts (po_id,received_by,note) VALUES (?,?,?)', [$id, Auth::id(), mb_substr((string)($r->body['note'] ?? ''), 0, 255) ?: null]);
            $any = false;
            foreach ($lines as $l) {
                $acc = round((float)($l['accepted'] ?? 0), 4); $rej = round((float)($l['rejected'] ?? 0), 4);
                if ($acc < 0 || $rej < 0 || ($acc == 0 && $rej == 0)) continue;
                $it = Db::one('SELECT * FROM purchase_order_items WHERE id=? AND po_id=? FOR UPDATE', [(int)($l['po_item_id'] ?? 0), $id]);
                if (!$it) throw new HttpException(422, 'Validation failed', ['items' => 'Unknown line']);
                if ($acc + $rej + (float)$it['quantity_received'] + (float)$it['quantity_rejected'] > (float)$it['quantity_ordered'] + 0.00005) throw new HttpException(422, 'Validation failed', ['items' => 'Receiving more than was ordered']);
                Db::run('INSERT INTO goods_receipt_items (receipt_id,po_item_id,qty_accepted,qty_rejected,unit_cost) VALUES (?,?,?,?,?)', [$rid, $it['id'], $acc, $rej, $it['unit_cost']]);
                Db::run('UPDATE purchase_order_items SET quantity_received=quantity_received+?, quantity_rejected=quantity_rejected+? WHERE id=?', [$acc, $rej, $it['id']]);
                if ($acc > 0) { InventoryService::move((int)$it['ingredient_id'], 'purchase', $acc, "{$po['po_number']} receipt #$rid", 'receipt', $rid); Db::run('UPDATE ingredients SET cost_per_unit=? WHERE id=?', [$it['unit_cost'], $it['ingredient_id']]); }
                $any = true;
            }
            if (!$any) throw new HttpException(422, 'Validation failed', ['items' => 'Enter a quantity to receive']);
            $open = (int)Db::val('SELECT COUNT(*) FROM purchase_order_items WHERE po_id=? AND quantity_received+quantity_rejected < quantity_ordered - 0.00005', [$id]);
            Db::run('UPDATE purchase_orders SET status=? WHERE id=?', [$open ? 'partially_received' : 'received', $id]);
            Audit::log('goods_received', 'purchase_order', $id, "receipt #$rid");
        });
        Response::json(null, 'Goods received', 201);
    }
}
