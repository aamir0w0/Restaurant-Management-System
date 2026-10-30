import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import { Spinner } from './components/ui';
import Login from './pages/Login'; import Dashboard from './pages/Dashboard'; import POS from './pages/POS'; import Orders from './pages/Orders'; import Kitchen from './pages/Kitchen';
import Tables from './pages/Tables'; import Menu from './pages/Menu'; import Inventory from './pages/Inventory'; import Reports from './pages/Reports'; import Users from './pages/Users';
import Settings from './pages/Settings'; import Audit from './pages/Audit'; import { Categories, Suppliers, Expenses } from './pages/CrudPages';
import Payments from './pages/Payments';
import Customers from './pages/Customers'; import Reservations from './pages/Reservations'; import Purchases from './pages/Purchases'; import Storefront, { Track } from './pages/Storefront';

function Guard({ perm, children }) {
  const { can } = useAuth();
  return can(perm) ? children : <div className="py-20 text-center text-muted">You do not have access to this page.</div>;
}
export default function App() {
  const { user, loading, can } = useAuth(); const loc = useLocation();
  if (loc.pathname.startsWith('/store')) return <Routes><Route path="/store" element={<Storefront />} /><Route path="/store/track/:number" element={<Track />} /><Route path="*" element={<Navigate to="/store" replace />} /></Routes>;
  if (loading) return <Spinner />;
  if (!user) return loc.pathname === '/login' ? <Login /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const home = can('dashboard.view') ? '/' : can('orders.create') ? '/pos' : can('kitchen.view') ? '/kitchen' : '/orders';
  const R = (path, perm, el) => <Route path={path} element={<Guard perm={perm}>{el}</Guard>} />;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to={home} replace />} />
      <Route element={<AppLayout />}>
        <Route index element={can('dashboard.view') ? <Dashboard /> : <Navigate to={home} replace />} />
        {R('pos', 'orders.create', <POS />)}{R('orders', 'orders.view', <Orders />)}{R('kitchen', 'kitchen.view', <Kitchen />)}{R('tables', 'tables.view', <Tables />)}
        {R('menu', 'menu.view', <Menu />)}{R('categories', 'menu.view', <Categories />)}{R('customers', 'customers.view', <Customers />)}{R('inventory', 'inventory.view', <Inventory />)}
        {R('suppliers', 'suppliers.manage', <Suppliers />)}{R('expenses', 'expenses.view', <Expenses />)}{R('reports', 'reports.view', <Reports />)}
        {R('payments', 'payments.view', <Payments />)}{R('reservations', 'reservations.manage', <Reservations />)}{R('purchases', 'purchases.manage', <Purchases />)}{R('users', 'users.manage', <Users />)}{R('settings', 'settings.view', <Settings />)}{R('audit', 'audit.view', <Audit />)}
        <Route path="*" element={<div className="py-20 text-center text-muted">Page not found.</div>} />
      </Route>
    </Routes>
  );
}
