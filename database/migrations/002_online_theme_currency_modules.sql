-- Run AFTER schema.sql and seed.sql (fresh installs and existing installs alike).
-- Written for MariaDB (XAMPP default). On MySQL 8 remove every "IF NOT EXISTS" that follows ADD COLUMN / ADD INDEX.
USE restaurant_management_system;

ALTER TABLE orders MODIFY cashier_id INT UNSIGNED NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source ENUM('pos','online') NOT NULL DEFAULT 'pos' AFTER order_number;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'USD' AFTER total;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(14,6) NOT NULL DEFAULT 1 AFTER currency;
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_orders_source (source);
ALTER TABLE payments MODIFY received_by INT UNSIGNED NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'pos';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_intents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL, provider VARCHAR(20) NOT NULL, provider_ref VARCHAR(120) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL, currency CHAR(3) NOT NULL, status ENUM('created','paid','failed') NOT NULL DEFAULT 'created', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (order_id), FOREIGN KEY (order_id) REFERENCES orders(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS public_requests (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, ip VARCHAR(45) NOT NULL, kind VARCHAR(20) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (ip, kind, created_at)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS reservations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NULL, customer_name VARCHAR(120) NOT NULL, phone VARCHAR(30) NULL, email VARCHAR(190) NULL,
  party_size SMALLINT UNSIGNED NOT NULL, reservation_date DATE NOT NULL, start_time TIME NOT NULL, duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 90, table_id INT UNSIGNED NULL,
  status ENUM('booked','checked_in','completed','cancelled','no_show') NOT NULL DEFAULT 'booked', notes VARCHAR(500) NULL, created_by INT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (reservation_date, status), INDEX (table_id, reservation_date), FOREIGN KEY (table_id) REFERENCES dining_tables(id), FOREIGN KEY (customer_id) REFERENCES customers(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, customer_id INT UNSIGNED NOT NULL, order_id BIGINT UNSIGNED NULL, type ENUM('earn','redeem','adjust') NOT NULL, points INT NOT NULL, reason VARCHAR(255) NOT NULL,
  created_by INT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_order_type (order_id, type), INDEX (customer_id), FOREIGN KEY (customer_id) REFERENCES customers(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, po_number VARCHAR(30) NOT NULL UNIQUE, supplier_id INT UNSIGNED NOT NULL, status ENUM('draft','approved','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
  notes VARCHAR(500) NULL, total DECIMAL(12,2) NOT NULL DEFAULT 0, created_by INT UNSIGNED NULL, approved_by INT UNSIGNED NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (supplier_id) REFERENCES suppliers(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, po_id INT UNSIGNED NOT NULL, ingredient_id INT UNSIGNED NOT NULL, quantity_ordered DECIMAL(14,4) NOT NULL, quantity_received DECIMAL(14,4) NOT NULL DEFAULT 0,
  quantity_rejected DECIMAL(14,4) NOT NULL DEFAULT 0, unit_cost DECIMAL(12,4) NOT NULL, UNIQUE (po_id, ingredient_id), FOREIGN KEY (po_id) REFERENCES purchase_orders(id), FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS goods_receipts (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, po_id INT UNSIGNED NOT NULL, received_by INT UNSIGNED NULL, note VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (po_id) REFERENCES purchase_orders(id)) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS goods_receipt_items (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, receipt_id INT UNSIGNED NOT NULL, po_item_id INT UNSIGNED NOT NULL, qty_accepted DECIMAL(14,4) NOT NULL, qty_rejected DECIMAL(14,4) NOT NULL DEFAULT 0, unit_cost DECIMAL(12,4) NOT NULL,
  FOREIGN KEY (receipt_id) REFERENCES goods_receipts(id), FOREIGN KEY (po_item_id) REFERENCES purchase_order_items(id)) ENGINE=InnoDB;

INSERT IGNORE INTO permissions (code,label) VALUES ('reservations.manage','Manage reservations'),('purchases.manage','Create purchase orders & receive stock'),('purchases.approve','Approve purchase orders');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name IN ('owner','manager') AND p.code IN ('reservations.manage','purchases.manage','purchases.approve');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name IN ('cashier','waiter') AND p.code='reservations.manage';
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name='inventory_manager' AND p.code='purchases.manage';

INSERT IGNORE INTO settings (key_name,value_text) SELECT 'base_currency', value_text FROM settings WHERE key_name='currency';
INSERT IGNORE INTO settings (key_name,value_text) VALUES ('base_currency','USD'),('exchange_rate','1'),('ui_theme','ocean'),('receipt_theme','classic'),('online_ordering_enabled','1'),('online_delivery_enabled','1'),('online_min_order','0'),('loyalty_points_per_unit','1');
