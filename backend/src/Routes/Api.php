<?php
namespace App\Routes;
use App\Core\Router;
use App\Controllers\{Crud, AuthController, UserController, SettingsController, MenuController, OrderController, TableController, InventoryController, ReportController, MiscController, PublicController, ReservationController, PurchaseController, CustomerController, PaymentController};
use App\Services\StripeService;
final class Api {
    public static function register(Router $rt): void {
        $a = new AuthController();
        $rt->add('POST', '/auth/login', [$a, 'login'], null, true);
        $rt->post('/auth/logout', [$a, 'logout']); $rt->get('/auth/me', [$a, 'me']); $rt->post('/auth/change-password', [$a, 'changePassword']);

        $u = new UserController();
        $rt->get('/users', [$u, 'index'], 'users.manage'); $rt->post('/users', [$u, 'store'], 'users.manage'); $rt->put('/users/{id}', [$u, 'update'], 'users.manage');
        $rt->get('/roles', [$u, 'roles'], 'users.manage'); $rt->put('/roles/{id}/permissions', [$u, 'setPermissions'], 'roles.manage');

        $s = new SettingsController();
        $rt->get('/settings', [$s, 'show'], null); $rt->put('/settings', [$s, 'update'], 'settings.manage');

        $m = new MenuController();
        $rt->get('/menu-items', [$m, 'index'], 'menu.view'); $rt->get('/menu-items/{id}', [$m, 'show'], 'menu.view');
        $rt->post('/menu-items', [$m, 'store'], 'menu.manage'); $rt->put('/menu-items/{id}', [$m, 'update'], 'menu.manage'); $rt->delete('/menu-items/{id}', [$m, 'destroy'], 'menu.manage');
        $rt->post('/menu-items/{id}/image', [$m, 'image'], 'menu.manage');
        $rt->get('/modifier-groups', [$m, 'groups'], 'menu.view'); $rt->post('/modifier-groups', [$m, 'saveGroup'], 'menu.manage'); $rt->put('/modifier-groups/{id}', [$m, 'saveGroup'], 'menu.manage');
        Crud::register($rt, '/categories', new Crud('categories', ['name' => ['type' => 'string', 'required' => true, 'max' => 100], 'sort_order' => ['type' => 'int', 'default' => 0], 'is_active' => ['type' => 'bool', 'default' => 1]], ['name'], [], ['sort' => 'sort_order', 'unique' => ['name']]), ['view' => 'menu.view', 'manage' => 'menu.manage']);

        $t = new TableController();
        $rt->get('/tables', [$t, 'index'], 'tables.view'); $rt->put('/tables/{id}/status', [$t, 'status'], 'tables.manage');
        $tc = new Crud('dining_tables', ['number' => ['type' => 'string', 'required' => true, 'max' => 20], 'section' => ['type' => 'string', 'max' => 60], 'capacity' => ['type' => 'int', 'default' => 4, 'min' => 1], 'is_active' => ['type' => 'bool', 'default' => 1]], ['number', 'section'], [], ['unique' => ['number']]);
        $rt->post('/tables', [$tc, 'store'], 'tables.manage'); $rt->put('/tables/{id}', [$tc, 'update'], 'tables.manage'); $rt->delete('/tables/{id}', [$tc, 'destroy'], 'tables.manage');

        Crud::register($rt, '/customers', new Crud('customers', ['name' => ['type' => 'string', 'required' => true, 'max' => 120], 'phone' => ['type' => 'string', 'max' => 30], 'email' => ['type' => 'email'], 'address' => ['type' => 'string'], 'notes' => ['type' => 'string', 'max' => 2000], 'is_active' => ['type' => 'bool', 'default' => 1]], ['name', 'phone', 'email'], [],
            ['select' => "t.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id=t.id AND o.status<>'cancelled') AS order_count, (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.customer_id=t.id AND o.status<>'cancelled') AS total_spent"]), ['view' => 'customers.view', 'manage' => 'customers.manage']);
        Crud::register($rt, '/suppliers', new Crud('suppliers', ['name' => ['type' => 'string', 'required' => true, 'max' => 150], 'contact_name' => ['type' => 'string', 'max' => 120], 'phone' => ['type' => 'string', 'max' => 30], 'email' => ['type' => 'email'], 'address' => ['type' => 'string'], 'is_active' => ['type' => 'bool', 'default' => 1]], ['name', 'contact_name'], []), ['view' => 'suppliers.manage', 'manage' => 'suppliers.manage']);
        Crud::register($rt, '/expenses', new Crud('expenses', ['category' => ['type' => 'string', 'required' => true, 'max' => 80], 'amount' => ['type' => 'decimal', 'required' => true, 'min' => 0.01], 'expense_date' => ['type' => 'date', 'required' => true], 'description' => ['type' => 'string'], 'payment_method' => ['type' => 'string', 'default' => 'cash', 'max' => 30], 'vendor' => ['type' => 'string', 'max' => 120]], ['category', 'vendor', 'description'], [], ['stamp_user' => 'created_by', 'sort' => 'expense_date', 'range' => ['expense_date']]), ['view' => 'expenses.view', 'manage' => 'expenses.manage']);

        $o = new OrderController();
        $rt->get('/orders', [$o, 'index'], 'orders.view'); $rt->get('/orders/{id}', [$o, 'show'], 'orders.view'); $rt->post('/orders', [$o, 'store'], 'orders.create');
        $rt->put('/orders/{id}/status', [$o, 'status'], 'orders.view'); $rt->post('/orders/{id}/transfer', [$o, 'transfer'], 'orders.update');
        $rt->post('/orders/{id}/payments', [$o, 'pay'], 'payments.create'); $rt->post('/orders/{id}/refunds', [$o, 'refund'], 'payments.refund');
        $rt->get('/kitchen/orders', [$o, 'kitchen'], 'kitchen.view');

        $i = new InventoryController();
        $rt->get('/inventory/ingredients', [$i, 'ingredients'], 'inventory.view'); $rt->post('/inventory/ingredients', [$i, 'create'], 'inventory.adjust'); $rt->put('/inventory/ingredients/{id}', [$i, 'update'], 'inventory.adjust');
        $rt->post('/inventory/adjustments', [$i, 'adjust'], 'inventory.adjust'); $rt->get('/inventory/movements', [$i, 'movements'], 'inventory.view');
        $rt->get('/menu-items/{id}/recipe', [$i, 'recipe'], 'inventory.view'); $rt->put('/menu-items/{id}/recipe', [$i, 'saveRecipe'], 'inventory.adjust');

        $rp = new ReportController();
        $rt->get('/dashboard', [$rp, 'dashboard'], 'dashboard.view'); $rt->get('/reports/profit-estimate', [$rp, 'pnl'], 'reports.view'); $rt->get('/reports/{type}', [$rp, 'run'], 'reports.view');


        $pb = new PublicController();
        $rt->add('GET', '/public/config', [$pb, 'config'], null, true); $rt->add('GET', '/public/menu', [$pb, 'menu'], null, true);
        $rt->add('POST', '/public/orders', [$pb, 'order'], null, true); $rt->add('GET', '/public/orders/{number}', [$pb, 'track'], null, true);
        $rt->add('POST', '/public/webhooks/stripe', [StripeService::class, 'webhook'], null, true);

        $rv = new ReservationController();
        $rt->get('/reservations', [$rv, 'index'], 'reservations.manage'); $rt->post('/reservations', [$rv, 'store'], 'reservations.manage');
        $rt->put('/reservations/{id}', [$rv, 'update'], 'reservations.manage'); $rt->put('/reservations/{id}/status', [$rv, 'status'], 'reservations.manage');

        $pu = new PurchaseController();
        $rt->get('/purchases', [$pu, 'index'], 'purchases.manage'); $rt->get('/purchases/{id}', [$pu, 'show'], 'purchases.manage'); $rt->post('/purchases', [$pu, 'store'], 'purchases.manage');
        $rt->post('/purchases/{id}/approve', [$pu, 'approve'], 'purchases.approve'); $rt->post('/purchases/{id}/cancel', [$pu, 'cancel'], 'purchases.manage'); $rt->post('/purchases/{id}/receive', [$pu, 'receive'], 'purchases.manage');

        $cu = new CustomerController();
        $rt->get('/customers/{id}/profile', [$cu, 'profile'], 'customers.view'); $rt->post('/customers/{id}/loyalty', [$cu, 'adjustPoints'], 'customers.manage');

        $x = new MiscController();
        $rt->get('/notifications', [$x, 'notifications'], null); $rt->post('/notifications/read-all', [$x, 'readAll'], null); $rt->post('/notifications/read-types', [$x, 'readTypes'], null); $rt->post('/notifications/{id}/read', [$x, 'read'], null);
        $rt->get('/notifications/new-orders', [$x, 'newOrders'], 'orders.view');
        $rt->get('/payments', [new PaymentController(), 'index'], 'payments.view'); $rt->get('/audit-logs', [$x, 'audit'], 'audit.view');
    }
}
