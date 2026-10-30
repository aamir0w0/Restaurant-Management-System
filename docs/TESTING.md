# Testing
1. `php -l` every file: `Get-ChildItem backend -Recurse -Filter *.php | % { C:\xampp\php\php.exe -l $_.FullName }`
2. Import schema + seed; run `backend/tests/smoke.php` (covers login, bad login, create menu/ingredient/recipe, order creation, idempotent resubmit, invalid quantity, invalid transition, kitchen visibility, single stock deduction, overpayment rejection, partial/idempotent payment, completion rules, dashboard, logout → 401).
3. Manual: create a Cashier user (Users page) and verify the Users, Settings and Reports pages/APIs return 403; refund needs `payments.refund` (manager/owner); cancel an order and confirm the audit entry; check the receipt print preview.
4. `cd frontend && npm install && npm run build`; open at 360px, 768px and 1280px widths.
Results of these steps have **not** been recorded yet — add them to PROJECT_STATUS.md.
