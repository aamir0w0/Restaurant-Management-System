<?php
// Usage: php backend/bin/create-admin.php  (interactive; password is never stored in files or shell history)
declare(strict_types=1);
require __DIR__ . '/../src/bootstrap.php';
use App\Core\Db;
if (PHP_SAPI !== 'cli') exit('CLI only');
function ask(string $q): string { echo $q; return trim((string)fgets(STDIN)); }
$name = ask('Full name: '); $email = ask('Email: ');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) exit("Invalid email\n");
echo 'Password (min 10 chars, visible while typing): '; $pw = trim((string)fgets(STDIN));
if (strlen($pw) < 10) exit("Password too short\n");
$role = Db::val("SELECT id FROM roles WHERE name='super_admin'");
if (!$role) exit("Run database/seed.sql first\n");
if (Db::val('SELECT COUNT(*) FROM users WHERE email=?', [$email])) exit("User already exists\n");
Db::run('INSERT INTO users (name,email,password_hash,role_id) VALUES (?,?,?,?)', [$name, $email, password_hash($pw, PASSWORD_DEFAULT), $role]);
echo "Super Admin created.\n";
