<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Auth, Validator};
final class UserController {
    public function index(Request $r): void {
        Response::json(Db::all('SELECT u.id,u.name,u.email,u.is_active,u.last_login_at,u.role_id,r.label AS role FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.name'));
    }
    private function guardRole(int $roleId): void {
        $name = Db::val('SELECT name FROM roles WHERE id=?', [$roleId]);
        if (!$name) throw new HttpException(422, 'Validation failed', ['role_id' => 'Unknown role']);
        if ($name === 'super_admin' && Auth::user()['role'] !== 'super_admin') throw new HttpException(403, 'Only a Super Admin can assign that role');
    }
    public function store(Request $r): void {
        $d = Validator::clean(['name' => ['type' => 'string', 'required' => true, 'max' => 120], 'email' => ['type' => 'email', 'required' => true], 'role_id' => ['type' => 'int', 'required' => true, 'min' => 1], 'password' => ['type' => 'string', 'required' => true, 'max' => 200]], $r->body);
        if (mb_strlen($d['password']) < 10) throw new HttpException(422, 'Validation failed', ['password' => 'Minimum 10 characters']);
        $this->guardRole($d['role_id']);
        if (Db::val('SELECT COUNT(*) FROM users WHERE email=?', [$d['email']])) throw new HttpException(422, 'Validation failed', ['email' => 'Already exists']);
        $id = Db::insert('INSERT INTO users (name,email,password_hash,role_id) VALUES (?,?,?,?)', [$d['name'], $d['email'], password_hash($d['password'], PASSWORD_DEFAULT), $d['role_id']]);
        Audit::log('user_created', 'user', $id, $d['email'] . ' role ' . $d['role_id']);
        Response::json(['id' => $id], 'User created', 201);
    }
    public function update(Request $r): void {
        $id = (int)$r->params['id'];
        $d = Validator::clean(['name' => ['type' => 'string', 'max' => 120], 'role_id' => ['type' => 'int', 'min' => 1], 'is_active' => ['type' => 'bool'], 'password' => ['type' => 'string', 'max' => 200]], $r->body, true);
        if (!Db::one('SELECT id FROM users WHERE id=?', [$id])) throw new HttpException(404, 'User not found');
        if ($id === Auth::id() && (isset($d['is_active']) && !$d['is_active'])) throw new HttpException(422, 'You cannot deactivate your own account');
        if (isset($d['role_id'])) $this->guardRole($d['role_id']);
        $sets = []; $p = [];
        foreach (['name', 'role_id', 'is_active'] as $c) if (array_key_exists($c, $d)) { $sets[] = "$c=?"; $p[] = $d[$c]; }
        if (!empty($d['password'])) { if (mb_strlen($d['password']) < 10) throw new HttpException(422, 'Validation failed', ['password' => 'Minimum 10 characters']); $sets[] = 'password_hash=?'; $p[] = password_hash($d['password'], PASSWORD_DEFAULT); }
        if (!$sets) throw new HttpException(422, 'Nothing to update');
        Db::run('UPDATE users SET ' . implode(',', $sets) . ' WHERE id=?', [...$p, $id]);
        Audit::log('user_updated', 'user', $id, implode(',', array_keys($d)) . (isset($d['password']) ? ' (password reset)' : ''));
        Response::json(null, 'User updated');
    }
    public function roles(Request $r): void {
        $roles = Db::all('SELECT id,name,label FROM roles ORDER BY id');
        foreach ($roles as &$ro) $ro['permissions'] = array_column(Db::all('SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=?', [$ro['id']]), 'code');
        Response::json(['roles' => $roles, 'permissions' => Db::all('SELECT code,label FROM permissions ORDER BY code')]);
    }
    public function setPermissions(Request $r): void {
        $id = (int)$r->params['id'];
        $role = Db::one('SELECT name FROM roles WHERE id=?', [$id]);
        if (!$role) throw new HttpException(404, 'Role not found');
        if ($role['name'] === 'super_admin') throw new HttpException(422, 'Super Admin permissions are fixed');
        $codes = $r->body['permissions'] ?? null;
        if (!is_array($codes)) throw new HttpException(422, 'permissions must be an array');
        Db::tx(function () use ($id, $codes) {
            Db::run('DELETE FROM role_permissions WHERE role_id=?', [$id]);
            foreach (array_unique($codes) as $c) Db::run('INSERT INTO role_permissions (role_id,permission_id) SELECT ?,id FROM permissions WHERE code=?', [$id, $c]);
        });
        Audit::log('role_permissions_changed', 'role', $id, implode(',', $codes));
        Response::json(null, 'Permissions updated');
    }
}
