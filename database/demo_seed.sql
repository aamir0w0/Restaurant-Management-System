-- DEMO DATA for testing. Safe to re-run (skips rows that already exist). Run AFTER schema.sql and seed.sql.
USE restaurant_management_system;

INSERT INTO settings (key_name,value_text) VALUES ('restaurant_name','Demo Bistro'),('currency','USD'),('tax_rate','5'),('service_charge_rate','10'),('delivery_charge','2.50'),('address','12 Market Street'),('phone','+1 555 0100')
ON DUPLICATE KEY UPDATE value_text=VALUES(value_text);

INSERT IGNORE INTO categories (name,sort_order) VALUES ('Burgers',1),('Pizza',2),('Coffee',3),('Desserts',4);

-- Menu items
INSERT INTO menu_items (category_id,name,description,base_price,prep_minutes)
SELECT c.id, d.name, d.descr, d.price, d.prep FROM (
  SELECT 'Burgers' cat,'Classic Beef Burger' name,'Beef patty, lettuce, tomato, house sauce' descr,8.50 price,12 prep UNION ALL
  SELECT 'Burgers','Cheese Burger','Beef patty with melted cheese',9.50,12 UNION ALL
  SELECT 'Burgers','Chicken Burger','Crispy chicken fillet, mayo, lettuce',8.00,12 UNION ALL
  SELECT 'Pizza','Margherita','Tomato, mozzarella, basil',11.00,18 UNION ALL
  SELECT 'Pizza','Pepperoni','Tomato, mozzarella, pepperoni',13.00,18 UNION ALL
  SELECT 'Coffee','Cappuccino','Espresso with steamed milk foam',4.00,5 UNION ALL
  SELECT 'Coffee','Latte','Espresso with steamed milk',4.50,5 UNION ALL
  SELECT 'Coffee','Espresso','Double shot',3.00,3 UNION ALL
  SELECT 'Desserts','Chocolate Brownie','Warm brownie',5.00,4 UNION ALL
  SELECT 'Desserts','Cheesecake','New York style slice',6.00,3
) d JOIN categories c ON c.name=d.cat
WHERE NOT EXISTS (SELECT 1 FROM menu_items m WHERE m.name=d.name);

-- Variants (sizes)
INSERT INTO menu_item_variants (menu_item_id,name,price_delta)
SELECT m.id, v.vname, v.delta FROM (
  SELECT 'Margherita' item,'Small' vname,0 delta UNION ALL SELECT 'Margherita','Medium',3 UNION ALL SELECT 'Margherita','Large',6 UNION ALL
  SELECT 'Pepperoni','Small',0 UNION ALL SELECT 'Pepperoni','Medium',3 UNION ALL SELECT 'Pepperoni','Large',6 UNION ALL
  SELECT 'Cappuccino','Regular',0 UNION ALL SELECT 'Cappuccino','Large',1 UNION ALL
  SELECT 'Latte','Regular',0 UNION ALL SELECT 'Latte','Large',1
) v JOIN menu_items m ON m.name=v.item
WHERE NOT EXISTS (SELECT 1 FROM menu_item_variants x WHERE x.menu_item_id=m.id AND x.name=v.vname);

-- Modifier groups and modifiers
INSERT INTO modifier_groups (name,min_select,max_select)
SELECT 'Burger Extras',0,3 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modifier_groups WHERE name='Burger Extras');
INSERT INTO modifier_groups (name,min_select,max_select)
SELECT 'Milk Choice',0,1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM modifier_groups WHERE name='Milk Choice');
INSERT INTO modifiers (group_id,name,price)
SELECT g.id, x.name, x.price FROM (
  SELECT 'Burger Extras' grp,'Extra Cheese' name,1.00 price UNION ALL SELECT 'Burger Extras','Bacon',1.50 UNION ALL SELECT 'Burger Extras','Extra Patty',3.00 UNION ALL
  SELECT 'Milk Choice','Oat Milk',0.75 UNION ALL SELECT 'Milk Choice','Almond Milk',0.75
) x JOIN modifier_groups g ON g.name=x.grp
WHERE NOT EXISTS (SELECT 1 FROM modifiers m WHERE m.group_id=g.id AND m.name=x.name);
INSERT IGNORE INTO menu_item_modifier_groups (menu_item_id,group_id)
SELECT m.id,g.id FROM menu_items m JOIN modifier_groups g ON
 (g.name='Burger Extras' AND m.name IN ('Classic Beef Burger','Cheese Burger','Chicken Burger')) OR (g.name='Milk Choice' AND m.name IN ('Cappuccino','Latte'));

