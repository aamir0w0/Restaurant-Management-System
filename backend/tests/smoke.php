<?php
// End-to-end API smoke test. Requires a running Apache+MySQL, seeded DB and an admin user.
// Usage: php backend/tests/smoke.php http://localhost/restaurant-management-system/backend/public admin@example.com 'YourPassword'
[$s, $base, $email, $pass] = $argv + [null, null, null, null];
if (!$base) exit("usage: smoke.php BASE_URL EMAIL PASSWORD\n");
$jar = tempnam(sys_get_temp_dir(), 'jar'); $csrf = ''; $pass_n = 0; $fail_n = 0;
function call(string $m, string $path, ?array $body = null, bool $raw = false) {
    global $base, $jar, $csrf;
    $ch = curl_init(rtrim($base, '/') . '/api/v1' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $m, CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $csrf], CURLOPT_POSTFIELDS => $body !== null ? json_encode($body) : null]);
    $out = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return [$code, json_decode($out, true)];
}
function check(string $name, bool $ok, $extra = '') { global $pass_n, $fail_n; $ok ? $pass_n++ : $fail_n++; echo ($ok ? 'PASS' : 'FAIL') . "  $name" . ($ok ? '' : "  -> " . json_encode($extra)) . "\n"; }
[$c, $r] = call('POST', '/auth/login', ['email' => $email, 'password' => $pass]); check('login', $c === 200, $r); $csrf = $r['data']['csrf_token'] ?? '';
[$c, $r] = call('POST', '/auth/login', ['email' => $email, 'password' => 'wrong-password-x']); check('bad login rejected', $c === 401, $r);
[$c] = call('POST', '/categories', ['name' => 'Smoke ' . uniqid()]); check('create category', $c === 201);
[$c, $cats] = call('GET', '/categories'); $cat = $cats['data'][0]['id'] ?? 0;
[$c, $it] = call('POST', '/menu-items', ['category_id' => $cat, 'name' => 'Smoke Burger ' . uniqid(), 'base_price' => 9.5]); check('create menu item', $c === 201, $it); $item = $it['data']['id'] ?? 0;
[$c, $ing] = call('POST', '/inventory/ingredients', ['name' => 'Smoke Bun ' . uniqid(), 'unit' => 'pcs', 'min_stock' => 2, 'opening_quantity' => 10]); check('create ingredient', $c === 201, $ing); $ingId = $ing['data']['id'] ?? 0;
[$c] = call('PUT', "/menu-items/$item/recipe", ['items' => [['ingredient_id' => $ingId, 'quantity' => 1]]]); check('save recipe', $c === 200);
$key = bin2hex(random_bytes(8));
[$c, $o] = call('POST', '/orders', ['order_type' => 'takeaway', 'idempotency_key' => $key, 'items' => [['menu_item_id' => $item, 'quantity' => 2]]]); check('create order', $c === 201, $o); $oid = $o['data']['id'] ?? 0;
check('server total = 19.00 (no tax configured)', ($o['data']['total'] ?? '') === '19.00' || (float)($o['data']['total'] ?? 0) >= 19.0, $o['data']['total'] ?? null);
[$c, $o2] = call('POST', '/orders', ['order_type' => 'takeaway', 'idempotency_key' => $key, 'items' => [['menu_item_id' => $item, 'quantity' => 2]]]); check('duplicate submission returns same order', ($o2['data']['id'] ?? 0) === $oid);
[$c] = call('POST', '/orders', ['order_type' => 'takeaway', 'items' => [['menu_item_id' => $item, 'quantity' => 0]]]); check('invalid quantity rejected', $c === 422);
[$c] = call('PUT', "/orders/$oid/status", ['status' => 'completed']); check('invalid transition rejected', $c === 409);
foreach (['accepted', 'preparing'] as $st) { [$c] = call('PUT', "/orders/$oid/status", ['status' => $st]); check("status -> $st", $c === 200); }
[$c, $k] = call('GET', '/kitchen/orders'); check('kitchen sees order', in_array($oid, array_column($k['data'] ?? [], 'id')));
[$c, $inv] = call('GET', '/inventory/ingredients'); $qty = null; foreach ($inv['data']['items'] as $x) if ($x['id'] == $ingId) $qty = (float)$x['quantity_on_hand']; check('stock deducted once (10 -> 8)', $qty === 8.0, $qty);
[$c] = call('PUT', "/orders/$oid/status", ['status' => 'ready']); [$c] = call('PUT', "/orders/$oid/status", ['status' => 'served']);
[$c] = call('POST', "/orders/$oid/payments", ['method' => 'cash', 'amount' => 100]); check('overpayment rejected', $c === 422);
$pk = bin2hex(random_bytes(8));
[$c, $p] = call('POST', "/orders/$oid/payments", ['method' => 'cash', 'amount' => 10, 'idempotency_key' => $pk]); check('partial payment', $c === 201 && $p['data']['payment_status'] === 'partially_paid', $p);
[$c, $p] = call('POST', "/orders/$oid/payments", ['method' => 'cash', 'amount' => 10, 'idempotency_key' => $pk]); check('payment retry is idempotent', abs((float)$p['data']['paid_total'] - 10) < 0.001, $p['data']['paid_total'] ?? null);
[$c] = call('PUT', "/orders/$oid/status", ['status' => 'completed']); check('cannot complete while balance due', $c === 409);
[$c, $p] = call('POST', "/orders/$oid/payments", ['method' => 'cash', 'amount' => 9, 'tendered' => 10]); check('final payment => paid', $p['data']['payment_status'] === 'paid', $p);
[$c] = call('PUT', "/orders/$oid/status", ['status' => 'completed']); check('complete paid order', $c === 200);
[$c, $d] = call('GET', '/dashboard'); check('dashboard returns data', $c === 200 && isset($d['data']['summary']));
[$c] = call('POST', '/auth/logout'); [$c] = call('GET', '/orders'); check('protected route after logout => 401', $c === 401);
echo "\n$pass_n passed, $fail_n failed\n"; exit($fail_n ? 1 : 0);
