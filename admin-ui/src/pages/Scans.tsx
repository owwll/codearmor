import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, ShieldAlert, Search, ArrowUpRight } from 'lucide-react';
import { api, ScanRecord } from '../api/client';

function scoreBadge(score: number) {
  if (score >= 80) return 'badge-success';
  if (score >= 50) return 'badge-warning';
  return 'badge-critical';
}

function fmtDuration(ms?: number): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const PAGE_SIZE = 15;

function ScansSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 bg-slate-200 rounded-md" />
          <div className="h-4 w-64 bg-slate-100 rounded-md" />
        </div>
        <div className="h-9 w-48 bg-slate-100 rounded-md" />
      </div>
      <div className="h-[400px] bg-slate-100 rounded-md" />
    </div>
  );
}

export default function Scans() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getScans(page, PAGE_SIZE)
      .then(({ scans: s, total: t }) => { setScans(s); setTotal(t); })
      .catch(() => setError('Failed to load scans.'))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return scans;
    const q = search.toLowerCase();
    return scans.filter((s) => s.projectName.toLowerCase().includes(q));
  }, [search, scans]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) return <ScansSkeleton />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scans</h1>
          <p className="text-sm text-slate-500 mt-1">{total} scan{total !== 1 ? 's' : ''} completed across all projects.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project..."
              className="input pl-9 py-2 text-xs w-56"
              aria-label="Search scans by project name"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card p-8 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-armor-critical" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700 mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary btn-sm">
            Retry
          </button>
        </div>
      )}

      {/* Table card */}
      {!error && (
        <div className="card overflow-hidden">
          {filtered.length === 0 && !loading ? (
            <div className="py-16 text-center text-slate-400">
              <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium">{search ? 'No scans match your search.' : 'No scans recorded yet.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Project', 'Score', 'Critical', 'Warning', 'Info', 'Duration', 'Date', 'Status', ''].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="group cursor-pointer" onClick={() => window.location.href = `/scans/${s.id}`}>
                      <td>
                        <p className="text-slate-900 font-medium text-sm truncate max-w-[200px]">{s.projectName}</p>
                        <p className="text-slate-400 text-xs truncate max-w-[240px] font-mono mt-0.5">{s.projectPath}</p>
                      </td>
                      <td><span className={`badge ${scoreBadge(s.score)}`}>{s.score}</span></td>
                      <td className="text-armor-critical font-semibold text-sm">{s.criticalCount ?? 0}</td>
                      <td className="text-armor-warning font-semibold text-sm">{s.warningCount ?? 0}</td>
                      <td className="text-armor-info font-semibold text-sm">{s.infoCount ?? 0}</td>
                      <td className="text-slate-400 text-xs font-mono">{fmtDuration(s.durationMs)}</td>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{new Date(s.startedAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${s.status === 'complete' ? 'badge-success' : s.status === 'failed' ? 'badge-critical' : 'badge-warning'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/scans/${s.id}`}
                          className="btn btn-secondary px-3 py-1.5 text-xs group-hover:border-slate-300 transition-colors"
                        >
                          View <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!error && !loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn btn-secondary px-2.5 py-2 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-armor-primary text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  aria-label={`Page ${pageNum}`}
                  aria-current={pageNum === page ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn btn-secondary px-2.5 py-2 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
