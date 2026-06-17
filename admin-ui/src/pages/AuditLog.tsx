import React, { useEffect, useState } from 'react';
import { api, AuditEntry, ScanRecord } from '../api/client';
import { ScrollText, Filter, Calendar, ShieldCheck, ShieldAlert } from 'lucide-react';

const EVENT_COLORS: Record<string, string> = {
  SCAN_START: 'badge-info',
  PLAN_CREATED: 'badge-info',
  AGENT_DELEGATED: 'badge-info',
  FINDING_ADDED: 'badge-warning',
  FINDING_VALIDATED: 'badge-success',
  SCAN_COMPLETE: 'badge-success',
  SCAN_FAILED: 'badge-critical',
};

function evtBadge(type: string) {
  return EVENT_COLORS[type] ?? 'text-slate-400 bg-slate-100';
}

function fmtTs(ts?: string): string {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

function AuditLogSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 bg-slate-200 rounded-md" />
          <div className="h-4 w-56 bg-slate-100 rounded-md" />
        </div>
        <div className="h-9 w-44 bg-slate-100 rounded-md" />
      </div>
      <div className="h-[400px] bg-slate-100 rounded-md" />
    </div>
  );
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [scanFilter, setScanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getScans(1, 100).then(({ scans: s }) => setScans(s)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getAuditLog(scanFilter || undefined)
      .then(setEntries)
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setLoading(false));
  }, [scanFilter]);

  if (loading) return <AuditLogSkeleton />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">{error ? 'Could not load events.' : `${entries.length} event${entries.length !== 1 ? 's' : ''} recorded.`}</p>
        </div>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <select
            value={scanFilter}
            onChange={(e) => setScanFilter(e.target.value)}
            className="input pl-9 pr-8 py-2 text-xs cursor-pointer appearance-none"
            aria-label="Filter by scan"
          >
            <option value="">All events</option>
            {scans.map((s) => (
              <option key={s.id} value={s.id}>{s.projectName} ({s.id.slice(0, 8)})</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="card p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-armor-critical" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700 mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary btn-sm">Retry</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {entries.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <ScrollText className="w-10 h-10 mx-auto mb-3 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium">No audit events recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Timestamp', 'Event', 'Agent', 'Action', 'Target', 'Plan ID'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{fmtTs(e.createdAt)}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${evtBadge(e.eventType)}`}>{e.eventType}</span></td>
                      <td className="text-slate-600 font-medium text-xs font-mono">{e.agentName ?? 'system'}</td>
                      <td className="text-slate-700 text-sm max-w-[280px] truncate" title={e.action}>{e.action}</td>
                      <td className="text-slate-400 text-xs font-mono max-w-[180px] truncate" title={e.target}>{e.target ?? '—'}</td>
                      <td>
                        {e.armorIqPlanId ? (
                          <span className="badge badge-info">
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                            <span>{String(e.armorIqPlanId).slice(0, 10)}</span>
                          </span>
                        ) : <span className="text-slate-300 text-xs font-mono">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
