<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Validator};
/** Generic, config-driven CRUD with soft archive (is_active=0). */
final class Crud {
    public function __construct(private string $table, private array $rules, private array $search, private array $perm, private array $opt = []) {}
    private function sel(): string { return $this->opt['select'] ?? "t.*"; }
    public function index(Request $r): void {
        $page = $r->int('page', 1, 1, 100000); $per = $r->int('per_page', 20, 1, 200);
        $w = []; $p = [];
        if (empty($r->query['include_inactive'])) $w[] = 't.is_active=1';
        if (!empty($r->query['q']) && $this->search) {
            $w[] = '(' . implode(' OR ', array_map(fn($c) => "t.$c LIKE ?", $this->search)) . ')';
            foreach ($this->search as $_) $p[] = '%' . $r->query['q'] . '%';
        }
        foreach ($this->opt['filters'] ?? [] as $f) if (isset($r->query[$f]) && $r->query[$f] !== '') { $w[] = "t.$f=?"; $p[] = $r->query[$f]; }
        foreach ($this->opt['range'] ?? [] as $f) {
            if (!empty($r->query['from'])) { $w[] = "t.$f>=?"; $p[] = $r->query['from']; }
            if (!empty($r->query['to'])) { $w[] = "t.$f<=?"; $p[] = $r->query['to']; }
        }
        $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
        $sortable = array_merge(array_keys($this->rules), ['id']);
        $sort = in_array($r->query['sort'] ?? '', $sortable, true) ? $r->query['sort'] : ($this->opt['sort'] ?? 'id');
        $dir = strtolower($r->query['dir'] ?? '') === 'desc' ? 'DESC' : 'ASC';
        $total = (int)Db::val("SELECT COUNT(*) FROM {$this->table} t $where", $p);
        $rows = Db::all("SELECT {$this->sel()} FROM {$this->table} t $where ORDER BY t.$sort $dir LIMIT $per OFFSET " . (($page - 1) * $per), $p);
        Response::json($rows, 'OK', 200, ['page' => $page, 'per_page' => $per, 'total' => $total]);
    }
    public function show(Request $r): void {
        $row = Db::one("SELECT {$this->sel()} FROM {$this->table} t WHERE t.id=?", [$r->params['id']]);
        if (!$row) throw new HttpException(404, 'Not found');
        Response::json($row);
    }
    public function store(Request $r): void {
        $d = Validator::clean($this->rules, $r->body);
        $this->unique($d, null);
        $cols = array_keys($d);
        if (isset($this->opt['stamp_user'])) { $cols[] = $this->opt['stamp_user']; $d[$this->opt['stamp_user']] = \App\Core\Auth::id(); }
        $id = Db::insert("INSERT INTO {$this->table} (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($d));
        Audit::log('create', $this->table, $id, json_encode($d));
        Response::json(Db::one("SELECT * FROM {$this->table} WHERE id=?", [$id]), 'Created', 201);
    }
    public function update(Request $r): void {
        $id = (int)$r->params['id'];
        if (!Db::one("SELECT id FROM {$this->table} WHERE id=?", [$id])) throw new HttpException(404, 'Not found');
        $d = Validator::clean($this->rules, $r->body, true);
        if (!$d) throw new HttpException(422, 'Nothing to update');
        $this->unique($d, $id);
        Db::run("UPDATE {$this->table} SET " . implode(',', array_map(fn($c) => "$c=?", array_keys($d))) . ' WHERE id=?', [...array_values($d), $id]);
        Audit::log('update', $this->table, $id, json_encode($d));
        Response::json(Db::one("SELECT * FROM {$this->table} WHERE id=?", [$id]), 'Updated');
    }
    public function destroy(Request $r): void {
        $n = Db::run("UPDATE {$this->table} SET is_active=0 WHERE id=?", [$r->params['id']]);
        if (!$n) throw new HttpException(404, 'Not found or already archived');
        Audit::log('archive', $this->table, $r->params['id']);
        Response::json(null, 'Archived');
    }
    private function unique(array $d, ?int $id): void {
        foreach ($this->opt['unique'] ?? [] as $col) {
            if (!isset($d[$col])) continue;
            if (Db::val("SELECT COUNT(*) FROM {$this->table} WHERE $col=? AND id<>?", [$d[$col], $id ?? 0])) throw new HttpException(422, 'Validation failed', [$col => 'Already exists']);
        }
    }
    public static function register(\App\Core\Router $rt, string $path, Crud $c, array $perm): void {
        $rt->get($path, [$c, 'index'], $perm['view']); $rt->get("$path/{id}", [$c, 'show'], $perm['view']);
        $rt->post($path, [$c, 'store'], $perm['manage']); $rt->put("$path/{id}", [$c, 'update'], $perm['manage']);
        $rt->delete("$path/{id}", [$c, 'destroy'], $perm['manage']);
    }
}
