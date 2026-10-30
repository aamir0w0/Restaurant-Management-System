<?php
namespace App\Core;
final class Env {
    private static array $v = [];
    public static function load(string $file): void {
        if (!is_file($file)) return;
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) {
            $l = trim($l);
            if ($l === '' || $l[0] === '#' || !str_contains($l, '=')) continue;
            [$k, $val] = explode('=', $l, 2);
            self::$v[trim($k)] = trim($val, " \t\"'");
        }
    }
    public static function get(string $k, ?string $d = null): ?string { return self::$v[$k] ?? $d; }
    public static function bool(string $k, bool $d = false): bool { return filter_var(self::$v[$k] ?? $d, FILTER_VALIDATE_BOOLEAN); }
}