-- Ingredients (Pepperoni is deliberately below minimum to trigger a low-stock alert)
INSERT INTO ingredients (name,unit,cost_per_unit,min_stock,quantity_on_hand)
SELECT d.name,d.unit,d.cost,d.minstock,d.qty FROM (
  SELECT 'Burger Bun' name,'pcs' unit,0.30 cost,20 minstock,100 qty UNION ALL SELECT 'Beef Patty','pcs',1.20,20,80 UNION ALL SELECT 'Cheese Slice','pcs',0.25,20,120 UNION ALL
  SELECT 'Chicken Fillet','pcs',1.00,15,50 UNION ALL SELECT 'Pizza Dough Ball','pcs',0.60,10,40 UNION ALL SELECT 'Mozzarella','g',0.012,1000,8000 UNION ALL
  SELECT 'Tomato Sauce','ml',0.004,1000,6000 UNION ALL SELECT 'Pepperoni','g',0.02,500,400 UNION ALL SELECT 'Coffee Beans','g',0.03,500,2000 UNION ALL SELECT 'Milk','ml',0.002,2000,15000
) d WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.name=d.name);
INSERT INTO stock_movements (ingredient_id,movement_type,quantity,balance_after,reason)
SELECT i.id,'opening',i.quantity_on_hand,i.quantity_on_hand,'Demo opening balance' FROM ingredients i
WHERE i.name IN ('Burger Bun','Beef Patty','Cheese Slice','Chicken Fillet','Pizza Dough Ball','Mozzarella','Tomato Sauce','Pepperoni','Coffee Beans','Milk')
AND NOT EXISTS (SELECT 1 FROM stock_movements s WHERE s.ingredient_id=i.id);

-- Recipes (quantity consumed per item sold)
INSERT IGNORE INTO recipe_items (menu_item_id,ingredient_id,quantity)
SELECT m.id,i.id,r.q FROM (
  SELECT 'Classic Beef Burger' item,'Burger Bun' ing,1 q UNION ALL SELECT 'Classic Beef Burger','Beef Patty',1 UNION ALL
  SELECT 'Cheese Burger','Burger Bun',1 UNION ALL SELECT 'Cheese Burger','Beef Patty',1 UNION ALL SELECT 'Cheese Burger','Cheese Slice',1 UNION ALL
  SELECT 'Chicken Burger','Burger Bun',1 UNION ALL SELECT 'Chicken Burger','Chicken Fillet',1 UNION ALL
  SELECT 'Margherita','Pizza Dough Ball',1 UNION ALL SELECT 'Margherita','Mozzarella',120 UNION ALL SELECT 'Margherita','Tomato Sauce',80 UNION ALL
  SELECT 'Pepperoni','Pizza Dough Ball',1 UNION ALL SELECT 'Pepperoni','Mozzarella',120 UNION ALL SELECT 'Pepperoni','Tomato Sauce',80 UNION ALL SELECT 'Pepperoni','Pepperoni',60 UNION ALL
  SELECT 'Cappuccino','Coffee Beans',18 UNION ALL SELECT 'Cappuccino','Milk',150 UNION ALL
  SELECT 'Latte','Coffee Beans',18 UNION ALL SELECT 'Latte','Milk',220 UNION ALL SELECT 'Espresso','Coffee Beans',18
) r JOIN menu_items m ON m.name=r.item JOIN ingredients i ON i.name=r.ing;

-- Tables
INSERT IGNORE INTO dining_tables (number,section,capacity) VALUES ('T1','Indoor',2),('T2','Indoor',2),('T3','Indoor',4),('T4','Indoor',4),('T5','Indoor',6),('P1','Patio',4),('P2','Patio',4),('P3','Patio',8);

-- Customers, suppliers, expenses
INSERT INTO customers (name,phone,email)
SELECT d.n,d.p,d.e FROM (SELECT 'Sara Khan' n,'+1 555 0111' p,'sara@example.com' e UNION ALL SELECT 'John Miller','+1 555 0122','john@example.com' UNION ALL SELECT 'Aisha Ali','+1 555 0133','aisha@example.com') d
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.name=d.n);
INSERT INTO suppliers (name,contact_name,phone,email,address)
SELECT d.n,d.c,d.p,d.e,d.a FROM (SELECT 'Fresh Farm Produce' n,'Omar' c,'+1 555 0201' p,'orders@freshfarm.example' e,'5 Farm Road' a UNION ALL SELECT 'Prime Meats Ltd','Linda','+1 555 0202','sales@primemeats.example','90 Industrial Ave') d
WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE s.name=d.n);
INSERT INTO expenses (category,amount,expense_date,description,payment_method,vendor)
SELECT d.c,d.a,CURDATE(),d.ds,'cash',d.v FROM (SELECT 'Utilities' c,120.00 a,'Demo electricity bill' ds,'City Power' v UNION ALL SELECT 'Supplies',45.50,'Demo cleaning supplies','CleanCo') d
WHERE NOT EXISTS (SELECT 1 FROM expenses e WHERE e.description=d.ds);
