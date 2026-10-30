<?php
namespace App\Services;
use App\Core\{Db, HttpException, Audit, Auth};
use App\Controllers\SettingsController;
final class InventoryService {
    /** Records a ledger row and updates the balance. Returns false if the (reference,ingredient,type) row already exists. */
    public static function move(int $ingId, string $type, float $qty, string $reason, ?string $refType = null, ?int $refId = null): bool {
        return Db::tx(function () use ($ingId, $type, $qty, $reason, $refType, $refId) {
            $ing = Db::one('SELECT id,name,quantity_on_hand,min_stock FROM ingredients WHERE id=? FOR UPDATE', [$ingId]);
            if (!$ing) throw new HttpException(404, 'Ingredient not found');
            if ($refType && Db::val('SELECT COUNT(*) FROM stock_movements WHERE reference_type=? AND reference_id=? AND ingredient_id=? AND movement_type=?', [$refType, $refId, $ingId, $type])) return false;
            $after = round((float)$ing['quantity_on_hand'] + $qty, 4);
            if ($after < 0 && ($type !== 'sale') ) throw new HttpException(409, "Insufficient stock for {$ing['name']}");
            if ($after < 0 && (SettingsController::all()['allow_negative_stock'] ?? '1') !== '1') throw new HttpException(409, "Insufficient stock for {$ing['name']}");
            Db::insert('INSERT INTO stock_movements (ingredient_id,movement_type,quantity,balance_after,reason,reference_type,reference_id,created_by) VALUES (?,?,?,?,?,?,?,?)', [$ingId, $type, $qty, $after, mb_substr($reason, 0, 255), $refType, $refId, Auth::id() ?: null]);
            Db::run('UPDATE ingredients SET quantity_on_hand=? WHERE id=?', [$after, $ingId]);
            if ($after <= (float)$ing['min_stock']) Audit::notify('low_stock', "Low stock: {$ing['name']} ({$after})", "lowstock:$ingId");
            else Db::run('UPDATE notifications SET dedupe_key=NULL WHERE dedupe_key=?', ["lowstock:$ingId"]);
            return true;
        });
    }
    /** Deducts recipe ingredients exactly once per order (called when the order enters 'preparing'). */
    public static function deductForOrder(int $orderId): void {
        $o = Db::one('SELECT stock_deducted FROM orders WHERE id=? FOR UPDATE', [$orderId]);
        if (!$o || $o['stock_deducted']) return;
        $rows = Db::all('SELECT r.ingredient_id, SUM(r.quantity*oi.quantity) AS qty FROM order_items oi JOIN recipe_items r ON r.menu_item_id=oi.menu_item_id WHERE oi.order_id=? GROUP BY r.ingredient_id', [$orderId]);
        foreach ($rows as $r) self::move((int)$r['ingredient_id'], 'sale', -(float)$r['qty'], "Order #$orderId", 'order', $orderId);
        Db::run('UPDATE orders SET stock_deducted=1 WHERE id=?', [$orderId]);
    }
    public static function adjust(array $in): void {
        $type = $in['type'] ?? '';
        if (!in_array($type, ['adjustment', 'wastage', 'spoilage', 'return', 'purchase'], true)) throw new HttpException(422, 'Validation failed', ['type' => 'Invalid']);
        if (!is_numeric($in['quantity'] ?? null) || (float)$in['quantity'] == 0.0) throw new HttpException(422, 'Validation failed', ['quantity' => 'Non-zero number required']);
        $reason = trim((string)($in['reason'] ?? ''));
        if ($reason === '') throw new HttpException(422, 'Validation failed', ['reason' => 'Required']);
        $q = round((float)$in['quantity'], 4);
        $signed = in_array($type, ['wastage', 'spoilage', 'return'], true) ? -abs($q) : ($type === 'purchase' ? abs($q) : $q);
        self::move((int)($in['ingredient_id'] ?? 0), $type, $signed, $reason);
        Audit::log('stock_adjusted', 'ingredient', $in['ingredient_id'] ?? null, "$type $signed: $reason");
    }
}
