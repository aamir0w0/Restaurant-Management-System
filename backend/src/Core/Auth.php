<?php
namespace App\Core;
final class Auth {
    private static ?array $user = null;
    private static array $perms = [];
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        session_name('RMSSESSID');
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
        ini_set('session.use_strict_mode', '1');
        session_start();
        $max = (int)Env::get('SESSION_LIFETIME_MINUTES', '120') * 60;
        if (isset($_SESSION['last']) && time() - $_SESSION['last'] > $max) { $_SESSION = []; session_regenerate_id(true); }
        $_SESSION['last'] = time();
    }
    public static function login(int $uid): void {
        session_regenerate_id(true);
        $_SESSION['uid'] = $uid;
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        self::$user = null;
    }
    public static function logout(): void {
        $_SESSION = [];
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
        session_destroy(); self::$user = null;
    }
    public static function csrf(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
    public static function user(): ?array {
        if (self::$user) return self::$user;
        $uid = $_SESSION['uid'] ?? null;
        if (!$uid) return null;
        $u = Db::one('SELECT u.id,u.name,u.email,u.is_active,r.name AS role,r.label AS role_label FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?', [$uid]);
        if (!$u || !$u['is_active']) { unset($_SESSION['uid']); return null; }
        self::$perms = $u['role'] === 'super_admin'
            ? array_column(Db::all('SELECT code FROM permissions'), 'code')
            : array_column(Db::all('SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id JOIN users u ON u.role_id=rp.role_id WHERE u.id=?', [$uid]), 'code');
        return self::$user = $u;
    }
    public static function permissions(): array { self::user(); return self::$perms; }
    public static function can(string $code): bool { return self::user() !== null && in_array($code, self::$perms, true); }
    public static function id(): int { return (int)(self::user()['id'] ?? 0); }
    public static function require(?string $perm = null): void {
        if (!self::user()) throw new HttpException(401, 'Authentication required');
        if ($perm && !self::can($perm)) throw new HttpException(403, 'You do not have permission to perform this action');
    }
}
