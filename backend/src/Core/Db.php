<?php
namespace App\Core;
use PDO;
final class Db {
    private static ?PDO $pdo = null;
    public static function pdo(): PDO {
        if (!self::$pdo) {
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', Env::get('DB_HOST', '127.0.0.1'), Env::get('DB_PORT', '3306'), Env::get('DB_NAME', 'restaurant_management_system'));
            self::$pdo = new PDO($dsn, Env::get('DB_USER', 'root'), Env::get('DB_PASS', ''), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            $off = (new \DateTime('now', new \DateTimeZone(date_default_timezone_get())))->format('P');
            self::$pdo->exec("SET time_zone = '$off'");
        }
        return self::$pdo;
    }
    public static function all(string $sql, array $p = []): array { $s = self::pdo()->prepare($sql); $s->execute($p); return $s->fetchAll(); }
    public static function one(string $sql, array $p = []): ?array { $s = self::pdo()->prepare($sql); $s->execute($p); $r = $s->fetch(); return $r ?: null; }
    public static function val(string $sql, array $p = []) { $s = self::pdo()->prepare($sql); $s->execute($p); return $s->fetchColumn(); }
    public static function run(string $sql, array $p = []): int { $s = self::pdo()->prepare($sql); $s->execute($p); return $s->rowCount(); }
    public static function insert(string $sql, array $p = []): int { self::run($sql, $p); return (int)self::pdo()->lastInsertId(); }
    public static function tx(callable $fn) {
        $pdo = self::pdo();
        if ($pdo->inTransaction()) return $fn();
        $pdo->beginTransaction();
        try { $r = $fn(); $pdo->commit(); return $r; }
        catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    }
}
