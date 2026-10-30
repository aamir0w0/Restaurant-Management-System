<?php
namespace App\Core;
final class Audit {
    public static function log(string $action, ?string $entity = null, $entityId = null, ?string $summary = null, ?int $userId = null): void {
        try {
            Db::run('INSERT INTO audit_logs (user_id,action,entity,entity_id,summary,ip) VALUES (?,?,?,?,?,?)',
                [$userId ?? (Auth::id() ?: null), $action, $entity, $entityId === null ? null : (string)$entityId, $summary ? mb_substr($summary, 0, 500) : null, $_SERVER['REMOTE_ADDR'] ?? null]);
        } catch (\Throwable $e) { error_log('audit failed: ' . $e->getMessage()); }
    }
    public static function notify(string $type, string $msg, ?string $dedupe = null): void {
        Db::run('INSERT IGNORE INTO notifications (type,message,dedupe_key) VALUES (?,?,?)', [$type, $msg, $dedupe]);
    }
}
