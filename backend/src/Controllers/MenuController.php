<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Auth, Validator};
final class MenuController {
    private const RULES = ['category_id' => ['type' => 'int', 'required' => true, 'min' => 1], 'name' => ['type' => 'string', 'required' => true, 'max' => 150], 'description' => ['type' => 'string', 'max' => 2000],
        'base_price' => ['type' => 'decimal', 'required' => true, 'min' => 0], 'prep_minutes' => ['type' => 'int', 'default' => 10, 'min' => 1], 'is_available' => ['type' => 'bool', 'default' => 1], 'is_active' => ['type' => 'bool', 'default' => 1]];
    public function hydrate(array $items): array {
        foreach ($items as &$i) {
            $i['variants'] = Db::all('SELECT id,name,price_delta FROM menu_item_variants WHERE menu_item_id=? AND is_active=1', [$i['id']]);
            $groups = Db::all('SELECT g.id,g.name,g.min_select,g.max_select FROM modifier_groups g JOIN menu_item_modifier_groups l ON l.group_id=g.id WHERE l.menu_item_id=? AND g.is_active=1', [$i['id']]);
            foreach ($groups as &$g) $g['modifiers'] = Db::all('SELECT id,name,price FROM modifiers WHERE group_id=? AND is_active=1', [$g['id']]);
            $i['modifier_groups'] = $groups;
        }
        return $items;
    }
    public function index(Request $r): void {
        $w = []; $p = [];
        if (empty($r->query['include_inactive'])) $w[] = 'm.is_active=1';
        if (!empty($r->query['category_id'])) { $w[] = 'm.category_id=?'; $p[] = $r->query['category_id']; }
        if (!empty($r->query['q'])) { $w[] = 'm.name LIKE ?'; $p[] = '%' . $r->query['q'] . '%'; }
        $page = $r->int('page', 1, 1, 100000); $per = $r->int('per_page', 100, 1, 200);
        $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
        $total = (int)Db::val("SELECT COUNT(*) FROM menu_items m $where", $p);
        $rows = Db::all("SELECT m.*, c.name AS category_name FROM menu_items m JOIN categories c ON c.id=m.category_id $where ORDER BY c.sort_order, m.name LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        Response::json($this->hydrate($rows), 'OK', 200, ['page' => $page, 'per_page' => $per, 'total' => $total]);
    }
    public function show(Request $r): void {
        $row = Db::one('SELECT m.*, c.name AS category_name FROM menu_items m JOIN categories c ON c.id=m.category_id WHERE m.id=?', [$r->params['id']]);
        if (!$row) throw new HttpException(404, 'Not found');
        Response::json($this->hydrate([$row])[0]);
    }
    public function store(Request $r): void {
        $d = Validator::clean(self::RULES, $r->body);
        $id = Db::tx(function () use ($d, $r) {
            $id = Db::insert('INSERT INTO menu_items (category_id,name,description,base_price,prep_minutes,is_available,is_active) VALUES (?,?,?,?,?,?,?)', array_values($d));
            $this->syncChildren($id, $r->body);
            return $id;
        });
        Audit::log('menu_item_created', 'menu_item', $id, $d['name'] . ' @ ' . $d['base_price']);
        Response::json($this->hydrate([Db::one('SELECT * FROM menu_items WHERE id=?', [$id])])[0], 'Created', 201);
    }
    public function update(Request $r): void {
        $id = (int)$r->params['id'];
        $old = Db::one('SELECT * FROM menu_items WHERE id=?', [$id]);
        if (!$old) throw new HttpException(404, 'Not found');
        $d = Validator::clean(self::RULES, $r->body, true);
        if (isset($d['base_price']) && (float)$d['base_price'] !== (float)$old['base_price'] && !Auth::can('menu.price')) throw new HttpException(403, 'You are not allowed to change prices');
        Db::tx(function () use ($d, $id, $r) {
            if ($d) Db::run('UPDATE menu_items SET ' . implode(',', array_map(fn($c) => "$c=?", array_keys($d))) . ' WHERE id=?', [...array_values($d), $id]);
            if (isset($r->body['variants']) || isset($r->body['modifier_group_ids'])) $this->syncChildren($id, $r->body);
        });
        if (isset($d['base_price']) && (float)$d['base_price'] !== (float)$old['base_price']) { Audit::log('menu_price_changed', 'menu_item', $id, "{$old['base_price']} -> {$d['base_price']}"); }
        Audit::log('menu_item_updated', 'menu_item', $id, implode(',', array_keys($d)));
        Response::json($this->hydrate([Db::one('SELECT * FROM menu_items WHERE id=?', [$id])])[0], 'Updated');
    }
    public function destroy(Request $r): void {
        if (!Db::run('UPDATE menu_items SET is_active=0 WHERE id=?', [$r->params['id']])) throw new HttpException(404, 'Not found');
        Audit::log('menu_item_archived', 'menu_item', $r->params['id']);
        Response::json(null, 'Archived');
    }
    private function syncChildren(int $id, array $b): void {
        if (isset($b['variants']) && is_array($b['variants'])) {
            $keep = [];
            foreach ($b['variants'] as $v) {
                $name = trim((string)($v['name'] ?? '')); $delta = round((float)($v['price_delta'] ?? 0), 2);
                if ($name === '') continue;
                if (!empty($v['id']) && Db::val('SELECT COUNT(*) FROM menu_item_variants WHERE id=? AND menu_item_id=?', [$v['id'], $id])) { Db::run('UPDATE menu_item_variants SET name=?,price_delta=?,is_active=1 WHERE id=?', [$name, $delta, $v['id']]); $keep[] = (int)$v['id']; }
                else $keep[] = Db::insert('INSERT INTO menu_item_variants (menu_item_id,name,price_delta) VALUES (?,?,?)', [$id, $name, $delta]);
            }
            Db::run('UPDATE menu_item_variants SET is_active=0 WHERE menu_item_id=?' . ($keep ? ' AND id NOT IN (' . implode(',', $keep) . ')' : ''), [$id]);
        }
        if (isset($b['modifier_group_ids']) && is_array($b['modifier_group_ids'])) {
            Db::run('DELETE FROM menu_item_modifier_groups WHERE menu_item_id=?', [$id]);
            foreach (array_unique(array_map('intval', $b['modifier_group_ids'])) as $g) Db::run('INSERT IGNORE INTO menu_item_modifier_groups (menu_item_id,group_id) SELECT ?,id FROM modifier_groups WHERE id=?', [$id, $g]);
        }
    }
    public function groups(Request $r): void {
        $g = Db::all('SELECT * FROM modifier_groups WHERE is_active=1 ORDER BY name');
        foreach ($g as &$x) $x['modifiers'] = Db::all('SELECT id,name,price FROM modifiers WHERE group_id=? AND is_active=1', [$x['id']]);
        Response::json($g);
    }
    public function saveGroup(Request $r): void {
        $id = isset($r->params['id']) ? (int)$r->params['id'] : null;
        $d = Validator::clean(['name' => ['type' => 'string', 'required' => true, 'max' => 100], 'min_select' => ['type' => 'int', 'default' => 0], 'max_select' => ['type' => 'int', 'default' => 5, 'min' => 1]], $r->body);
        $mods = is_array($r->body['modifiers'] ?? null) ? $r->body['modifiers'] : [];
        $id = Db::tx(function () use ($id, $d, $mods) {
            if ($id) Db::run('UPDATE modifier_groups SET name=?,min_select=?,max_select=? WHERE id=?', [$d['name'], $d['min_select'], $d['max_select'], $id]);
            else $id = Db::insert('INSERT INTO modifier_groups (name,min_select,max_select) VALUES (?,?,?)', array_values($d));
            $keep = [];
            foreach ($mods as $m) {
                $n = trim((string)($m['name'] ?? '')); if ($n === '') continue; $pr = round(max(0, (float)($m['price'] ?? 0)), 2);
                if (!empty($m['id']) && Db::val('SELECT COUNT(*) FROM modifiers WHERE id=? AND group_id=?', [$m['id'], $id])) { Db::run('UPDATE modifiers SET name=?,price=?,is_active=1 WHERE id=?', [$n, $pr, $m['id']]); $keep[] = (int)$m['id']; }
                else $keep[] = Db::insert('INSERT INTO modifiers (group_id,name,price) VALUES (?,?,?)', [$id, $n, $pr]);
            }
            Db::run('UPDATE modifiers SET is_active=0 WHERE group_id=?' . ($keep ? ' AND id NOT IN (' . implode(',', $keep) . ')' : ''), [$id]);
            return $id;
        });
        Audit::log('modifier_group_saved', 'modifier_group', $id, $d['name']);
        Response::json(['id' => $id], 'Saved');
    }
    public function image(Request $r): void {
        $id = (int)$r->params['id'];
        if (!Db::one('SELECT id FROM menu_items WHERE id=?', [$id])) throw new HttpException(404, 'Not found');
        $f = $_FILES['image'] ?? null;
        if (!$f || $f['error'] !== UPLOAD_ERR_OK) throw new HttpException(422, 'Upload failed');
        if ($f['size'] > 2 * 1024 * 1024) throw new HttpException(422, 'Image must be under 2 MB');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        if (!$ext) throw new HttpException(422, 'Only JPEG, PNG or WebP images are allowed');
        $name = bin2hex(random_bytes(12)) . '.' . $ext;
        if (!move_uploaded_file($f['tmp_name'], BASE_PATH . '/public/uploads/' . $name)) throw new HttpException(500, 'Could not save image');
        Db::run('UPDATE menu_items SET image_path=? WHERE id=?', ['uploads/' . $name, $id]);
        Audit::log('menu_image_uploaded', 'menu_item', $id);
        Response::json(['image_path' => 'uploads/' . $name], 'Uploaded');
    }
}
