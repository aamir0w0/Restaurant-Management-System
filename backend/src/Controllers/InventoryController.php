<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Validator};
use App\Services\InventoryService;
final class InventoryController {
    private const RULES = ['name' => ['type' => 'string', 'required' => true, 'max' => 120], 'unit' => ['type' => 'string', 'required' => true, 'max' => 20], 'cost_per_unit' => ['type' => 'decimal', 'default' => 0, 'scale' => 4], 'min_stock' => ['type' => 'decimal', 'default' => 0, 'scale' => 4]];
    public function ingredients(Request $r): void {
        $rows = Db::all('SELECT i.*, (i.quantity_on_hand<=i.min_stock) AS is_low, ROUND(i.quantity_on_hand*i.cost_per_unit,2) AS stock_value FROM ingredients i WHERE i.is_active=1' . (!empty($r->query['q']) ? ' AND i.name LIKE ?' : '') . ' ORDER BY i.name', !empty($r->query['q']) ? ['%' . $r->query['q'] . '%'] : []);
        Response::json(['items' => $rows, 'total_value' => round(array_sum(array_column($rows, 'stock_value')), 2), 'low_count' => count(array_filter($rows, fn($x) => $x['is_low']))]);
    }
    public function create(Request $r): void {
        $d = Validator::clean(self::RULES, $r->body);
        if (Db::val('SELECT COUNT(*) FROM ingredients WHERE name=?', [$d['name']])) throw new HttpException(422, 'Validation failed', ['name' => 'Already exists']);
        $open = is_numeric($r->body['opening_quantity'] ?? null) ? round((float)$r->body['opening_quantity'], 4) : 0;
        $id = Db::tx(function () use ($d, $open) {
            $id = Db::insert('INSERT INTO ingredients (name,unit,cost_per_unit,min_stock) VALUES (?,?,?,?)', array_values($d));
            if ($open > 0) InventoryService::move($id, 'opening', $open, 'Opening balance');
            return $id;
        });
        Audit::log('ingredient_created', 'ingredient', $id, $d['name']);
        Response::json(['id' => $id], 'Created', 201);
    }
    public function update(Request $r): void {
        $d = Validator::clean(self::RULES, $r->body, true);
        if (!$d) throw new HttpException(422, 'Nothing to update');
        Db::run('UPDATE ingredients SET ' . implode(',', array_map(fn($c) => "$c=?", array_keys($d))) . ' WHERE id=?', [...array_values($d), $r->params['id']]);
        Audit::log('ingredient_updated', 'ingredient', $r->params['id'], json_encode($d));
        Response::json(null, 'Updated');
    }
    public function adjust(Request $r): void { InventoryService::adjust($r->body); Response::json(null, 'Stock updated', 201); }
    public function movements(Request $r): void {
        $w = []; $p = [];
        if (!empty($r->query['ingredient_id'])) { $w[] = 'm.ingredient_id=?'; $p[] = $r->query['ingredient_id']; }
        $per = $r->int('per_page', 50, 1, 200); $page = $r->int('page', 1, 1, 100000);
        Response::json(Db::all('SELECT m.*, i.name AS ingredient, i.unit, u.name AS user_name FROM stock_movements m JOIN ingredients i ON i.id=m.ingredient_id LEFT JOIN users u ON u.id=m.created_by' . ($w ? ' WHERE ' . implode(' AND ', $w) : '') . " ORDER BY m.id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $p));
    }
    public function recipe(Request $r): void {
        $rows = Db::all('SELECT r.ingredient_id,r.quantity,i.name,i.unit,i.cost_per_unit FROM recipe_items r JOIN ingredients i ON i.id=r.ingredient_id WHERE r.menu_item_id=?', [$r->params['id']]);
        $cost = 0; foreach ($rows as $x) $cost += $x['quantity'] * $x['cost_per_unit'];
        Response::json(['items' => $rows, 'estimated_cost' => round($cost, 2)]);
    }
    public function saveRecipe(Request $r): void {
        $id = (int)$r->params['id'];
        if (!Db::val('SELECT COUNT(*) FROM menu_items WHERE id=?', [$id])) throw new HttpException(404, 'Menu item not found');
        $items = $r->body['items'] ?? null;
        if (!is_array($items)) throw new HttpException(422, 'items must be an array');
        Db::tx(function () use ($id, $items) {
            Db::run('DELETE FROM recipe_items WHERE menu_item_id=?', [$id]);
            foreach ($items as $i) {
                if (!is_numeric($i['quantity'] ?? null) || (float)$i['quantity'] <= 0) throw new HttpException(422, 'Validation failed', ['quantity' => 'Must be greater than 0']);
                if (!Db::val('SELECT COUNT(*) FROM ingredients WHERE id=?', [(int)$i['ingredient_id']])) throw new HttpException(422, 'Validation failed', ['ingredient_id' => 'Unknown ingredient']);
                Db::run('INSERT INTO recipe_items (menu_item_id,ingredient_id,quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)', [$id, (int)$i['ingredient_id'], round((float)$i['quantity'], 4)]);
            }
        });
        Audit::log('recipe_updated', 'menu_item', $id, count($items) . ' ingredients');
        Response::json(null, 'Recipe saved');
    }
}
