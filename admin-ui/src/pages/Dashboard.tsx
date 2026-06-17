import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Shield, Activity, HardDrive, AlertOctagon, ArrowUpRight, Sparkles, Users } from 'lucide-react';
import { api, DashboardStats, ScanRecord, UsageEntry } from '../api/client';
import { useAuth } from '../hooks/useAuth';

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-armor-success';
  if (score >= 50) return 'text-armor-warning';
  return 'text-armor-critical';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-armor-success';
  if (score >= 50) return 'bg-armor-warning';
  return 'bg-armor-critical';
}

const CHART_COLORS = {
  critical: '#DC2626',
  warning: '#D97706',
  info: '#0284C7',
  primary: '#4F46E5',
};

function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ - (circ * score) / 100;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={90} height={90} viewBox="0 0 90 90" aria-hidden="true">
        <circle cx={45} cy={45} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={6} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash}
          transform="rotate(-90 45 45)" style={{ transition: 'stroke-dashoffset 1s ease-in-out' }} />
      </svg>
      <div className="absolute text-center">
        <span className={`text-xl font-bold leading-none ${scoreColor(score)}`}>{score}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent, sub }: {
  label: string; value: string | number; icon: React.ElementType; accent: string; sub?: string;
}) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent}`}>
          <Icon className="w-3.5 h-3.5 text-white" aria-hidden="true" />
        </div>
      </div>
      <span className="text-2xl font-bold text-slate-900 font-mono tracking-tight">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-slate-200 rounded-md" />
          <div className="h-4 w-56 bg-slate-100 rounded-md" />
        </div>
        <div className="h-9 w-40 bg-slate-100 rounded-md" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 h-44 bg-slate-100 rounded-md" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-slate-100 rounded-md" />
          <div className="h-32 bg-slate-100 rounded-md" />
          <div className="h-32 bg-slate-100 rounded-md" />
          <div className="h-32 bg-slate-100 rounded-md" />
        </div>
      </div>
      <div className="h-24 bg-slate-100 rounded-md" />
      <div className="h-64 bg-slate-100 rounded-md" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const barRef = useContainerWidth();
  const pieRef = useContainerWidth();

  useEffect(() => {
    const calls: Promise<any>[] = [
      api.getStats(),
      api.getScans(1, 5),
    ];
    if (user?.role === 'admin') calls.push(api.getUsage());

    Promise.all(calls)
      .then(([s, r, u]) => {
        setStats(s);
        setScans(r.scans);
        if (u) setUsage(u.usage ?? []);
      })
      .catch(() => {
        setError('Failed to load dashboard data.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-8 card max-w-lg mx-auto mt-16 text-center">
          <AlertOctagon className="w-12 h-12 mx-auto mb-4 text-armor-critical" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Connection Error</h3>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, severityBreakdown, categoryBreakdown } = stats;

  const barDataset = categoryBreakdown.map((c) => ({
    category: c.category.replace(/Agent \d+\s*-\s*/, '').substring(0, 12),
    count: c.count,
  }));

  const pieDataset = severityBreakdown.map((s, idx) => ({
    id: idx,
    value: s.count,
    label: s.severity,
    color: s.severity === 'CRITICAL' ? CHART_COLORS.critical : s.severity === 'WARNING' ? CHART_COLORS.warning : CHART_COLORS.info,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview of scan activity and security posture.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-armor-success" />
            Operational
          </span>
        </div>
      </div>

      {/* Score + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card md:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-medium">Security Score</span>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${scoreBg(overview.avgScore)}`} />
                Overall rating
              </h2>
              <p className="text-sm text-slate-500">
                Aggregate score across all scanned projects.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ScoreRing score={overview.avgScore} />
              <div className="flex flex-col items-start">
                <span className={`text-4xl font-bold leading-none ${scoreColor(overview.avgScore)}`}>
                  {overview.avgScore}
                </span>
                <span className="text-xs text-slate-400 mt-0.5">/ 100</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Aggregate across {overview.projectCount} project{overview.projectCount !== 1 ? 's' : ''}.</span>
            <span className="text-slate-500 font-medium">Target: 80+</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 content-start">
          <StatCard label="Total Scans" value={overview.totalScans} icon={Activity} accent="bg-armor-primary" sub="Completed runs" />
          <StatCard label="Projects" value={overview.projectCount} icon={HardDrive} accent="bg-armor-primary" sub="Monitored repos" />
          <StatCard label="Vulnerabilities" value={overview.totalFindings} icon={AlertOctagon} accent="bg-armor-critical" sub="Open gaps" />
          <div className="card p-5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Session</span>
              <div className="w-7 h-7 rounded-md bg-armor-success-subtle flex items-center justify-center text-armor-success">
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-900 truncate">{user?.username}</span>
            <span className="text-xs text-slate-400 capitalize">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* System Status — always visible, no fake data */}
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-armor-primary-subtle text-armor-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="text-sm font-semibold text-slate-900">AI Analysis</h3>
            <p className="text-sm text-slate-500">
              Security recommendations from AI agents will appear here after each scan completes.
              Run a scan to receive actionable vulnerability insights.
            </p>
          </div>
        </div>
      </div>

      {/* Admin: Usage table */}
      {user?.role === 'admin' && usage.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-900">Daily Scan Usage</h2>
            </div>
            <span className="text-xs text-slate-400">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {['User', 'Plan', 'Role', 'Scans Today', 'Limit', 'Remaining', 'Last Scan'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => {
                  const pct = u.limit ? Math.round((u.scansToday / u.limit) * 100) : 0;
                  return (
                    <tr key={u.userId}>
                      <td className="font-medium text-slate-900">{u.username}</td>
                      <td><span className="badge badge-info">{u.plan.toUpperCase()}</span></td>
                      <td>
                        <span className={`text-xs font-medium ${u.role === 'admin' ? 'text-armor-critical' : 'text-slate-500'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="text-slate-900 font-semibold font-mono text-sm">{u.scansToday}</span>
                          {u.limit && (
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: pct >= 100 ? '#DC2626' : pct >= 66 ? '#D97706' : '#059669'
                              }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="font-mono text-xs text-slate-400">{u.limit ?? '∞'}</td>
                      <td>
                        {u.remaining === null
                          ? <span className="text-armor-success font-medium text-xs">Unlimited</span>
                          : <span className={`font-medium text-xs ${u.remaining === 0 ? 'text-armor-critical' : 'text-slate-600'}`}>{u.remaining}</span>
                        }
                      </td>
                      <td className="text-slate-400 text-xs font-mono">{u.lastScanDate ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Findings by Category</h2>
          {barDataset.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px] text-xs text-slate-400">
              <Activity className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
              <p className="font-medium">No findings data</p>
              <p className="mt-0.5">Run a scan to see category breakdown.</p>
            </div>
          ) : (
            <div ref={barRef.ref} className="w-full">
              {barRef.width > 0 && (
                <BarChart
                  dataset={barDataset}
                  xAxis={[{
                    scaleType: 'band',
                    dataKey: 'category',
                    tickLabelStyle: { fill: '#64748B', fontSize: 10, fontFamily: 'Inter, sans-serif' }
                  }]}
                  yAxis={[{
                    tickLabelStyle: { fill: '#64748B', fontSize: 10, fontFamily: 'Inter, sans-serif' }
                  }]}
                  series={[{ dataKey: 'count', color: CHART_COLORS.primary }]}
                  height={260}
                  width={barRef.width - 48}
                  margin={{ left: 40, right: 8, top: 8, bottom: 40 }}
                />
              )}
            </div>
          )}
        </div>

        <div className="card p-6 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Severity Distribution</h2>
          {pieDataset.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px] text-xs text-slate-400">
              <Activity className="w-8 h-8 text-slate-300 mb-2" aria-hidden="true" />
              <p className="font-medium">No severity data</p>
              <p className="mt-0.5">Run a scan to see distribution.</p>
            </div>
          ) : (
            <div ref={pieRef.ref} className="w-full flex-1 flex items-center justify-center">
              {pieRef.width > 0 && (
                <PieChart
                  series={[{
                    data: pieDataset,
                    innerRadius: 50,
                    outerRadius: 85,
                    paddingAngle: 4,
                    cornerRadius: 6,
                  }]}
                  height={260}
                  width={Math.min(pieRef.width - 32, 320)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Scans */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-900">Recent Scans</h2>
          <Link to="/scans" className="text-xs text-armor-primary hover:text-armor-primary-hover flex items-center gap-1 font-medium">
            View all
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {['Project', 'Score', 'Critical', 'Date', 'Status'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">No scans recorded yet.</td>
                </tr>
              )}
              {scans.map((s) => (
                <tr key={s.id}>
                  <td className="text-slate-900 font-medium truncate max-w-[200px]">{s.projectName}</td>
                  <td><span className={`badge ${s.score >= 80 ? 'badge-success' : s.score >= 50 ? 'badge-warning' : 'badge-critical'}`}>{s.score}</span></td>
                  <td className="text-armor-critical font-semibold">{s.criticalCount}</td>
                  <td className="text-slate-400 text-xs font-mono">{new Date(s.startedAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${s.status === 'complete' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
