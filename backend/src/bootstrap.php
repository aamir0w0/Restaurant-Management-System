<?php
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
spl_autoload_register(function (string $class): void {
    if (strncmp($class, 'App\\', 4) !== 0) return;
    $file = BASE_PATH . '/src/' . str_replace('\\', '/', substr($class, 4)) . '.php';
    if (is_file($file)) require $file;
});
App\Core\Env::load(BASE_PATH . '/.env');
date_default_timezone_set(App\Core\Env::get('APP_TIMEZONE', 'UTC'));
