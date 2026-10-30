# Restaurant Management System

React + Vite + Tailwind frontend, plain-PHP 8.2 REST API (PDO, sessions), MySQL (InnoDB). Windows / XAMPP friendly.

> **Read `PROJECT_STATUS.md` first.** This is a working core (auth/RBAC, menu, POS, orders, payments/refunds, kitchen, tables, inventory + recipes, customers, expenses, reports, audit, settings). Reservations, loyalty, purchase orders, employees/attendance and payroll are **not implemented**. The code was written in an environment without PHP, MySQL or internet, so **nothing has been executed yet** — follow the verification steps below.

## Prerequisites
XAMPP (Apache + MySQL/MariaDB, PHP ≥ 8.2 with `pdo_mysql`, `fileinfo`), Node.js 18+, npm.

## Install (Windows / XAMPP)
1. Copy this folder to `C:\xampp\htdocs\restaurant-management-system`.
2. Start Apache and MySQL in the XAMPP control panel. Enable `mod_rewrite` (default on).
3. Import the database (phpMyAdmin → Import, or CLI):
   ```
   C:\xampp\mysql\bin\mysql -u root < database\schema.sql
   C:\xampp\mysql\bin\mysql -u root < database\seed.sql
   C:\xampp\mysql\bin\mysql -u root < database\migrations\002_online_theme_currency_modules.sql
   C:\xampp\mysql\bin\mysql -u root < database\migrations\003_payments_whatsapp_store_content.sql
   ```
   `seed.sql` is safe to re-run; it creates roles, permissions and default settings (**no users**). Migration 002 adds online ordering, multi-currency, theme, reservations, purchasing and loyalty tables (MariaDB syntax, see the file header for MySQL 8). Optional demo data: `database\demo_seed.sql` (run after the migration).
4. Backend config: copy `backend\.env.example` to `backend\.env` and set DB credentials, `APP_TIMEZONE`, `CORS_ORIGINS`. Set `APP_DEBUG=false` in production. (`.env` lives outside `public/`.)
5. Create the first administrator (password is typed interactively, never stored in files):
   ```
   C:\xampp\php\php.exe backend\bin\create-admin.php
   ```
6. API base URL: `http://localhost/restaurant-management-system/backend/public/api/v1`. Check `.../api/v1/auth/me` returns a JSON 401.
7. Frontend:
   ```
   cd frontend
   copy .env.example .env
   npm install
   npm run dev        # http://localhost:5173 (Vite proxies /api and /uploads to Apache)
   ```
8. Sign in, then: Settings (name, currency, tax) → Categories → Menu → Inventory (ingredients) → recipes in the menu item dialog → Tables → POS.

## Production build
`npm run build` → upload `frontend/dist` to your web root. Set `VITE_API_URL` at build time to your API origin if it differs, and add that origin to `CORS_ORIGINS`. Serve over HTTPS (session cookie becomes `Secure` automatically). Use a dedicated MySQL user with only the needed privileges. Block web access to `backend/src`, `backend/storage`, `backend/bin`, `backend/.env` (only `backend/public` should be the document root where the host allows it).
Check before deploying: PHP ≥ 8.2, `pdo_mysql`, `fileinfo`, writeable `backend/storage/logs` and `backend/public/uploads`, `mod_rewrite`/`.htaccess` support, HTTPS.

## Testing
- API smoke test (needs running stack + admin): `php backend/tests/smoke.php http://localhost/restaurant-management-system/backend/public you@example.com "password"`
- Frontend: `npm run build` must succeed. See `docs/TESTING.md`.

## Backup & restore (manual — no automated backups are configured)
```
C:\xampp\mysql\bin\mysqldump -u root --single-transaction --routines restaurant_management_system > backup_2026-01-01.sql
C:\xampp\mysql\bin\mysql -u root restaurant_management_system < backup_2026-01-01.sql
```
Also copy `backend/public/uploads`. Keep backups outside the web root. Schedule with Windows Task Scheduler / cron if desired.

