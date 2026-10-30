import { useState } from 'react';
import { useFetch } from '../components/useFetch';
import { PageHeader, Card, Table, Badge } from '../components/ui';
import { dt } from '../utils/format';
export default function Audit() {
  const [action, setAction] = useState(''); const { data, loading, error, reload } = useFetch('/audit-logs', { action, per_page: 100 });
  return (<><PageHeader title="Audit log" subtitle="Security and business-critical events" /><Card><div className="border-b border-line p-3"><input className="input max-w-xs" placeholder="Filter by action (e.g. refund_issued)" value={action} onChange={(e) => setAction(e.target.value)} /></div>
    <Table rows={data} loading={loading} error={error} retry={reload} empty="No events" columns={[{ key: 'created_at', label: 'When', render: (r) => dt(r.created_at) }, { key: 'user_name', label: 'User', render: (r) => r.user_name || '—' }, { key: 'action', label: 'Action', render: (r) => <Badge value={r.action} tone="gray" /> }, { key: 'entity', label: 'Entity', render: (r) => `${r.entity || ''} ${r.entity_id || ''}` }, { key: 'summary', label: 'Summary' }, { key: 'ip', label: 'IP' }]} /></Card></>);
}
