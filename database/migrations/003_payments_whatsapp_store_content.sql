-- Run after 002. Safe to re-run.
USE restaurant_management_system;
INSERT IGNORE INTO permissions (code,label) VALUES ('payments.view','View payment records');
INSERT IGNORE INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r JOIN permissions p WHERE r.name IN ('owner','manager','accountant','cashier') AND p.code='payments.view';
INSERT IGNORE INTO settings (key_name,value_text) VALUES ('whatsapp_enabled','0'),('whatsapp_country_code','92'),('whatsapp_notify_pos','0'),
 ('store_tagline','Fresh, hot and made to order'),('store_about','We cook every order fresh in our kitchen. Order online for pickup or delivery and track it live.'),('store_hours','');
