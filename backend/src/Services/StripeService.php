<?php
namespace App\Services;
use App\Core\{Db, Env, Request, Response, HttpException, Audit};
/** Stripe Checkout (hosted page). Card data never touches this server. Order is marked paid ONLY by the signed webhook. */
final class StripeService {
    public static function enabled(): bool { return (Env::get('STRIPE_SECRET_KEY', '') ?? '') !== ''; }
    private static function api(string $path, array $fields): array {
        $ch = curl_init('https://api.stripe.com/v1' . $path);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_USERPWD => Env::get('STRIPE_SECRET_KEY') . ':', CURLOPT_POSTFIELDS => http_build_query($fields), CURLOPT_TIMEOUT => 20]);
        $out = curl_exec($ch); $err = curl_error($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($out === false) throw new \RuntimeException("Stripe connection failed: $err");
        $j = json_decode($out, true);
        if ($code >= 400 || !is_array($j)) throw new \RuntimeException('Stripe error: ' . ($j['error']['message'] ?? $code));
        return $j;
    }
    public static function checkout(array $order, string $phone): string {
        $cents = OrderService::cents($order['total']); $cur = strtolower($order['currency']);
        $base = rtrim(Env::get('STORE_URL', 'http://localhost:5173'), '/') . '/store/track/' . rawurlencode($order['order_number']) . '?phone=' . rawurlencode($phone);
        $res = self::api('/checkout/sessions', [
            'mode' => 'payment', 'success_url' => $base . '&paid=1', 'cancel_url' => $base . '&cancelled=1', 'client_reference_id' => (string)$order['id'], 'metadata[order_id]' => (string)$order['id'],
            'line_items[0][quantity]' => '1', 'line_items[0][price_data][currency]' => $cur,
            'line_items[0][price_data][unit_amount]' => (string)Money::gatewayMinor($cents, $order['currency']), 'line_items[0][price_data][product_data][name]' => 'Order ' . $order['order_number'],
        ]);
        Db::run('INSERT INTO payment_intents (order_id,provider,provider_ref,amount,currency,status) VALUES (?,?,?,?,?,?)', [$order['id'], 'stripe', $res['id'], $order['total'], $order['currency'], 'created']);
        return $res['url'];
    }
    public static function webhook(Request $r): void {
        $secret = Env::get('STRIPE_WEBHOOK_SECRET', '');
        if (!$secret) throw new HttpException(503, 'Webhook not configured');
        $t = null; $sigs = [];
        foreach (explode(',', $r->header('Stripe-Signature') ?? '') as $part) { [$k, $v] = array_pad(explode('=', trim($part), 2), 2, ''); if ($k === 't') $t = $v; if ($k === 'v1') $sigs[] = $v; }
        if (!$t || abs(time() - (int)$t) > 300) throw new HttpException(400, 'Bad signature timestamp');
        $expected = hash_hmac('sha256', $t . '.' . $r->raw, $secret); $ok = false;
        foreach ($sigs as $s) if (hash_equals($expected, $s)) $ok = true;
        if (!$ok) throw new HttpException(400, 'Invalid signature');
        $evt = json_decode($r->raw, true);
        if (($evt['type'] ?? '') === 'checkout.session.completed' && (($evt['data']['object']['payment_status'] ?? '') === 'paid')) self::settle($evt['data']['object']);
        Response::json(null, 'ok');
    }
    private static function settle(array $s): void {
        $pi = Db::one('SELECT * FROM payment_intents WHERE provider_ref=?', [$s['id']]);
        if (!$pi) return;
        $expected = Money::gatewayMinor(OrderService::cents($pi['amount']), $pi['currency']);
        if ((int)($s['amount_total'] ?? -1) !== $expected || strtolower($s['currency'] ?? '') !== strtolower($pi['currency'])) { error_log('Stripe amount mismatch for ' . $s['id']); Audit::notify('payment', 'Online payment amount mismatch - check Stripe for ' . $s['id'], 'mismatch:' . $s['id']); return; }
        try {
            PaymentService::record((int)$pi['order_id'], ['method' => 'card_online', 'amount' => $pi['amount'], 'reference' => $s['payment_intent'] ?? $s['id'], 'idempotency_key' => 'stripe_' . $s['id']], null, true);
            Db::run("UPDATE payment_intents SET status='paid' WHERE id=?", [$pi['id']]);
        } catch (HttpException $e) {
            Audit::notify('payment', 'Online card payment received for an order that cannot accept it (' . $e->getMessage() . '). Refund it in Stripe: ' . $s['id'], 'orphan:' . $s['id']);
        }
    }
}
