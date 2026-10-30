-- Safe to re-run (idempotent). Creates roles, permissions, default settings and sample menu. NO users are created here:
-- run `php backend/bin/create-admin.php` to create the first administrator.
USE restaurant_management_system;
INSERT IGNORE INTO roles (name,label) VALUES ('super_admin','Super Admin'),('owner','Restaurant Owner'),('manager','Manager'),('cashier','Cashier'),('waiter','Waiter'),('chef','Chef'),('inventory_manager','Inventory Manager'),('accountant','Accountant'),('hr_manager','HR Manager');
INSERT IGNORE INTO permissions (code,label) VALUES
('dashboard.view','View dashboard'),('menu.view','View menu'),('menu.manage','Manage menu'),('menu.price','Change menu prices'),
('orders.view','View orders'),('orders.create','Create orders'),('orders.update','Update order status'),('orders.cancel','Cancel orders'),('orders.discount','Apply discounts'),
('payments.create','Take payments'),('payments.refund','Issue refunds'),('kitchen.view','View kitchen display'),('kitchen.update','Update kitchen status'),
('tables.view','View tables'),('tables.manage','Manage tables'),('customers.view','View customers'),('customers.manage','Manage customers'),
('inventory.view','View inventory'),('inventory.adjust','Adjust inventory'),('suppliers.manage','Manage suppliers'),
('expenses.view','View expenses'),('expenses.manage','Manage expenses'),('reports.view','View reports'),
('users.manage','Manage users'),('roles.manage','Manage role permissions'),('settings.view','View settings'),('settings.manage','Configure restaurant'),('audit.view','View audit logs');
-- super_admin gets everything implicitly in code; also map explicitly
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.name IN ('super_admin','owner');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='manager' AND p.code NOT IN ('users.manage','roles.manage','settings.manage');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='cashier' AND p.code IN ('menu.view','orders.view','orders.create','orders.update','payments.create','tables.view','customers.view','customers.manage','kitchen.view');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='waiter' AND p.code IN ('menu.view','orders.view','orders.create','orders.update','tables.view','customers.view','kitchen.view');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='chef' AND p.code IN ('menu.view','orders.view','kitchen.view','kitchen.update','inventory.view');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='inventory_manager' AND p.code IN ('menu.view','inventory.view','inventory.adjust','suppliers.manage');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='accountant' AND p.code IN ('dashboard.view','orders.view','expenses.view','expenses.manage','reports.view','inventory.view');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='hr_manager' AND p.code IN ('dashboard.view');
INSERT IGNORE INTO settings (key_name,value_text) VALUES ('restaurant_name','My Restaurant'),('address',''),('phone',''),('email',''),('currency','USD'),('tax_rate','0'),('service_charge_rate','0'),('delivery_charge','0'),
 ('payment_methods','cash,card_terminal,other'),('receipt_footer','Thank you for dining with us!'),('allow_negative_stock','1');
INSERT IGNORE INTO categories (name,sort_order) VALUES ('Burgers',1),('Pizza',2),('Coffee',3),('Desserts',4);
