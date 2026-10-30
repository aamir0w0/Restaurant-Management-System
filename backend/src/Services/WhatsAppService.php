<?php
namespace App\Services;
use App\Core\{Env, Audit};
use App\Controllers\SettingsController;
/**
 * WhatsApp Cloud API (Meta). Sends an approved TEMPLATE message (required for business-initiated messages).
 * Template body suggestion: "Hi {{1}}, thank you for your order {{2}} at {{3}}! We will update you when it is ready."
 * Failures are logged and NEVER block the order.
 */
final class WhatsAppService {
    public static function enabled(): bool { return (Env::get('WHATSAPP_TOKEN', '') ?? '') !== '' && (Env::get('WHATSAPP_PHONE_ID', '') ?? '') !== '' && (SettingsController::all()['whatsapp_enabled'] ?? '0') === '1'; }
    /** international digits without '+', e.g. 0300 1234567 -> 923001234567 */
    public static function normalize(string $phone, ?string $cc = null): string {
        $d = preg_replace('/\D/', '', $phone); $cc = $cc ?? (SettingsController::all()['whatsapp_country_code'] ?? '92');
        if ($d === '') return '';
        if (str_starts_with($d, '00')) return substr($d, 2);
        if (str_starts_with($d, '0')) return $cc . substr($d, 1);
        return strlen($d) <= 10 ? $cc . $d : $d;
    }
    public static function orderThanks(array $order, string $phone, string $name): void {
        try {
            if (!self::enabled()) return;
            $to = self::normalize($phone); if ($to === '') return;
            $set = SettingsController::all();
            $payload = ['messaging_product' => 'whatsapp', 'to' => $to, 'type' => 'template', 'template' => ['name' => Env::get('WHATSAPP_TEMPLATE', 'order_thank_you'), 'language' => ['code' => Env::get('WHATSAPP_LANG', 'en')],
                'components' => [['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $name !== '' ? $name : 'there'], ['type' => 'text', 'text' => $order['order_number']], ['type' => 'text', 'text' => $set['restaurant_name'] ?? 'our restaurant']]]]]];
            $ch = curl_init('https://graph.facebook.com/' . Env::get('WHATSAPP_API_VERSION', 'v21.0') . '/' . Env::get('WHATSAPP_PHONE_ID') . '/messages');
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 6, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . Env::get('WHATSAPP_TOKEN'), 'Content-Type: application/json'], CURLOPT_POSTFIELDS => json_encode($payload)]);
            $out = curl_exec($ch); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($out !== false && $code < 300) { Audit::log('whatsapp_sent', 'order', $order['id'], $order['order_number']); return; }
            $j = json_decode((string)$out, true);
            Audit::log('whatsapp_failed', 'order', $order['id'], $order['order_number'] . ': ' . ($j['error']['message'] ?? "HTTP $code"));
        } catch (\Throwable $e) { error_log('WhatsApp error: ' . $e->getMessage()); }
    }
}
