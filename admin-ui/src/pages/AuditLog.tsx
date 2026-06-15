import React, { useEffect, useState } from 'react';
import { api, AuditEntry, ScanRecord } from '../api/client';
import { ScrollText, Filter, Calendar, ShieldCheck } from 'lucide-react';

const EVENT_COLORS: Record<string, string> = {
  SCAN_START:       'bg-sky-100    text-sky-700      border-sky-200',
  PLAN_CREATED:     'bg-purple-100 text-purple-700   border-purple-200',
  AGENT_DELEGATED:  'bg-blue-100   text-blue-700     border-blue-200',
  FINDING_ADDED:    'bg-amber-100  text-amber-700    border-amber-200',
  FINDING_VALIDATED:'bg-emerald-100 text-emerald-700 border-emerald-200',
  SCAN_COMPLETE:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  SCAN_FAILED:      'bg-rose-100   text-rose-700     border-rose-200',
};

function evtBadge(type: string) {
  return EVENT_COLORS[type] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

function fmtTs(ts?: string): string {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [scans, setScans]     = useState<ScanRecord[]>([]);
  const [scanFilter, setScanFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getScans(1, 100).then(({ scans: s }) => setScans(s)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api.getAuditLog(scanFilter || undefined)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [scanFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Audit Trail</h1>
          <p className="text-sm text-slate-500">Tamper-evident log registry validating the compliance verification execution sequence.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-450">
              <Filter className="w-3.5 h-3.5" />
            </span>
            <select
              value={scanFilter}
              onChange={(e) => setScanFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-650 focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer appearance-none shadow-sm"
            >
              <option value="">All Verification Logs</option>
              {scans.map((s) => (
                <option key={s.id} value={s.id}>{s.projectName} ({s.id.slice(0, 8)})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <span className="text-2xl animate-spin text-indigo-650">🛡️</span>
            <p className="text-xs text-slate-500">Retrieving audit trace events...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cyber-table">
              <thead>
                <tr>
                  {['Timestamp', 'Event Type', 'Responsible Agent', 'Action Executed', 'Target Element', 'CodeArmor Block ID'].map((h) => (
                    <th key={h} className="text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-slate-500 bg-white">
                      <ScrollText className="w-10 h-10 mx-auto mb-3 text-slate-450" />
                      <p className="text-sm font-semibold">No audit logs recorded</p>
                    </td>
                  </tr>
                )}
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{fmtTs(e.createdAt)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1 font-bold uppercase ${evtBadge(e.eventType)}`}>
                        {e.eventType}
                      </span>
                    </td>
                    <td className="text-slate-700 font-bold text-xs font-mono">{e.agentName ?? 'system'}</td>
                    <td className="text-slate-800 text-sm max-w-[280px] truncate" title={e.action}>{e.action}</td>
                    <td className="text-slate-500 text-xs font-mono max-w-[180px] truncate" title={e.target}>{e.target ?? '—'}</td>
                    <td>
                      {e.armorIqPlanId ? (
                        <span className="inline-flex items-center gap-1 bg-[#EEF2FF] border border-indigo-200 text-indigo-700 text-xs rounded-lg px-2 py-1 font-mono font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{String(e.armorIqPlanId).slice(0, 10)}</span>
                        </span>
                      ) : <span className="text-slate-400 text-xs font-mono">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 text-center font-medium">
        Verified logs display <span className="text-slate-900">{entries.length}</span> compliance trace events. Cryptographic verification keys are generated automatically.
      </p>
    </div>
  );
}
