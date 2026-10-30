<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException, Audit, Auth, Validator};
final class AuthController {
    private function payload(): array { return ['user' => Auth::user(), 'permissions' => Auth::permissions(), 'csrf_token' => Auth::csrf()]; }
    public function login(Request $r): void {
        $d = Validator::clean(['email' => ['type' => 'email', 'required' => true], 'password' => ['type' => 'string', 'required' => true, 'max' => 200]], $r->body);
        $fails = (int)Db::val('SELECT COUNT(*) FROM login_attempts WHERE email=? AND ip=? AND attempted_at > (NOW() - INTERVAL 15 MINUTE)', [$d['email'], $r->ip()]);
        if ($fails >= 5) { Audit::log('login_blocked', 'user', null, $d['email']); throw new HttpException(429, 'Too many failed attempts. Try again in 15 minutes.'); }
        $u = Db::one('SELECT id,password_hash,is_active FROM users WHERE email=?', [$d['email']]);
        $ok = $u && password_verify($d['password'], $u['password_hash']);
        if (!$u) password_verify($d['password'], '$2y$10$usesomesillystringforsaltuQ0v9mB4h5w3m8b0Yx1zZ3p2y1y1y1y1y1y1y'); // timing equalisation
        if (!$ok || !$u['is_active']) {
            Db::run('INSERT INTO login_attempts (email,ip) VALUES (?,?)', [$d['email'], $r->ip()]);
            Audit::log('login_failed', 'user', $u['id'] ?? null, $d['email']);
            throw new HttpException(401, 'Invalid credentials');
        }
        Db::run('DELETE FROM login_attempts WHERE email=? AND ip=?', [$d['email'], $r->ip()]);
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) Db::run('UPDATE users SET password_hash=? WHERE id=?', [password_hash($d['password'], PASSWORD_DEFAULT), $u['id']]);
        Auth::login((int)$u['id']);
        Db::run('UPDATE users SET last_login_at=NOW() WHERE id=?', [$u['id']]);
        Audit::log('login', 'user', $u['id'], null, (int)$u['id']);
        Response::json($this->payload(), 'Logged in');
    }
    public function logout(Request $r): void { Audit::log('logout'); Auth::logout(); Response::json(null, 'Logged out'); }
    public function me(Request $r): void { Response::json($this->payload()); }
    public function changePassword(Request $r): void {
        $d = Validator::clean(['current_password' => ['type' => 'string', 'required' => true, 'max' => 200], 'new_password' => ['type' => 'string', 'required' => true, 'max' => 200]], $r->body);
        if (mb_strlen($d['new_password']) < 10) throw new HttpException(422, 'Validation failed', ['new_password' => 'Minimum 10 characters']);
        $h = Db::val('SELECT password_hash FROM users WHERE id=?', [Auth::id()]);
        if (!password_verify($d['current_password'], $h)) throw new HttpException(422, 'Validation failed', ['current_password' => 'Incorrect password']);
        Db::run('UPDATE users SET password_hash=? WHERE id=?', [password_hash($d['new_password'], PASSWORD_DEFAULT), Auth::id()]);
        Audit::log('password_changed', 'user', Auth::id());
        Response::json(null, 'Password changed');
    }
}
