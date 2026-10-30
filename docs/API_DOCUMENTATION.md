# API (base `/api/v1`)
Responses: `{success, message, data, meta?}`; errors: `{success:false, message, errors:{field:msg}}`. Auth: session cookie `RMSSESSID` (HTTP-only, SameSite=Lax). Send header `X-CSRF-Token` (from login/me) on POST/PUT/DELETE. Credentials must be included (`withCredentials`).

| Method & path | Permission |
|---|---|
| POST /auth/login · POST /auth/logout · GET /auth/me · POST /auth/change-password | public / session |
| GET/POST /users, PUT /users/{id}; GET /roles; PUT /roles/{id}/permissions | users.manage / roles.manage |
| GET /settings (any user) · PUT /settings | settings.manage |
| GET/POST/PUT/DELETE /categories, /menu-items (+ POST /menu-items/{id}/image), GET/POST/PUT /modifier-groups | menu.view / menu.manage (price: menu.price) |
| GET/POST/PUT/DELETE /tables, PUT /tables/{id}/status | tables.view / tables.manage |
| GET/POST/PUT/DELETE /customers | customers.view / customers.manage |
| GET /orders, GET /orders/{id}, POST /orders, PUT /orders/{id}/status, POST /orders/{id}/transfer | orders.view / orders.create / orders.update (+cancel, discount) |
| POST /orders/{id}/payments · POST /orders/{id}/refunds | payments.create · payments.refund |
| GET /kitchen/orders | kitchen.view |
| GET/POST /inventory/ingredients, PUT /inventory/ingredients/{id}, POST /inventory/adjustments, GET /inventory/movements, GET/PUT /menu-items/{id}/recipe | inventory.view / inventory.adjust |
| GET/POST/PUT/DELETE /suppliers · /expenses | suppliers.manage · expenses.view/manage |
| GET /dashboard?from&to · GET /reports/{type}?from&to&format=csv · GET /reports/profit-estimate | dashboard.view · reports.view |
| GET /notifications · POST /notifications/read-all · GET /audit-logs | session · audit.view |

Create order body: `{order_type, table_id?, customer_id?, delivery_address?, notes?, discount_amount?, idempotency_key, items:[{menu_item_id, variant_id?, modifier_ids?, quantity, notes?}]}` — totals are always recomputed server-side. Payment body: `{method, amount, tendered?, reference?, idempotency_key}`. List endpoints accept `page, per_page, q, sort, dir`.

## Added endpoints
Public (no login, rate limited): `GET /public/config`, `GET /public/menu`, `POST /public/orders` ({order_type: takeaway|delivery, customer:{name,phone,email?}, delivery_address?, notes?, pay_method: cash|card, idempotency_key, items[]}), `GET /public/orders/{number}?phone=`, `POST /public/webhooks/stripe` (signature-verified).
Staff: `GET/POST/PUT /reservations`, `PUT /reservations/{id}/status` (reservations.manage); `GET/POST /purchases`, `GET /purchases/{id}`, `POST /purchases/{id}/approve|cancel|receive` (purchases.manage / purchases.approve); `GET /customers/{id}/profile`, `POST /customers/{id}/loyalty` (customers.view / customers.manage).
