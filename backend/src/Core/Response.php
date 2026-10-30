<?php
namespace App\Core;
final class Response {
    public static function json(mixed $data = null, string $message = 'OK', int $status = 200, ?array $meta = null): never {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        $out = ['success' => $status < 400, 'message' => $message, 'data' => $data];
        if ($meta) $out['meta'] = $meta;
        echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        exit;
    }
    public static function error(string $message, int $status = 400, array $errors = []): never {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => false, 'message' => $message, 'errors' => (object)$errors], JSON_UNESCAPED_UNICODE);
        exit;
    }
    public static function csv(string $filename, array $rows): never {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . preg_replace('/[^a-z0-9_.-]/i', '_', $filename) . '"');
        $f = fopen('php://output', 'w');
        if ($rows) {
            fputcsv($f, array_keys($rows[0]));
            foreach ($rows as $r) fputcsv($f, array_map(fn($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v, $r));
        }
        fclose($f); exit;
    }
}
