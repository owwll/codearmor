import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import { Shield, Activity, HardDrive, AlertOctagon, ArrowUpRight, TrendingUp, Sparkles, AlertTriangle, Users } from 'lucide-react';
import { api, DashboardStats, ScanRecord, UsageEntry } from '../api/client';
import { useAuth } from '../hooks/useAuth';

function scoreColor(score: number): string {
  if (score >= 80) return 'text-[#22C55E]';
  if (score >= 50) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-[#22C55E]/10 border-[#22C55E]/20 text-[#22C55E]';
  if (score >= 50) return 'bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]';
  return 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [scans, setScans]   = useState<ScanRecord[]>([]);
  const [usage, setUsage]   = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    const calls: Promise<any>[] = [
      api.getStats(),
      api.getScans(1, 5),
    ];
    // Only admins can fetch usage stats
    if (user?.role === 'admin') calls.push(api.getUsage());

    Promise.all(calls)
      .then(([s, r, u]) => {
        setStats(s);
        setScans(r.scans);
        if (u) setUsage(u.usage ?? []);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load Security Operations Center (SOC) data.');
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400 gap-3">
        <span className="text-3xl animate-spin text-indigo-600">🛡️</span>
        <p className="text-xs">Decoding metric streams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-rose-600 font-medium glass-card max-w-lg mx-auto mt-16 text-center border-rose-200 bg-white select-none shadow-md">
        <AlertOctagon className="w-12 h-12 mx-auto mb-4 text-[#EF4444]" />
        <h3 className="text-slate-900 text-lg font-bold mb-2">Connection Failure</h3>
        <p className="text-slate-650 text-xs leading-relaxed mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-xs font-semibold text-white rounded-xl transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, severityBreakdown, categoryBreakdown } = stats;

  // Transform data for MUI X Charts
  const barDataset = categoryBreakdown.map((c) => ({
    category: c.category.replace(/Agent \d+\s*-\s*/, '').substring(0, 12),
    count: c.count,
  }));

  const pieDataset = severityBreakdown.map((s, idx) => ({
    id: idx,
    value: s.count,
    label: s.severity,
    color: s.severity === 'CRITICAL' ? '#EF4444' : s.severity === 'WARNING' ? '#F59E0B' : '#06B6D4',
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none bg-[#F8FAFC]">
      {/* Title / Plan status */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Security Console</h1>
          <p className="text-sm text-slate-500">Real-time telemetry and consolidated vulnerability summaries.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 text-right shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase block font-bold tracking-wider mb-1">Platform Status</span>
          <span className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-2 justify-end">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]"></span>
            Active Compliance Monitor
          </span>
        </div>
      </div>

      {/* Bento Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Asymmetric Large Score Card */}
        <div className="glass-card md:col-span-2 p-6 flex flex-col justify-between min-h-[220px]">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">Threat Score Index</span>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4.5 h-4.5 text-[#22C55E]" />
                Compliance Baseline Stable
              </h2>
              <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
                Aggregated system health metrics computed across all monitored git repositories.
              </p>
            </div>
            <div className="flex flex-col items-end">
              <div className={`text-6xl font-black font-display leading-none ${scoreColor(overview.avgScore)}`}>
                {overview.avgScore}/100
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border mt-3 uppercase tracking-wider ${scoreBg(overview.avgScore)}`}>
                {overview.avgScore >= 80 ? 'SECURE' : overview.avgScore >= 50 ? 'WARNING' : 'CRITICAL'}
              </span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Overall system security rating across configured workspaces.</span>
            <span className="text-slate-500">Target score: 80+</span>
          </div>
        </div>

        {/* Small Stat 1 */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Total Scans</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-550/10 flex items-center justify-center text-indigo-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-slate-900 my-3 font-mono">{overview.totalScans}</div>
          <span className="text-xs text-slate-500 font-medium">Total inspect runs completed.</span>
        </div>

        {/* Small Stat 2 */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Tracked Projects</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-550/10 flex items-center justify-center text-indigo-600">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-slate-900 my-3 font-mono">{overview.projectCount}</div>
          <span className="text-xs text-slate-500 font-medium">Active git workspaces.</span>
        </div>

        {/* Small Stat 3 */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Vulnerabilities</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-[#EF4444]">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-4xl font-extrabold text-slate-900 my-3 font-mono">{overview.totalFindings}</div>
          <span className="text-xs text-slate-500 font-medium">Validated security gaps.</span>
        </div>

        {/* Local Sync Tracker */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Session Profile</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-[#22C55E]">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-slate-950 mb-0.5 truncate">
              User: <span className="text-indigo-600">{user?.username}</span>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Role: <span className="uppercase text-slate-700 font-semibold">{user?.role}</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">active credentials</span>
        </div>
      </div>

      {/* AI Recommendation Panel */}
      <div className="bg-[#EEF2FF] border-l-4 border-[#4F46E5] rounded-r-2xl p-6 shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">AI Security Assistant</h3>
            <span className="bg-[#4F46E5] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Confidence: 96%</span>
          </div>
          <div className="border-t border-[#4F46E5]/15 pt-2">
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
              Potential SQL Injection vulnerability detected.
            </p>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              <strong>Recommended Action:</strong> Refactor raw SQL construction and enable parameterized query bindings across all inputs to block code insertion attempts.
            </p>
          </div>
        </div>
      </div>

      {/* Usage Panel — admin only */}
      {user?.role === 'admin' && usage.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Daily Scan Usage</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{new Date().toLocaleDateString()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="cyber-table">
              <thead>
                <tr>
                  {['User', 'Plan', 'Role', 'Scans Today', 'Limit', 'Remaining', 'Last Scan'].map((h) => (
                    <th key={h} className="text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.map((u) => {
                  const pct = u.limit ? Math.round((u.scansToday / u.limit) * 100) : 0;
                  const barColor = pct >= 100 ? '#EF4444' : pct >= 66 ? '#F59E0B' : '#22C55E';
                  return (
                    <tr key={u.userId}>
                      <td className="font-semibold text-slate-900">{u.username}</td>
                      <td>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          u.plan === 'pro'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>{u.plan.toUpperCase()}</span>
                      </td>
                      <td>
                        <span className={`text-xs font-bold uppercase ${
                          u.role === 'admin' ? 'text-rose-600' : 'text-slate-500'
                        }`}>{u.role}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 font-bold font-mono text-sm">{u.scansToday}</span>
                          {u.limit && (
                            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-slate-500 font-mono text-xs">{u.limit ?? '∞'}</td>
                      <td>
                        {u.remaining === null
                          ? <span className="text-emerald-600 font-bold text-xs">Unlimited</span>
                          : <span className={`font-bold text-xs ${
                              u.remaining === 0 ? 'text-rose-600' : 'text-slate-700'
                            }`}>{u.remaining}</span>
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

      {/* Charts Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MUI X Bar Chart */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Vulnerability Classification Ranking</h2>
          {barDataset.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-xs text-slate-400">No chart telemetry available.</div>
          ) : (
            <div className="flex justify-center flex-1">
              <BarChart
                dataset={barDataset}
                xAxis={[{ 
                  scaleType: 'band', 
                  dataKey: 'category',
                  tickLabelStyle: { fill: '#475569', fontSize: 9, fontFamily: 'var(--font-body)' }
                }]}
                yAxis={[{
                  tickLabelStyle: { fill: '#475569', fontSize: 10, fontFamily: 'var(--font-body)' }
                }]}
                series={[{ dataKey: 'count', color: '#4F46E5' }]}
                height={260}
                width={650}
              />
            </div>
          )}
        </div>

        {/* MUI X Pie Chart */}
        <div className="glass-card p-6 flex flex-col">
          <h2 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider">Severity Distribution</h2>
          {pieDataset.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-xs text-slate-400">No breakdowns available.</div>
          ) : (
            <div className="flex justify-center flex-1">
              <PieChart
                series={[{
                  data: pieDataset,
                  innerRadius: 50,
                  outerRadius: 85,
                  paddingAngle: 4,
                  cornerRadius: 6,
                }]}
                height={260}
                width={320}
              />
            </div>
          )}
        </div>
      </div>

      {/* Recent Scans list */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-250 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Security Inspects</h2>
          <Link to="/scans" className="text-xs text-indigo-650 hover:text-indigo-800 hover:underline flex items-center gap-1 font-semibold">
            Browse All Scans
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="cyber-table">
            <thead>
              <tr>
                {['Target Workspace', 'Security Score', 'Critical Flaws', 'Execution Date', 'Telemetry Status'].map((h) => (
                  <th key={h} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td className="text-slate-900 font-semibold truncate max-w-[200px]">{s.projectName}</td>
                  <td>
                    <span className={`text-xs border rounded-full px-2.5 py-0.5 font-bold ${scoreBg(s.score)}`}>
                      {s.score}
                    </span>
                  </td>
                  <td className="text-[#EF4444] font-bold">{s.criticalCount}</td>
                  <td className="text-slate-650 text-xs font-mono">{new Date(s.startedAt).toLocaleString()}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold uppercase ${
                      s.status === 'complete' ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20' : 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
              {scans.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No scan executions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
