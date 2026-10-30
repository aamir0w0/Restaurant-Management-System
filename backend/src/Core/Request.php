<?php
namespace App\Core;
final class Request {
    public array $params = []; public string $raw = '';
    public function __construct(public string $method, public string $path, public array $query, public array $body) {}
    public static function capture(): self {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $pos = strpos($uri, '/api/v1');
        $path = $pos === false ? $uri : (substr($uri, $pos + 7) ?: '/');
        $body = [];
        $raw = file_get_contents('php://input');
        if ($raw !== '' && str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'json')) {
            $body = json_decode($raw, true);
            if (!is_array($body)) throw new HttpException(400, 'Invalid JSON body');
        } elseif ($_POST) { $body = $_POST; }
        $req = new self(strtoupper($_SERVER['REQUEST_METHOD']), rtrim($path, '/') ?: '/', $_GET, $body); $req->raw = (string)$raw; return $req;
    }
    public function header(string $n): ?string { return $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $n))] ?? null; }
    public function ip(): string { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }
    public function int(string $k, int $d, int $min = 1, int $max = 1000): int { return max($min, min($max, (int)($this->query[$k] ?? $d))); }
}
