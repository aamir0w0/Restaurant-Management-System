# Project status (honest snapshot)

## Verification performed
| Check | Result |
|---|---|
| All 27 frontend `.js/.jsx` files parsed with the TypeScript parser (syntax only) | 0 syntax errors |
| `npm install` / `npm run build` | **Not run** – no network in the build environment |
| PHP lint, DB import, API calls, `backend/tests/smoke.php` | **Not run** – PHP and MySQL were not available |
| UI / responsive layout in a browser | **Not run** |

Expect to fix some typos/integration bugs on first run. Run in this order: import schema → seed → `create-admin.php` → `smoke.php` → `npm install && npm run build` → manual UI pass.

## Implemented (code written, unexecuted)
Session auth (HTTP-only cookie, regenerated ID, idle timeout, CSRF header, login throttling 5/15 min, password change) · configurable role/permission RBAC enforced per endpoint · user management · settings (tax, service, delivery, payment methods, receipt footer) · categories, menu items, variants, modifier groups, image upload (type/size checked) · price-change permission + audit · POS with server-side totals, idempotent order creation, discount permission · order state machine + history, cancellation (requires reason; blocked while payment un-refunded) · cash/other payments, partial payments, overpayment blocked, idempotent retries, refunds, separate order/payment status · kitchen display with polling · tables (status, transfer) · customers with spend stats · ingredients, recipes, ledgered stock movements (opening/sale/adjust/wastage/spoilage/return/purchase), once-only sale deduction at `preparing` (unique ledger key), low-stock notifications (deduplicated) · suppliers directory · expenses · dashboard + 13 reports + CSV export + estimated-profit endpoint · notifications · audit log · receipts (browser print).

## Added in revision 2 (also unexecuted)
Theme engine (5 themes, Super Admin only) + 3 receipt layouts · redesigned dashboard/sidebar/login · base→selling currency conversion done server-side (PKR whole-rupee rounding) · public ordering API + customer website + order tracking · CRM link (online customers auto-created by phone, profile with orders/points) · Stripe Checkout + signed webhook (idempotent, amount-verified) · reservations · purchase orders with approval and partial receiving · loyalty earn/adjust · order source filter.
Requires migration `database/migrations/002_online_theme_currency_modules.sql`.
Known gaps in revision 2: Stripe only (no PayFast/JazzCash/Easypaisa); card refunds must also be issued in the Stripe dashboard; exchange rates are manual; online-order SMS/email notifications are not sent; no multi-outlet support; website has no opening-hours check; reservations do not auto-change table status.

## Revision 3 (unexecuted)
Per-module notification numbers + shared read/clear · centre-screen animated new-order alert · Payments page + dashboard breakdown (online vs cash) · WhatsApp template message on new orders (needs Meta setup) · professional storefront (hero, popular items, how-it-works, about/contact, FAQ, footer, WhatsApp chat button) · fixes: PHP quote bug in order detail query, theme validation bug, POS orders were not recording the cashier.
Run migration 003. Not done: real-time push (polling only), WhatsApp delivery receipts/replies, per-user (non-shared) notification read state.

## Not implemented
Employees, shifts, attendance, payroll · loyalty redemption at checkout (manual adjustments only) · multi-outlet · expense approval workflow & attachments · logo upload · business hours · unit conversion in recipes · password-reset-by-email · automated backups · PHPUnit/Jest automated suites (only the HTTP smoke script) · supplier reports.

## Business rules (as coded)
- Net sales = Σ(subtotal) − discounts − refunds (cancelled orders excluded); taxes/service shown separately. Estimated profit = net sales − recipe ingredient cost (sale movements) − expenses; labelled as an estimate.
- Stock is deducted once when an order enters `preparing`; cancelling/refunding never returns stock (use Wastage/Return/Adjustment). Insufficient stock follows setting `allow_negative_stock`.
- Completion requires `payment_status = paid`.
- Reports/dashboard filter by `DATE(created_at)` in the app time zone.

## Known limitations
Kitchen status updates need `orders.update` or `kitchen.update` (chef has the latter but status route also checks inside the service). Order-level CSV is not exported. Menu/ingredient list pagination is light. Only `cash` collects tendered/change.