## Troubleshooting
- *404 on every API call*: `.htaccess` not honoured → set `AllowOverride All` for htdocs.
- *CORS / 403 CSRF*: add the frontend origin to `CORS_ORIGINS`; the CSRF token comes from `/auth/me` and `/auth/login`.
- *"Internal server error"*: set `APP_DEBUG=true` temporarily and read `backend/storage/logs/app.log`.
- *Wrong dates around midnight*: `APP_TIMEZONE` drives both PHP and the MySQL session time zone.

## Online ordering website, card payments, currency, themes
- **Customer website:** `http://localhost:5173/store` (staff app: `/`). Customers order pickup/delivery, pay on collection or by card, and track the order at `/store/track/<number>?phone=<phone>`. Orders appear in Orders (badge "Online") and the kitchen. Each customer is matched by phone number or created in **Customers (CRM)** with source "online"; spend, order history and loyalty points are on their profile.
- **Production routing:** serve `frontend/dist` with an SPA fallback so `/store/*` returns `index.html` (Apache: `FallbackResource /index.html`, or an equivalent rewrite rule).
- **Card payments (Stripe Checkout):** set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STORE_URL` in `backend/.env`. Create a webhook endpoint in Stripe pointing to `<API base>/api/v1/public/webhooks/stripe` for the event `checkout.session.completed`. For local testing use the Stripe CLI (`stripe listen --forward-to ...`) and **test keys**. An order is marked paid **only** by the signed webhook. Stripe availability depends on your business country; other gateways (e.g. PayFast, JazzCash, Easypaisa) would need a new provider class next to `StripeService.php` and merchant credentials — not included. Staff can still record card-terminal/cash/other payments manually in the order dialog.
- **PKR / currency conversion:** in Settings set *Base currency* (e.g. USD, the currency you enter menu prices in), *Selling currency* (e.g. PKR) and the *exchange rate* (1 USD = 280 PKR). Every unit price is converted once and rounded to the currency's precision (PKR = whole rupees); totals are sums of those rounded prices, so receipts and payments never show a gap. Each order stores its currency and rate. Rates are **manual** (no live FX feed). If you change the rate later, old orders keep their original rate; dashboards/reports add up stored amounts, so avoid switching the selling currency mid-period.
- **Themes (Super Admin only):** Settings → Appearance: 5 colour themes (default "Ocean Teal" from your reference design) and 3 receipt layouts (classic, modern, minimal).
- **New modules:** Reservations (capacity + overlap checks), Purchasing (draft → approved → partial/full receiving → stock), loyalty points (earned once per completed order), CRM profile.

## Notifications, order alert, payments page, WhatsApp (revision 3)
- **Notifications:** new orders, reservations, purchase approvals, low stock and payments create notifications. The bell and each sidebar module (Orders, Kitchen, Payments, Reservations, Purchasing, Inventory) show an unread **number**. Opening a notification, opening its module, or "Mark all read" clears it. The inbox is **shared**: when one admin reads a notification it is cleared for all staff. Staff only see types they have permission for. The page polls every 8 seconds (no websockets).
- **New-order alert:** a centred animated square card appears when a new order arrives (sound plays once the browser has had a click/tap). It is queued if several arrive, and auto-dismisses after 20 s.
- **Payments page:** records of every payment with totals for online card, cash, card terminal and other (permission `payments.view`, added by migration 003); the dashboard also shows collections by method.
- **WhatsApp thank-you (Meta WhatsApp Cloud API):** requires a Meta Business account, a WhatsApp phone number, and an **approved message template** (business-initiated messages cannot be free text). Create a template named `order_thank_you` (language `en`) with 3 variables, e.g. `Hi {{1}}, thank you for your order {{2}} at {{3}}! We will update you when it is ready.` Then put `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_ID` in `backend/.env` and tick the option in Settings. Local numbers starting with 0 are converted using the country code in Settings (92 = Pakistan). A failed send never blocks the order; see the Audit Log (`whatsapp_failed`).
