<?php
namespace App\Controllers;
use App\Core\{Db, Request, Response, HttpException};
use App\Services\Money;
final class ReportController {
    private static function range(Request $r): array {
        $from = $r->query['from'] ?? date('Y-m-d'); $to = $r->query['to'] ?? date('Y-m-d');
        foreach ([$from, $to] as $d) { $x = \DateTime::createFromFormat('Y-m-d', $d); if (!$x || $x->format('Y-m-d') !== $d) throw new HttpException(422, 'Dates must be YYYY-MM-DD'); }
        if ($from > $to) throw new HttpException(422, 'from must not be after to');
        return [$from, $to];
    }
    public function dashboard(Request $r): void {
        [$f, $t] = self::range($r); $p = [$f, $t];
        $live = "o.status<>'cancelled' AND DATE(o.created_at) BETWEEN ? AND ?";
        $s = Db::one("SELECT COALESCE(SUM(o.total),0) AS sales, COUNT(*) AS orders, COALESCE(AVG(o.total),0) AS avg_order, COALESCE(SUM(o.status='completed'),0) AS completed, COALESCE(SUM(o.status IN ('pending','accepted','preparing','ready')),0) AS pending,
            COALESCE(SUM(GREATEST(o.total-(o.paid_total-o.refunded_total),0)),0) AS outstanding FROM orders o WHERE $live", $p);
        $s['collected'] = Db::val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE DATE(created_at) BETWEEN ? AND ?', $p);
        $s['refunds'] = Db::val('SELECT COALESCE(SUM(amount),0) FROM refunds WHERE DATE(created_at) BETWEEN ? AND ?', $p);
        $s['expenses'] = Db::val('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE is_active=1 AND expense_date BETWEEN ? AND ?', $p);
        $s['low_stock'] = Db::val('SELECT COUNT(*) FROM ingredients WHERE is_active=1 AND quantity_on_hand<=min_stock');
        $days = (int)((strtotime($t) - strtotime($f)) / 86400) + 1; $pt = date('Y-m-d', strtotime($f . ' -1 day')); $pf = date('Y-m-d', strtotime($pt . ' -' . ($days - 1) . ' day'));
        $s['prev'] = Db::one("SELECT COALESCE(SUM(o.total),0) AS sales, COUNT(*) AS orders, COALESCE(AVG(o.total),0) AS avg_order FROM orders o WHERE $live", [$pf, $pt]);
        $s['new_customers'] = (int)Db::val('SELECT COUNT(*) FROM customers WHERE DATE(created_at) BETWEEN ? AND ?', $p);
        Response::json(['summary' => $s,
            'sales_over_time' => Db::all("SELECT DATE(o.created_at) AS day, SUM(o.total) AS sales, COUNT(*) AS orders FROM orders o WHERE $live GROUP BY day ORDER BY day", $p),
            'by_status' => Db::all('SELECT o.status, COUNT(*) AS count FROM orders o WHERE DATE(o.created_at) BETWEEN ? AND ? GROUP BY o.status', $p),
            'by_type' => Db::all("SELECT o.order_type, SUM(o.total) AS sales, COUNT(*) AS orders FROM orders o WHERE $live GROUP BY o.order_type", $p),
            'top_items' => Db::all("SELECT oi.item_name, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue, MAX(m.image_path) AS image_path FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN menu_items m ON m.id=oi.menu_item_id WHERE $live GROUP BY oi.item_name ORDER BY qty DESC LIMIT 6", $p),
            'payments_by_method' => Db::all('SELECT method, COUNT(*) AS payments, SUM(amount) AS collected FROM payments WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY method ORDER BY collected DESC', $p),
            'active_orders' => Db::all("SELECT o.id,o.order_number,o.order_type,o.status,t.number AS table_number,(SELECT COALESCE(SUM(quantity),0) FROM order_items WHERE order_id=o.id) AS item_count FROM orders o LEFT JOIN dining_tables t ON t.id=o.table_id WHERE o.status IN ('pending','accepted','preparing','ready') ORDER BY o.id DESC LIMIT 4"),
            'recent_orders' => Db::all('SELECT id,order_number,order_type,status,payment_status,total,created_at FROM orders ORDER BY id DESC LIMIT 8')]);
    }
    private const Q = [
        'sales-by-day' => "SELECT DATE(o.created_at) AS day, COUNT(*) AS orders, SUM(o.subtotal) AS gross_sales, SUM(o.discount_total) AS discounts, SUM(o.tax_total) AS tax, SUM(o.service_charge) AS service_charge, SUM(o.total) AS total FROM orders o WHERE o.status<>'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY day ORDER BY day",
        'sales-by-item' => "SELECT oi.item_name AS item, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY oi.item_name ORDER BY revenue DESC",
        'sales-by-category' => "SELECT c.name AS category, SUM(oi.quantity) AS qty, SUM(oi.line_total) AS revenue FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN menu_items m ON m.id=oi.menu_item_id JOIN categories c ON c.id=m.category_id WHERE o.status<>'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY c.name ORDER BY revenue DESC",
        'sales-by-cashier' => "SELECT COALESCE(u.name,'Online orders') AS cashier, COUNT(*) AS orders, SUM(o.total) AS total FROM orders o LEFT JOIN users u ON u.id=o.cashier_id WHERE o.status<>'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY COALESCE(u.name,'Online orders') ORDER BY total DESC",
        'sales-by-type' => "SELECT o.order_type, COUNT(*) AS orders, SUM(o.total) AS total FROM orders o WHERE o.status<>'cancelled' AND DATE(o.created_at) BETWEEN ? AND ? GROUP BY o.order_type",
        'payments-by-method' => "SELECT method, COUNT(*) AS payments, SUM(amount) AS collected FROM payments WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY method",
        'refunds' => "SELECT r.created_at, o.order_number, r.amount, r.reason FROM refunds r JOIN orders o ON o.id=r.order_id WHERE DATE(r.created_at) BETWEEN ? AND ? ORDER BY r.id DESC",
        'cancelled-orders' => "SELECT o.created_at, o.order_number, o.total, (SELECT note FROM order_status_history h WHERE h.order_id=o.id AND h.to_status='cancelled' LIMIT 1) AS reason FROM orders o WHERE o.status='cancelled' AND DATE(o.created_at) BETWEEN ? AND ?",
        'discounts' => "SELECT o.created_at, o.order_number, o.discount_total FROM orders o WHERE o.discount_total>0 AND DATE(o.created_at) BETWEEN ? AND ?",
        'expenses' => "SELECT expense_date, category, vendor, payment_method, amount, description FROM expenses WHERE is_active=1 AND expense_date BETWEEN ? AND ? ORDER BY expense_date",
        'stock-movements' => "SELECT m.created_at, i.name AS ingredient, m.movement_type, m.quantity, i.unit, m.balance_after, m.reason FROM stock_movements m JOIN ingredients i ON i.id=m.ingredient_id WHERE DATE(m.created_at) BETWEEN ? AND ? ORDER BY m.id DESC",
        'wastage' => "SELECT m.created_at, i.name AS ingredient, m.movement_type, ABS(m.quantity) AS quantity, i.unit, ROUND(ABS(m.quantity)*i.cost_per_unit,2) AS estimated_cost, m.reason FROM stock_movements m JOIN ingredients i ON i.id=m.ingredient_id WHERE m.movement_type IN ('wastage','spoilage') AND DATE(m.created_at) BETWEEN ? AND ?",
    ];
    public function run(Request $r): void {
        $type = $r->params['type'];
        if ($type === 'low-stock') { $rows = Db::all('SELECT name,unit,quantity_on_hand,min_stock FROM ingredients WHERE is_active=1 AND quantity_on_hand<=min_stock ORDER BY name'); }
        elseif (isset(self::Q[$type])) { [$f, $t] = self::range($r); $rows = Db::all(self::Q[$type], [$f, $t]); }
        else throw new HttpException(404, 'Unknown report');
        if (($r->query['format'] ?? '') === 'csv') Response::csv("$type.csv", $rows);
        Response::json($rows);
    }
    public function pnl(Request $r): void {
        [$f, $t] = self::range($r); $p = [$f, $t];
        $o = Db::one("SELECT COALESCE(SUM(subtotal),0) AS gross_sales, COALESCE(SUM(discount_total),0) AS discounts, COALESCE(SUM(tax_total),0) AS taxes, COALESCE(SUM(service_charge),0) AS service_charges FROM orders WHERE status<>'cancelled' AND DATE(created_at) BETWEEN ? AND ?", $p);
        $o['refunds'] = (float)Db::val('SELECT COALESCE(SUM(amount),0) FROM refunds WHERE DATE(created_at) BETWEEN ? AND ?', $p);
        $o['net_sales'] = round($o['gross_sales'] - $o['discounts'] - $o['refunds'], 2);
        $o['collected_payments'] = (float)Db::val('SELECT COALESCE(SUM(amount),0) FROM payments WHERE DATE(created_at) BETWEEN ? AND ?', $p);
        $o['ingredient_cost_of_sales'] = (float)Db::val("SELECT COALESCE(SUM(ABS(m.quantity)*i.cost_per_unit),0) FROM stock_movements m JOIN ingredients i ON i.id=m.ingredient_id WHERE m.movement_type='sale' AND DATE(m.created_at) BETWEEN ? AND ?", $p);
        $o['ingredient_cost_of_sales'] = round($o['ingredient_cost_of_sales'] * Money::ctx()['rate'], 2); // ingredient costs are in base currency
        $o['operating_expenses'] = (float)Db::val('SELECT COALESCE(SUM(amount),0) FROM expenses WHERE is_active=1 AND expense_date BETWEEN ? AND ?', $p);
        $o['estimated_operating_profit'] = round($o['net_sales'] - $o['ingredient_cost_of_sales'] - $o['operating_expenses'], 2);
        $o['note'] = 'Estimate only: net sales (excl. tax & service) minus recipe-based ingredient cost minus recorded expenses. Not audited accounting profit.';
        Response::json($o);
    }
}
