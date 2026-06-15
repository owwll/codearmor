import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Activity, Calendar, ShieldAlert } from 'lucide-react';
import { api, ScanRecord } from '../api/client';

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]';
  if (score >= 50) return 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]';
  return                  'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]';
}

function fmtDuration(ms?: number): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const PAGE_SIZE = 15;

export default function Scans() {
  const [scans, setScans]   = useState<ScanRecord[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getScans(page, PAGE_SIZE)
      .then(({ scans: s, total: t }) => { setScans(s); setTotal(t); })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none bg-[#F8FAFC]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Threat Logs</h1>
          <p className="text-sm text-slate-500">History of all vulnerability inspections performed across active workspaces.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-650">
            <span className="text-slate-900 font-mono font-extrabold">{total}</span> Scans Completed
          </span>
        </div>
      </div>

      {/* Table Card */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <span className="text-2xl animate-spin text-indigo-650">🛡️</span>
            <p className="text-xs text-slate-500">Retrieving scan execution list...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cyber-table">
              <thead>
                <tr>
                  {['Project / Path', 'Security Score', 'Critical', 'Warning', 'Info', 'Duration', 'Date', 'Status', ''].map((h) => (
                    <th key={h} className="text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-slate-500 bg-white">
                      <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                      <p className="text-sm font-semibold">No scans found</p>
                    </td>
                  </tr>
                )}
                {scans.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <p className="text-slate-900 font-bold text-sm truncate max-w-[200px]">{s.projectName}</p>
                      <p className="text-slate-450 text-xs truncate max-w-[240px] font-mono mt-0.5">{s.projectPath}</p>
                    </td>
                    <td>
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 font-bold ${scoreBadge(s.score)}`}>
                        {s.score}
                      </span>
                    </td>
                    <td className="text-[#EF4444] font-bold text-sm">{s.criticalCount ?? 0}</td>
                    <td className="text-[#F59E0B] font-bold text-sm">{s.warningCount ?? 0}</td>
                    <td className="text-sky-600 font-bold text-sm">{s.infoCount ?? 0}</td>
                    <td className="text-slate-500 text-xs font-mono">{fmtDuration(s.durationMs)}</td>
                    <td>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-slate-450" />
                        <span>{new Date(s.startedAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                        s.status === 'complete' 
                          ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20' 
                          : s.status === 'failed' 
                          ? 'bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20' 
                          : 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <Link 
                        to={`/scans/${s.id}`} 
                        className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 transition-all"
                      >
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500 font-semibold">Showing page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{totalPages}</span></span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 text-xs rounded-xl border border-slate-350 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 text-xs rounded-xl border border-slate-350 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
