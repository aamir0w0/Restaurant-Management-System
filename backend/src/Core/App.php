<?php
namespace App\Core;
final class App {
    public static function run(): void {
        $debug = Env::bool('APP_DEBUG');
        $origins = array_map('trim', explode(',', Env::get('CORS_ORIGINS', '')));
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin && in_array($origin, $origins, true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
            header('Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS');
            header('Vary: Origin');
        }
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
        header('X-Content-Type-Options: nosniff');
        try {
            Auth::startSession();
            $router = new Router();
            \App\Routes\Api::register($router);
            $router->dispatch(Request::capture());
        } catch (HttpException $e) {
            Response::error($e->getMessage(), $e->status, $e->errors);
        } catch (\Throwable $e) {
            @file_put_contents(BASE_PATH . '/storage/logs/app.log', date('c') . ' ' . $e . "\n", FILE_APPEND);
            Response::error($debug ? $e->getMessage() : 'Internal server error', 500);
        }
    }
}
