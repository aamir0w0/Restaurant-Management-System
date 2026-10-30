<?php
namespace App\Core;
final class Router {
    private array $routes = [];
    public function add(string $m, string $path, callable $h, ?string $perm = null, bool $public = false): void {
        $re = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $path) . '$#';
        $this->routes[] = [$m, $re, $h, $perm, $public];
    }
    public function get(string $p, callable $h, ?string $perm = null): void { $this->add('GET', $p, $h, $perm); }
    public function post(string $p, callable $h, ?string $perm = null): void { $this->add('POST', $p, $h, $perm); }
    public function put(string $p, callable $h, ?string $perm = null): void { $this->add('PUT', $p, $h, $perm); }
    public function delete(string $p, callable $h, ?string $perm = null): void { $this->add('DELETE', $p, $h, $perm); }
    public function dispatch(Request $req): void {
        $pathMatched = false;
        foreach ($this->routes as [$m, $re, $h, $perm, $public]) {
            if (!preg_match($re, $req->path, $mt)) continue;
            $pathMatched = true;
            if ($m !== $req->method) continue;
            $req->params = array_filter($mt, 'is_string', ARRAY_FILTER_USE_KEY);
            if (!$public) {
                Auth::require();
                if ($req->method !== 'GET' && !hash_equals(Auth::csrf(), $req->header('X-CSRF-Token') ?? '')) throw new HttpException(403, 'Invalid CSRF token');
                Auth::require($perm);
            }
            $h($req);
            return;
        }
        throw new HttpException($pathMatched ? 405 : 404, $pathMatched ? 'Method not allowed' : 'Route not found');
    }
}
